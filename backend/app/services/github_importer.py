import os
import shutil
import subprocess
from pathlib import Path
from typing import List
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import select
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import FileModel
from app.services.zip_extractor import IGNORED_DIRS, IGNORED_EXTS, IGNORED_FILES, get_language_from_filename

settings = get_settings()

async def clone_and_store_github(
    project_id: UUID,
    github_url: str,
    db: AsyncSession
) -> int:
    """
    Clones a GitHub repository, filters noise, and saves file paths to the DB.
    Returns the number of files processed.
    """
    project_dir = Path(settings.upload_dir) / str(project_id)
    
    # Clean up previous extraction if it exists
    if project_dir.exists():
        import stat
        def remove_readonly(func, path, excinfo):
            os.chmod(path, stat.S_IWRITE)
            func(path)
        shutil.rmtree(project_dir, onerror=remove_readonly)
    project_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Sanitize GitHub URL
        if not github_url.startswith("https://github.com/"):
            raise HTTPException(status_code=400, detail="Only https://github.com/ URLs are supported.")
        if " " in github_url or ";" in github_url or "|" in github_url or "&" in github_url or "$" in github_url:
            raise HTTPException(status_code=400, detail="Invalid characters in GitHub URL.")

        # Clone the repository
        # Use --depth 1 to only get the latest commit and save time/space
        process = subprocess.run(
            ["git", "clone", "--depth", "1", github_url, str(project_dir)],
            capture_output=True,
            text=True
        )
        if process.returncode != 0:
            raise HTTPException(status_code=400, detail=f"Failed to clone repository. Is it public? Error: {process.stderr}")
            
        # Clean up the .git directory
        git_dir = project_dir / ".git"
        if git_dir.exists():
            import stat
            def remove_readonly(func, path, excinfo):
                os.chmod(path, stat.S_IWRITE)
                func(path)
            shutil.rmtree(git_dir, onerror=remove_readonly)

        extracted_files = []
        
        for root, dirs, files in os.walk(project_dir):
            root_path = Path(root)
            
            # Filter ignored directories dynamically
            dirs[:] = [d for d in dirs if d not in IGNORED_DIRS]
            
            for file in files:
                target_path = root_path / file
                rel_path = target_path.relative_to(project_dir)
                
                # Filter ignored file extensions
                if target_path.suffix.lower() in IGNORED_EXTS:
                    continue
                    
                # Filter ignored files
                if target_path.name.lower() in IGNORED_FILES or target_path.name.endswith(".min.js") or target_path.name.endswith(".min.css"):
                    continue
                    
                # Size cap (skip files > 1MB)
                file_size = target_path.stat().st_size
                if file_size > settings.max_file_size_bytes:
                    continue
                    
                db_path = rel_path.as_posix()
                extracted_files.append({
                    "db_path": db_path,
                    "filename": target_path.name,
                    "size": file_size
                })
                
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

    # Clear existing files for this project in DB
    await db.execute(delete(FileModel).where(FileModel.project_id == project_id))

    if not extracted_files:
        raise HTTPException(status_code=400, detail="No valid source files found in repository.")

    files_to_insert = []
    for info in extracted_files:
        files_to_insert.append(
            FileModel(
                project_id=project_id,
                path=info["db_path"],
                filename=info["filename"],
                language=get_language_from_filename(info["filename"]),
                size_bytes=info["size"]
            )
        )
    db.add_all(files_to_insert)
    await db.commit()
    
    return len(files_to_insert)
