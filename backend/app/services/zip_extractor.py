import os
import zipfile
import shutil
import re
from pathlib import Path
from typing import List
from uuid import UUID

from fastapi import UploadFile, HTTPException
from sqlmodel import select
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models import FileModel

settings = get_settings()

IGNORED_DIRS = {
    # Dependencies
    "node_modules", "venv", ".venv", "env", "__pycache__", "vendor",
    # Git
    ".git",
    # Build
    "dist", "build", "out", ".next", ".nuxt", "target", "coverage", ".cache",
    # Frameworks & Infrastructure
    ".svelte-kit", ".output", ".serverless", ".expo", "cdk.out", ".tox", ".nox",
    # Caches
    ".turbo", ".nx", ".nyc_output", "htmlcov",
    # IDE
    ".vscode", ".idea",
    # Python
    ".pytest_cache", ".mypy_cache", ".ruff_cache",
}

IGNORED_EXTS = {
    # Binary/Media
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".mp3", ".wav", 
    ".mp4", ".mov", ".avi", ".zip", ".tar", ".gz", ".7z", ".rar", 
    ".exe", ".dll", ".so", ".dylib", ".pyc", ".woff", ".woff2", ".ttf", ".eot", ".svg",
    # Compiled Code
    ".class", ".o", ".obj", ".pdb", ".apk", ".aab", ".ipa",
    # Generated
    ".min.js", ".min.css", ".map", ".js.map", ".css.map",
    # Reports
    ".lcov", ".prof",
    # Data & Databases
    ".csv", ".tsv", ".parquet", ".sqlite", ".sqlite3", ".db", ".rdb", ".bson", ".sql.gz",
    # Logs
    ".log",
    # Design & Docs
    ".pdf", ".docx", ".pptx", ".psd", ".ai", ".sketch", ".fig",
    # OS
    ".ds_store"
}

IGNORED_FILES = {
    "package-lock.json", 
    "yarn.lock", 
    "pnpm-lock.yaml", 
    "bun.lockb", 
    "uv.lock", 
    "poetry.lock", 
    "gemfile.lock", 
    "composer.lock", 
    "cargo.lock",
    "mix.lock",
    "flake.lock",
    "go.sum",
    ".eslintcache",
    ".stylelintcache",
    ".prettiercache",
    "lcov.info",
    "coverage.xml",
    "test-results.xml",
    "thumbs.db"
}

SECRET_EXTS = {".pem", ".key", ".p12", ".pfx"}

def is_secret_file(filename: str) -> bool:
    name_lower = filename.lower()
    if name_lower.startswith(".env"):
        return True
    if any(name_lower.endswith(ext) for ext in SECRET_EXTS):
        return True
    if name_lower in ["credentials.json", "service-account.json"]:
        return True
    return False

def get_language_from_filename(filename: str) -> str:
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    lang_map = {
        "py": "python", "js": "javascript", "jsx": "javascript", 
        "ts": "typescript", "tsx": "typescript", "java": "java",
        "c": "c", "cpp": "cpp", "h": "c", "hpp": "cpp",
        "cs": "csharp", "go": "go", "rs": "rust", "rb": "ruby",
        "php": "php", "html": "html", "css": "css", "json": "json",
        "md": "markdown", "sql": "sql", "sh": "shell", "yaml": "yaml", "yml": "yaml"
    }
    return lang_map.get(ext, "")

def redact_secrets(content: str) -> str:
    """Redacts values in .env or similar config files."""
    # Redact common key=value patterns where value looks like a secret
    # e.g., API_KEY=sk-... -> API_KEY=[REDACTED]
    lines = content.split('\n')
    redacted_lines = []
    for line in lines:
        if '=' in line and len(line.strip()) > 0 and not line.strip().startswith('#'):
            key, val = line.split('=', 1)
            key = key.strip()
            # Simple heuristic: redact if the key implies a secret/token/password
            if any(k in key.lower() for k in ['key', 'secret', 'token', 'password', 'url', 'uri', 'credential']):
                redacted_lines.append(f"{key}=[REDACTED]")
            else:
                # To be safe on .env files, redact everything that has a value
                redacted_lines.append(f"{key}=[REDACTED]")
        else:
            redacted_lines.append(line)
    return '\n'.join(redacted_lines)

def is_safe_path(base_dir: Path, target_path: Path) -> bool:
    """Check for zip-slip vulnerability by ensuring target is within base_dir."""
    try:
        # resolve() strictly evaluates symlinks and '..'
        return base_dir.resolve() in target_path.resolve().parents
    except Exception:
        return False


async def extract_and_store_zip(
    project_id: UUID,
    upload_file: UploadFile,
    db: AsyncSession
) -> int:
    """
    Extracts a zip file, filters noise, prevents zip-slip, and saves file paths to the DB.
    Returns the number of files processed.
    """
    project_dir = Path(settings.upload_dir) / str(project_id)
    
    # Clean up previous extraction if it exists
    if project_dir.exists():
        shutil.rmtree(project_dir)
    project_dir.mkdir(parents=True, exist_ok=True)
    
    # Save the zip temporarily
    zip_path = project_dir / "upload.zip"
    with open(zip_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    extracted_files = []
    
    try:
        with zipfile.ZipFile(zip_path, "r") as zf:
            for member in zf.infolist():
                # Skip directories
                if member.is_dir():
                    continue
                    
                target_path = project_dir / member.filename
                
                # 1. Zip-slip protection
                if not is_safe_path(project_dir, target_path):
                    continue
                    
                # Calculate relative path components for filtering
                rel_path = target_path.relative_to(project_dir)
                parts = rel_path.parts
                
                # 2. Filter ignored directories
                if any(part in IGNORED_DIRS for part in parts):
                    continue
                    
                # 3. Filter ignored file extensions
                if target_path.suffix.lower() in IGNORED_EXTS:
                    continue
                
                # 4. Filter ignored exact file names
                if target_path.name.lower() in IGNORED_FILES or target_path.name.endswith(".min.js") or target_path.name.endswith(".min.css"):
                    continue
                    
                # 4. Size cap (skip files > 1MB)
                if member.file_size > settings.max_file_size_bytes:
                    continue
                    
                # Extract the file safely
                target_path.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(member) as source, open(target_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                
                # 5. Redact secrets
                if is_secret_file(target_path.name):
                    try:
                        with open(target_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        redacted = redact_secrets(content)
                        with open(target_path, "w", encoding="utf-8") as f:
                            f.write(redacted)
                    except UnicodeDecodeError:
                        # If binary, it's safer to just remove it
                        target_path.unlink()
                        continue

                
                # Convert path to posix format for cross-platform consistency in DB
                db_path = rel_path.as_posix()
                extracted_files.append({
                    "db_path": db_path,
                    "filename": target_path.name,
                    "size": member.file_size
                })
                
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file uploaded.")
    finally:
        # Remove the zip file to save space
        if zip_path.exists():
            zip_path.unlink()

    # Clear existing files for this project in DB
    await db.execute(delete(FileModel).where(FileModel.project_id == project_id))
    
    if not extracted_files:
        raise HTTPException(status_code=400, detail="No valid source files found in ZIP.")

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

async def extract_and_store_files(
    project_id: UUID,
    upload_files: List[UploadFile],
    db: AsyncSession
) -> int:
    """
    Saves multiple individual files to disk, applies filters/redaction, and saves to DB.
    """
    project_dir = Path(settings.upload_dir) / str(project_id)
    
    if project_dir.exists():
        shutil.rmtree(project_dir)
    project_dir.mkdir(parents=True, exist_ok=True)
    
    extracted_files = []
    
    for upload_file in upload_files:
        filename = upload_file.filename
        if not filename:
            continue
            
        target_path = project_dir / filename
        
        # Security: ensure it doesn't escape the directory
        if not is_safe_path(project_dir, target_path):
            continue
            
        # File extension filtering
        if target_path.suffix.lower() in IGNORED_EXTS:
            continue
            
        # File exact name filtering
        if target_path.name.lower() in IGNORED_FILES or target_path.name.endswith(".min.js") or target_path.name.endswith(".min.css"):
            continue

        target_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Save file to calculate size and process
        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
            
        file_size = target_path.stat().st_size
        
        if file_size > settings.max_file_size_bytes:
            target_path.unlink()
            continue
            
        if is_secret_file(target_path.name):
            try:
                with open(target_path, "r", encoding="utf-8") as f:
                    content = f.read()
                redacted = redact_secrets(content)
                with open(target_path, "w", encoding="utf-8") as f:
                    f.write(redacted)
            except UnicodeDecodeError:
                target_path.unlink()
                continue
                
        db_path = target_path.relative_to(project_dir).as_posix()
        extracted_files.append({
            "db_path": db_path,
            "filename": target_path.name,
            "size": file_size
        })

    if not extracted_files:
        raise HTTPException(status_code=400, detail="No valid files were uploaded.")

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
