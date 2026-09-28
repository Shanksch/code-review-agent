"""
FastAPI application entry point.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import ai_providers, projects, files, generators


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown lifecycle."""
    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(
    title="AI Code Review Assistant",
    description="Upload code, get AI-powered reviews with severity-colored navigation",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ──── Routers ────
app.include_router(ai_providers.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(generators.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}
