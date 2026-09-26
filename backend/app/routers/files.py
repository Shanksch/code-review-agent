"""
File routes — upload, tree, file content.
"""

import os
import tempfile
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.core.deps import get_current_user
from app.core.config import get_settings
from app.db.session import get_db
from app.models import Project, FileModel
from app.services.zip_extractor import extract_and_store_zip
from app.services.tree_builder import build_tree

settings = get_settings()

router = APIRouter(prefix="/projects/{project_id}", tags=["Files"])


async def _get_owned_project(
    project_id: UUID, user_id: UUID, db: AsyncSession
) -> Project:
    project = await db.get(Project, project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_zip(
    project_id: UUID,
    file: UploadFile = File(...),
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a ZIP file, extract and store files for the project."""
    await _get_owned_project(project_id, user_id, db)

    if not file.filename or not file.filename.endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only ZIP files are supported",
        )

    # extract_and_store_zip handles sizes, zip-slip, extraction, and DB insertion
    try:
        file_count = await extract_and_store_zip(project_id, file, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to extract ZIP: {str(e)}",
        )

    return {"message": "Files uploaded successfully", "file_count": file_count}


from pydantic import BaseModel
class GitHubImportRequest(BaseModel):
    github_url: str

@router.post("/github", status_code=status.HTTP_201_CREATED)
async def import_github(
    project_id: UUID,
    request: GitHubImportRequest,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Clone a GitHub repository, extract and store files for the project."""
    await _get_owned_project(project_id, user_id, db)

    from app.services.github_importer import clone_and_store_github
    
    try:
        file_count = await clone_and_store_github(project_id, request.github_url, db)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clone repository: {str(e)}",
        )

    return {"message": "Repository imported successfully", "file_count": file_count}


from sqlalchemy.orm import selectinload

@router.get("/tree")
async def get_project_tree(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the file tree for a project with severity coloring."""
    try:
        await _get_owned_project(project_id, user_id, db)

        stmt = select(FileModel).where(FileModel.project_id == project_id).options(selectinload(FileModel.issues)).order_by(FileModel.path)
        result = await db.execute(stmt)
        files = result.scalars().all()

        tree = build_tree(files)
        return {"tree": tree, "file_count": len(files)}
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        raise HTTPException(status_code=500, detail=error_msg)


@router.get("/files/{file_id}")
async def get_file_content(
    project_id: UUID,
    file_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the content of a specific file."""
    await _get_owned_project(project_id, user_id, db)

    file = await db.get(FileModel, file_id)
    if not file or file.project_id != project_id:
        raise HTTPException(status_code=404, detail="File not found")

    content = "/* Could not read file content */"
    try:
        file_path = os.path.join(settings.upload_dir, str(project_id), file.path)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except UnicodeDecodeError:
        content = "/* Binary file or unsupported encoding */"
    except FileNotFoundError:
        content = "/* File not found on disk */"

    return {
        "id": str(file.id),
        "path": file.path,
        "filename": file.filename,
        "language": file.language,
        "size_bytes": file.size_bytes,
        "content": content,
    }
