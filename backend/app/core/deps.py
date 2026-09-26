from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from uuid import UUID
from app.core.config import get_settings

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UUID:
    settings = get_settings()
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=jwt.ALGORITHMS.SUPPORTED,
            options={"verify_aud": False, "verify_signature": False}
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
            )
        return UUID(user_id)
    except JWTError as e:
        alg_used = jwt.get_unverified_header(token).get("alg", "unknown")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"JWT Error: {str(e)}. Token alg: {alg_used}",
        )
