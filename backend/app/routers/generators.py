from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from uuid import UUID
import os

from app.db.session import get_db
from app.core.deps import get_current_user
from app.core.config import get_settings
from app.models import Project, FileModel, AiProviderConfig
from app.services.ai.provider_client import ProviderClient
from app.services.tree_builder import build_tree

settings = get_settings()

router = APIRouter(prefix="/projects/{project_id}", tags=["Generators"])

@router.post("/generate-docs")
async def generate_documentation(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project or not project.ai_provider_config_id:
        raise HTTPException(status_code=400, detail="Project or Provider Config not found.")
        
    config = await db.get(AiProviderConfig, project.ai_provider_config_id)
    if not config:
        raise HTTPException(status_code=400, detail="Provider Config not found.")

    file_stmt = select(FileModel).where(FileModel.project_id == project_id).options(selectinload(FileModel.issues))
    files = (await db.execute(file_stmt)).scalars().all()
    if not files:
        raise HTTPException(status_code=400, detail="No files found in the project.")

    tree = build_tree(files)
    
    # We will pick a few important files to give context to the LLM (like package.json, README, main.py, etc.)
    important_files = [f for f in files if f.filename in ["package.json", "pyproject.toml", "requirements.txt", "pom.xml"] or "main" in f.filename or "index" in f.filename]
    
    project_root_dir = os.path.join(settings.upload_dir, str(project_id))
    
    context_str = "Project File Tree:\n"
    def render_tree(nodes, indent=""):
        res = ""
        for n in nodes:
            res += f"{indent}- {n['name']}\n"
            if n["type"] == "directory":
                res += render_tree(n["children"], indent + "  ")
        return res
        
    context_str += render_tree(tree) + "\n\n"
    
    for f in important_files[:5]: # Limit to 5 files to avoid huge context
        try:
            with open(os.path.join(project_root_dir, f.path), "r", encoding="utf-8") as df:
                c = df.read()
                if len(c) > 3000:
                    c = c[:3000] + "\n... (truncated)"
                context_str += f"File: {f.path}\n```\n{c}\n```\n\n"
        except Exception:
            pass

    system_prompt = (
        "You are an expert technical writer and software architect. "
        "Generate a comprehensive and professional README.md for this project based on the provided context. "
        "Include sections like: Project Overview, Features, Setup Instructions, and Architecture. "
        "Return ONLY the raw markdown content without any wrapper like ```markdown."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": context_str}
    ]

    client = ProviderClient(config)
    try:
        reply = await client.generate_chat(messages)
    finally:
        await client.close()

    # Sometimes LLMs still wrap with markdown even if told not to
    if reply.startswith("```markdown\n"):
        reply = reply[12:]
    if reply.endswith("```"):
        reply = reply[:-3]

    return {"documentation": reply.strip()}


@router.post("/files/{file_id}/generate-tests")
async def generate_tests(
    project_id: UUID,
    file_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project or not project.ai_provider_config_id:
        raise HTTPException(status_code=400, detail="Project or Provider Config not found.")
        
    config = await db.get(AiProviderConfig, project.ai_provider_config_id)
    
    file_model = await db.get(FileModel, file_id)
    if not file_model or file_model.project_id != project_id:
        raise HTTPException(status_code=404, detail="File not found")

    project_root_dir = os.path.join(settings.upload_dir, str(project_id))
    try:
        with open(os.path.join(project_root_dir, file_model.path), "r", encoding="utf-8") as df:
            content = df.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read file content")

    system_prompt = (
        "You are an expert Software Engineer in Test (SDET). "
        "Generate comprehensive unit tests for the provided code file. "
        "Use standard testing frameworks appropriate for the language (e.g., Jest/Vitest for TS/JS, pytest for Python). "
        "Focus on core logic, edge cases, and mocking dependencies. "
        "Return ONLY the raw code block with the tests. Do not include explanations."
    )

    user_prompt = f"File Path: {file_model.path}\nLanguage: {file_model.language}\n\n```\n{content}\n```\n"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]

    client = ProviderClient(config)
    try:
        reply = await client.generate_chat(messages)
    finally:
        await client.close()

    return {"tests": reply}
