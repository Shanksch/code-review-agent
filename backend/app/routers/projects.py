from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
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

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    ai_provider_config_id: Optional[UUID] = None

@router.patch("/projects/{project_id}", response_model=Project)
async def update_project(
    project_id: UUID,
    update_data: ProjectUpdate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    proj = await get_project(project_id, user_id, db)
    
    if update_data.name is not None:
        proj.name = update_data.name
    if update_data.description is not None:
        proj.description = update_data.description
    if update_data.ai_provider_config_id is not None:
        proj.ai_provider_config_id = update_data.ai_provider_config_id
        
    await db.commit()
    await db.refresh(proj)
    return proj

from fastapi import BackgroundTasks

@router.post("/projects/{project_id}/reviews")
async def run_project_review(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.ai.review_engine import run_review, process_review_in_background
    from app.models import ReviewScope
    
    try:
        # Launch the review synchronously for now (In production this would be background)
        review = await run_review(project_id, user_id, db, scope=ReviewScope.project)
        background_tasks.add_task(process_review_in_background, review.id)
        return {"message": "Review started successfully", "review_id": review.id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
