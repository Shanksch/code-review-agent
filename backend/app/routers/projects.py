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

@router.get("/projects/batch-stats")
async def get_projects_batch_stats(
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    from app.models import FileModel, Issue, Review

    # We need to get stats for all projects owned by this user
    # This can be done efficiently with group_by, but for simplicity we can do it per project
    # or with a few queries.
    
    projects_stmt = select(Project).where(Project.user_id == user_id)
    projects = (await db.execute(projects_stmt)).scalars().all()
    
    if not projects:
        return {}

    project_ids = [p.id for p in projects]

    # File counts
    files_stmt = select(FileModel.project_id, func.count(FileModel.id)).where(FileModel.project_id.in_(project_ids)).group_by(FileModel.project_id)
    file_counts = {pid: count for pid, count in (await db.execute(files_stmt)).all()}

    # Review counts and latest review date
    reviews_stmt = select(
        Review.project_id, 
        func.count(Review.id), 
        func.max(Review.created_at)
    ).where(Review.project_id.in_(project_ids)).group_by(Review.project_id)
    
    review_stats = {pid: {"count": count, "latest": latest} for pid, count, latest in (await db.execute(reviews_stmt)).all()}

    # Issue counts (total per project)
    issues_stmt = select(
        Review.project_id, 
        func.count(Issue.id)
    ).join(Issue, Issue.review_id == Review.id).where(Review.project_id.in_(project_ids)).group_by(Review.project_id)
    
    issue_counts = {pid: count for pid, count in (await db.execute(issues_stmt)).all()}
    
    # Severity breakdown (for dots on UI)
    severities_stmt = select(
        Review.project_id,
        Issue.severity,
        func.count(Issue.id)
    ).join(Issue, Issue.review_id == Review.id).where(Review.project_id.in_(project_ids)).group_by(Review.project_id, Issue.severity)
    
    severities_data = (await db.execute(severities_stmt)).all()
    severities = {}
    for pid, sev, count in severities_data:
        if pid not in severities:
            severities[pid] = {}
        sev_val = sev.value if hasattr(sev, 'value') else str(sev)
        severities[pid][sev_val] = count

    result = {}
    for pid in project_ids:
        result[str(pid)] = {
            "files": file_counts.get(pid, 0),
            "reviews": review_stats.get(pid, {}).get("count", 0),
            "last_reviewed": review_stats.get(pid, {}).get("latest"),
            "issues": issue_counts.get(pid, 0),
            "severities": severities.get(pid, {})
        }
        
    return result

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

@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    proj = await get_project(project_id, user_id, db)
    await db.delete(proj)
    await db.commit()
    return None


from fastapi import BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional

class ReviewCreate(BaseModel):
    scope: str = "project"
    file_ids: Optional[List[UUID]] = None
    template_types: List[str] = ["security"]
    depth: str = "standard"

@router.post("/projects/{project_id}/reviews")
async def run_project_review(
    project_id: UUID,
    options: ReviewCreate,
    background_tasks: BackgroundTasks,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.ai.review_engine import run_review, process_review_in_background
    from app.models import ReviewScope, TemplateType
    
    try:
        scope_enum = ReviewScope(options.scope)
        review_ids = []
        
        for template in options.template_types:
            try:
                template_enum = TemplateType(template)
            except ValueError:
                template_enum = TemplateType.security
                
            review = await run_review(
                project_id, 
                user_id, 
                db, 
                scope=scope_enum,
                file_ids=options.file_ids,
                template_type=template_enum
            )
            background_tasks.add_task(process_review_in_background, review.id, options.depth)
            review_ids.append(review.id)
            
        return {"message": "Reviews started successfully", "review_ids": review_ids}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/projects/{project_id}/reviews")
async def get_project_reviews(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models import Review
    stmt = (
        select(Review)
        .where(Review.project_id == project_id, Review.user_id == user_id)
        .order_by(Review.created_at.desc())
    )
    reviews = (await db.execute(stmt)).scalars().all()
    
    # Auto-fail stuck reviews (running for > 5 mins)
    from datetime import datetime, timedelta, timezone
    
    now = datetime.now(timezone.utc)
    stuck_found = False
    for r in reviews:
        # SQLite might return naive or aware depending on driver, so let's normalize
        created_at = r.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
            
        if r.status == "running" and (now - created_at) > timedelta(minutes=5):
            r.status = "failed"
            r.error_message = "Review timed out or server crashed."
            stuck_found = True
            
    if stuck_found:
        await db.commit()
    from app.models import Issue
    from sqlalchemy import func
    
    review_ids = [r.id for r in reviews]
    review_severities = {}
    review_issue_counts = {}
    
    if review_ids:
        sev_stmt = (
            select(Issue.review_id, Issue.severity, func.count(Issue.id))
            .where(Issue.review_id.in_(review_ids))
            .group_by(Issue.review_id, Issue.severity)
        )
        sev_results = (await db.execute(sev_stmt)).all()
        for rid, sev, count in sev_results:
            if rid not in review_severities:
                review_severities[rid] = {}
            sev_val = sev.value if hasattr(sev, 'value') else str(sev)
            review_severities[rid][sev_val] = count
            review_issue_counts[rid] = review_issue_counts.get(rid, 0) + count

    # Serialize manually to handle enum values
    review_list = []
    for r in reviews:
        review_list.append({
            "id": r.id,
            "project_id": r.project_id,
            "user_id": r.user_id,
            "scope": r.scope.value if hasattr(r.scope, "value") else str(r.scope),
            "template_type": r.template_type.value if hasattr(r.template_type, "value") else str(r.template_type),
            "summary": r.summary,
            "status": r.status,
            "error_message": r.error_message,
            "created_at": r.created_at,
            "issue_count": review_issue_counts.get(r.id, 0),
            "severities": review_severities.get(r.id, {})
        })
    return {"reviews": review_list}

@router.get("/projects/{project_id}/stats")
async def get_project_stats(
    project_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    from app.models import FileModel, Issue, Review
    
    file_count = (await db.execute(select(func.count(FileModel.id)).where(FileModel.project_id == project_id))).scalar()
    review_count = (await db.execute(select(func.count(Review.id)).where(Review.project_id == project_id))).scalar()
    
    # Total issues
    issue_stmt = (
        select(func.count(Issue.id))
        .join(Review, Review.id == Issue.review_id)
        .where(Review.project_id == project_id)
    )
    issue_count = (await db.execute(issue_stmt)).scalar()

    # Severity breakdown
    sev_stmt = (
        select(Issue.severity, func.count(Issue.id))
        .join(Review, Review.id == Issue.review_id)
        .where(Review.project_id == project_id)
        .group_by(Issue.severity)
    )
    sev_results = (await db.execute(sev_stmt)).all()
    severities = {sev.value if hasattr(sev, 'value') else str(sev): count for sev, count in sev_results}
    
    # Review coverage
    coverage_stmt = select(Review.template_type).where(Review.project_id == project_id).distinct()
    coverage_results = (await db.execute(coverage_stmt)).scalars().all()
    coverage = [c.value if hasattr(c, 'value') else str(c) for c in coverage_results]
    
    # Latest review
    latest_review_stmt = (
        select(Review)
        .where(Review.project_id == project_id)
        .order_by(Review.created_at.desc())
        .limit(1)
    )
    latest_review = (await db.execute(latest_review_stmt)).scalars().first()
    latest_review_data = None
    if latest_review:
        lr_issues_count = (await db.execute(select(func.count(Issue.id)).where(Issue.review_id == latest_review.id))).scalar()
        latest_review_data = {
            "id": latest_review.id,
            "created_at": latest_review.created_at,
            "status": latest_review.status,
            "issues_count": lr_issues_count or 0,
            "scope": latest_review.scope.value if hasattr(latest_review.scope, 'value') else str(latest_review.scope),
            "template": latest_review.template_type.value if hasattr(latest_review.template_type, 'value') else str(latest_review.template_type)
        }
        
    # AI Usage
    from app.models import Project, AiProviderConfig
    proj = await db.get(Project, project_id)
    ai_model = None
    if proj and proj.ai_provider_config_id:
        config = await db.get(AiProviderConfig, proj.ai_provider_config_id)
        if config:
            ai_model = config.model_name
            
    return {
        "total_files": file_count or 0,
        "total_reviews": review_count or 0,
        "total_issues": issue_count or 0,
        "total_lines": (file_count or 0) * 150, # Rough estimate for now
        "severities": severities,
        "coverage": coverage,
        "latest_review": latest_review_data,
        "ai_model": ai_model,
        "included_extensions": [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".c", ".cpp"],
        "excluded_patterns": ["node_modules/", ".git/", "dist/", "build/", "__pycache__/", "*.lock", "*.min.js"]
    }

@router.get("/projects/{project_id}/issues")
async def get_project_issues(
    project_id: UUID,
    path_prefix: Optional[str] = None,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models import Issue, Review, FileModel
    
    # We want issues from reviews that belong to this project
    # We can join Issue -> FileModel to filter by path_prefix if provided
    stmt = (
        select(Issue, FileModel)
        .join(Review, Review.id == Issue.review_id)
        .join(FileModel, FileModel.id == Issue.file_id)
        .where(Review.project_id == project_id)
    )
    
    if path_prefix:
        # Note: SQLite and Postgres both support LIKE, but path_prefix should be sanitized
        stmt = stmt.where(FileModel.path.startswith(path_prefix))
        
    stmt = stmt.order_by(Issue.created_at.desc())
    
    results = (await db.execute(stmt)).all()
    
    issues_list = []
    for issue, file_model in results:
        issue_dict = issue.dict()
        issue_dict['file_path'] = file_model.path
        issue_dict['file_name'] = file_model.filename
        issues_list.append(issue_dict)
        
    return {"issues": issues_list}


class ChatRequest(BaseModel):
    message: str
    history: list = []
    context: dict = {}

@router.post("/projects/{project_id}/chat")
async def chat_with_assistant(
    project_id: UUID,
    request: ChatRequest,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.services.ai.provider_client import ProviderClient
    from app.models import Project, FileModel
    
    # 1. Gather context
    system_prompt = "You are an elite AI code review assistant. Be extremely concise. Go straight to the answer without fluff. Do not offer pleasantries like 'Happy to help'."
    
    context_str = ""
    active_mode = request.context.get("activeMode")
    
    if request.context.get("issue") and active_mode in ("issue", None):
        issue = request.context["issue"]
        context_str += f"Selected Issue:\nTitle: {issue.get('title')}\nDescription: {issue.get('description')}\nRecommendation: {issue.get('recommendation')}\nEvidence: {issue.get('evidence')}\n\n"
        
    files_used = []
    
    if active_mode == "project":
        from app.models import Issue, Review
        stmt = (
            select(Issue, FileModel)
            .join(Review, Review.id == Issue.review_id)
            .join(FileModel, FileModel.id == Issue.file_id)
            .where(Review.project_id == project_id)
            .order_by(Issue.severity.desc()) # Put higher severity first
        )
        results = (await db.execute(stmt)).all()
        if results:
            context_str += "Known Project Issues:\n"
            for issue, file_model in results:
                context_str += f"- [{issue.severity.upper()}] {issue.title} in {file_model.path}:\n  Description: {issue.description}\n  Recommendation: {issue.recommendation}\n\n"
                if file_model.path not in files_used:
                    files_used.append(file_model.path)
        else:
            context_str += "No known issues found in this project.\n"
    elif request.context.get("fileId"):
        stmt = select(FileModel).where(FileModel.id == request.context["fileId"], FileModel.project_id == project_id)
        file_model = (await db.execute(stmt)).scalar_one_or_none()
        if file_model:
            context_str += f"Current File ({file_model.path}):\n```\n{file_model.content}\n```\n\n"
            files_used.append(file_model.path)
            
    if context_str:
        system_prompt += f"\n\nContext provided by the user's current view:\n{context_str}"
    
    # 2. Build messages
    messages = [{"role": "system", "content": system_prompt}]
    
    # Add history
    for msg in request.history:
        messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    # 3. Call AI
    stmt = select(Project).where(Project.id == project_id, Project.user_id == user_id)
    project = (await db.execute(stmt)).scalars().first()
    if not project or not project.ai_provider_config_id:
        raise HTTPException(status_code=400, detail="Project or Provider Config not found.")
        
    from app.models import AiProviderConfig
    config = await db.get(AiProviderConfig, project.ai_provider_config_id)
    if not config:
        raise HTTPException(status_code=400, detail="Provider Config not found in database.")

    client = ProviderClient(config)
    try:
        reply = await client.generate_chat(messages)
    finally:
        await client.close()
    
    return {"reply": reply, "files_used": files_used}

@router.post("/projects/{project_id}/issues/{issue_id}/suggest-fix")
async def suggest_issue_fix(
    project_id: UUID,
    issue_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from app.models import Issue, FileModel, Project, AiProviderConfig
    from app.services.ai.provider_client import ProviderClient

    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    file_model = await db.get(FileModel, issue.file_id)
    if not file_model or file_model.project_id != project_id:
        raise HTTPException(status_code=404, detail="File not found or mismatch")
        
    project = await db.get(Project, project_id)
    if not project or project.user_id != user_id or not project.ai_provider_config_id:
        raise HTTPException(status_code=400, detail="Project missing provider config")
        
    config = await db.get(AiProviderConfig, project.ai_provider_config_id)
    if not config:
        raise HTTPException(status_code=400, detail="Provider config not found")
        
    system_prompt = (
        "You are an elite code review AI. You are given an issue found in a file, along with the file's content. "
        "Your task is to provide the exact code changes needed to fix the issue. "
        "Output the fix ONLY as a code block. You can either provide a full replacement for a small function/block, or a standard unified diff. "
        "No pleasantries, no explanations, just the code fix."
    )
    
    user_prompt = f"""File Path: {file_model.path}
Issue Title: {issue.title}
Description: {issue.description}
Recommendation: {issue.recommendation}

File Content:
```
{file_model.content}
```

Please generate a fix for the described issue.
"""
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    client = ProviderClient(config)
    try:
        reply = await client.generate_chat(messages)
    finally:
        await client.close()
        
    return {"diff": reply}

