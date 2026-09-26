from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models import Project

router = APIRouter(tags=["Projects"])

class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    ai_provider_config_id: UUID

@router.get("/projects", response_model=List[Project])
async def get_projects(
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.user_id == user_id).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/projects", response_model=Project)
async def create_project(
    proj: ProjectCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_proj = Project(
        user_id=user_id,
        name=proj.name,
        description=proj.description,
        ai_provider_config_id=proj.ai_provider_config_id
    )
    db.add(new_proj)
    await db.commit()
    await db.refresh(new_proj)
    return new_proj

@router.get("/projects/{project_id}", response_model=Project)
async def get_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    result = await db.execute(stmt)
    proj = result.scalars().first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj
