import os
import json
from uuid import UUID
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models import (
    Project, 
    Review, 
    Issue, 
    ReviewScope, 
    TemplateType,
    FileModel,
    AiProviderConfig
)
from app.services.ai.provider_client import ProviderClient
from app.core.config import get_settings

settings = get_settings()

SECURITY_PROMPT = """You are an elite application security engineer conducting a code review.
Review the provided code for security vulnerabilities, secrets, logic flaws, and tech debt.

You MUST respond strictly with a JSON object matching this exact schema:
{
  "summary": "A 1-2 sentence overview of the code's security posture.",
  "issues": [
    {
      "title": "Short title of the vulnerability",
      "description": "Detailed explanation of the issue.",
      "severity": "critical" | "high" | "medium" | "low",
      "function_name": "Name of the function if applicable, else null",
      "line_start": 12,
      "line_end": 14,
      "recommendation": "How to fix this issue."
    }
  ]
}

If no issues are found, return an empty array for "issues".
"""

async def run_review(
    project_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    scope: ReviewScope = ReviewScope.project
) -> Review:
    # 1. Fetch project and config
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project or not project.ai_provider_config_id:
        raise HTTPException(status_code=400, detail="Project or Provider Config not found.")
        
    config = await db.get(AiProviderConfig, project.ai_provider_config_id)
    if not config:
        raise HTTPException(status_code=400, detail="Provider Config not found.")

    # 2. Fetch all files for this project
    file_stmt = select(FileModel).where(FileModel.project_id == project_id)
    files = (await db.execute(file_stmt)).scalars().all()
    if not files:
        raise HTTPException(status_code=400, detail="No files found to review.")

    # 3. Create pending Review record
    review = Review(
        project_id=project_id,
        user_id=user_id,
        scope=scope,
        template_type=TemplateType.security,
        status="running"
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    # Launch background processing here? No, we will let the router do it so we don't depend on global FastAPI BackgroundTasks here.
    return review

async def process_review_in_background(review_id: UUID):
    from app.db.session import async_session
    
    async with async_session() as db:
        review = await db.get(Review, review_id)
        if not review or review.status != "running":
            return
            
        project_id = review.project_id
        project = await db.get(Project, project_id)
        config = await db.get(AiProviderConfig, project.ai_provider_config_id)
        
        file_stmt = select(FileModel).where(FileModel.project_id == project_id)
        files = (await db.execute(file_stmt)).scalars().all()
        
        client = ProviderClient(config)
        
        try:
            for f in files:
                try:
                    file_path = os.path.join(settings.upload_dir, str(project_id), f.path)
                    with open(file_path, "r", encoding="utf-8") as disk_f:
                        content = disk_f.read()
                        
                    if not content.strip():
                        continue
                        
                    prompt = f"File: {f.path}\n\n```{f.language}\n{content}\n```"
                    
                    result = await client.generate_review(prompt, SECURITY_PROMPT)
                    
                    issues = result.get("issues", [])
                    for i, issue_data in enumerate(issues):
                        new_issue = Issue(
                            review_id=review.id,
                            file_id=f.id,
                            title=issue_data.get("title", "Unknown Issue"),
                            description=issue_data.get("description", ""),
                            severity=issue_data.get("severity", "low"),
                            function_name=issue_data.get("function_name"),
                            line_start=issue_data.get("line_start"),
                            line_end=issue_data.get("line_end"),
                            recommendation=issue_data.get("recommendation", ""),
                            command_slug=f"issue-{f.path.split('/')[-1]}-{i}"
                        )
                        db.add(new_issue)
                        
                    review.summary = result.get("summary", "Review complete.")
                    
                except UnicodeDecodeError:
                    continue
                except Exception as e:
                    error_str = str(e).lower()
                    print(f"Error reviewing {f.path}: {e}")
                    if "context_length_exceeded" in error_str or "request too large" in error_str or "413" in error_str:
                        new_issue = Issue(
                            review_id=review.id,
                            file_id=f.id,
                            title="File Too Large for AI Context",
                            description=f"This file is too large for the selected model's context window. Please review it manually. Error: {e}",
                            severity="low",
                            command_slug=f"issue-{f.path.split('/')[-1]}-too-large"
                        )
                        db.add(new_issue)
                    continue

            review.status = "completed"
        except Exception as e:
            review.status = "failed"
            review.error_message = str(e)
        finally:
            await client.close()
            await db.commit()
