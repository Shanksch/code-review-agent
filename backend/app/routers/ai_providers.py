from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
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
    configs = result.scalars().all()
    for c in configs:
        if c.api_key and len(c.api_key) > 4:
            c.api_key = f"{c.api_key[:3]}...{c.api_key[-4:]}"
        elif c.api_key:
            c.api_key = "***"
    return configs

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
            config.last_tested_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
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
    name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    model_name: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    last_tested_at: Optional[datetime] = None

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
    
    if update_data.name is not None:
        config.name = update_data.name
    if update_data.base_url is not None:
        config.base_url = update_data.base_url
    if update_data.api_key is not None and "..." not in update_data.api_key:
        config.api_key = update_data.api_key
    if update_data.model_name is not None:
        config.model_name = update_data.model_name
    if update_data.temperature is not None:
        config.temperature = update_data.temperature
    if update_data.max_tokens is not None:
        config.max_tokens = update_data.max_tokens
    if update_data.last_tested_at is not None:
        config.last_tested_at = update_data.last_tested_at
    
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
            url = f"{config.base_url.rstrip('/')}/models"
            res = await client.get(
                url,
                headers={"Authorization": f"Bearer {config.api_key}"},
                timeout=10.0
            )
            res.raise_for_status()
            data = res.json()
            if isinstance(data, dict) and "data" in data:
                models_list = data["data"]
            elif isinstance(data, list):
                models_list = data
            else:
                models_list = []
                
            models = [m["id"] for m in models_list if "id" in m]
            # Fallback to 'name' or other field if 'id' is missing
            if not models:
                models = [m.get("name") or m.get("model") for m in models_list]
                models = [m for m in models if m]
                
            return {"models": models}
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch models: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch models: {str(e)}")
