from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID
import httpx
from pydantic import BaseModel

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models import AiProviderConfig

router = APIRouter(tags=["AI Providers"])

class ProviderConfigCreate(BaseModel):
    name: str
    base_url: str
    api_key: str
    model_name: str

@router.get("/ai-provider-configs", response_model=List[AiProviderConfig])
async def get_configs(
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(AiProviderConfig).where(AiProviderConfig.user_id == user_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/ai-provider-configs", response_model=AiProviderConfig)
async def create_config(
    config: ProviderConfigCreate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    new_config = AiProviderConfig(
        user_id=user_id,
        name=config.name,
        base_url=config.base_url,
        api_key=config.api_key,
        model_name=config.model_name
    )
    db.add(new_config)
    await db.commit()
    await db.refresh(new_config)
    return new_config

@router.post("/ai-provider-configs/{config_id}/test")
async def test_provider_connection(
    config_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await db.get(AiProviderConfig, config_id)
    if not config or config.user_id != user_id:
        raise HTTPException(status_code=404, detail="Config not found")
    
    # Trivial chat completion to test provider base URL and API key
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{config.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model_name,
                    "messages": [{"role": "user", "content": "Ping"}]
                },
                timeout=10.0
            )
            res.raise_for_status()
            return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")


@router.post("/ai-provider-configs/test")
async def test_new_provider_connection(
    config: ProviderConfigCreate,
    user_id: UUID = Depends(get_current_user)
):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{config.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json={
                    "model": config.model_name,
                    "messages": [{"role": "user", "content": "Ping"}]
                },
                timeout=10.0
            )
            res.raise_for_status()
            return {"status": "success", "message": "Connection successful"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection failed: {str(e)}")

class ProviderConfigUpdate(BaseModel):
    model_name: str

@router.patch("/ai-provider-configs/{config_id}", response_model=AiProviderConfig)
async def update_config(
    config_id: UUID,
    update_data: ProviderConfigUpdate,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await db.get(AiProviderConfig, config_id)
    if not config or config.user_id != user_id:
        raise HTTPException(status_code=404, detail="Config not found")
    
    config.model_name = update_data.model_name
    await db.commit()
    await db.refresh(config)
    return config

@router.get("/ai-provider-configs/{config_id}/models")
async def get_provider_models(
    config_id: UUID,
    user_id: UUID = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    config = await db.get(AiProviderConfig, config_id)
    if not config or config.user_id != user_id:
        raise HTTPException(status_code=404, detail="Config not found")
        
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(
                f"{config.base_url.rstrip('/')}/models",
                headers={"Authorization": f"Bearer {config.api_key}"},
                timeout=10.0
            )
            res.raise_for_status()
            data = res.json()
            models = [m["id"] for m in data.get("data", [])]
            return {"models": models}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch models: {str(e)}")
