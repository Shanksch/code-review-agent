"""
ZIP extraction service — handles upload processing with security guards.
"""

import os
import zipfile
from pathlib import Path, PurePosixPath
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models import FileModel
from app.core.config import get_settings

settings = get_settings()

# Directories to skip during extraction
SKIP_DIRS = {
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".cache",
    ".tox",
    "egg-info",
    ".mypy_cache",
    ".pytest_cache",
    "coverage",
    ".nyc_output",
    "vendor",        # Go/PHP
    "target",        # Rust/Java
}

# File extensions to skip (binary/media)
SKIP_EXTENSIONS = {
    ".exe", ".dll", ".so", ".dylib", ".o", ".obj",
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".woff", ".woff2", ".ttf", ".eot",
    ".pyc", ".pyo", ".class",
    ".db", ".sqlite", ".sqlite3",
}

# Language detection by extension
EXTENSION_TO_LANGUAGE = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "jsx",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".less": "less",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    ".md": "markdown",
    ".mdx": "mdx",
    ".sql": "sql",
    ".sh": "bash",
    ".bash": "bash",
    ".zsh": "bash",
    ".ps1": "powershell",
    ".bat": "batch",
    ".rs": "rust",
    ".go": "go",
    ".java": "java",
    ".kt": "kotlin",
    ".swift": "swift",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "c",
    ".hpp": "cpp",
    ".cs": "csharp",
    ".r": "r",
    ".R": "r",
    ".dart": "dart",
    ".lua": "lua",
    ".vim": "vim",
    ".dockerfile": "dockerfile",
    ".tf": "terraform",
    ".prisma": "prisma",
    ".graphql": "graphql",
    ".gql": "graphql",
    ".env": "dotenv",
    ".gitignore": "gitignore",
    ".dockerignore": "dockerignore",
    ".editorconfig": "editorconfig",
    ".txt": "text",
    ".csv": "csv",
    ".ini": "ini",
    ".cfg": "ini",
    ".conf": "ini",
    ".log": "text",
    ".rst": "restructuredtext",
    ".vue": "vue",
    ".svelte": "svelte",
}


def detect_language(filename: str) -> str:
    """Detect programming language from filename/extension."""
    # Check exact filename matches
    lower = filename.lower()
    if lower in ("dockerfile", "makefile", "rakefile", "gemfile", "procfile"):
        return lower
    if lower in (".env", ".env.local", ".env.example", ".env.development"):
        return "dotenv"
    if lower in (".gitignore", ".dockerignore"):
        return lower.lstrip(".")

    # Check extension
    ext = Path(filename).suffix.lower()
    return EXTENSION_TO_LANGUAGE.get(ext, "")


def should_skip_path(parts: list[str]) -> bool:
    """Check if any path component is in the skip list."""
    return any(part in SKIP_DIRS for part in parts)


async def extract_zip(
    zip_path: str,
    project_id: UUID,
    db: AsyncSession,
) -> int:
    """
    Extract a ZIP file, store text file contents in the database.
    Returns the number of files extracted.

    Security: zip-slip guard rejects entries escaping the target directory.
    """
    # Delete existing files for this project (re-upload replaces)
    existing = await db.execute(
        select(FileModel).where(FileModel.project_id == project_id)
    )
    for f in existing.scalars().all():
        await db.delete(f)
    await db.flush()

    file_count = 0

    with zipfile.ZipFile(zip_path, "r") as zf:
        for info in zf.infolist():
            # Skip directories
            if info.is_dir():
                continue

            # Normalize path (remove leading slashes, resolve ..)
            raw_path = info.filename

            # Strip the top-level directory if all entries share one
            parts = PurePosixPath(raw_path).parts

            # If the zip has a single root folder, strip it
            # (common when downloading repos as zip)
            if len(parts) > 1:
                # We'll strip the first component and re-check later
                relative_path = str(PurePosixPath(*parts[1:])) if len(parts) > 1 else parts[0]
            else:
                relative_path = parts[0]

            rel_parts = PurePosixPath(relative_path).parts

            # Zip-slip guard
            try:
                resolved = Path(relative_path).resolve()
                # If it tries to escape, skip
                if ".." in rel_parts:
                    continue
            except (ValueError, OSError):
                continue

            # Skip noise directories
            if should_skip_path(list(rel_parts)):
                continue

            # Skip binary/media files by extension
            ext = Path(relative_path).suffix.lower()
            if ext in SKIP_EXTENSIONS:
                continue

            # Size guard
            if info.file_size > settings.max_file_size_bytes:
                continue

            # Try to read as text
            try:
                content = zf.read(info.filename).decode("utf-8", errors="strict")
            except (UnicodeDecodeError, KeyError):
                continue

            filename = PurePosixPath(relative_path).name
            language = detect_language(filename)

            file_model = FileModel(
                project_id=project_id,
                path=relative_path,
                filename=filename,
                language=language,
                size_bytes=info.file_size,
                content=content,
            )
            db.add(file_model)
            file_count += 1

    await db.flush()

    # Clean up the zip file
    try:
        os.remove(zip_path)
    except OSError:
        pass

    return file_count
