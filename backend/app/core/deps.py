from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from uuid import UUID
from app.core.config import get_settings
import urllib.request
import json
from functools import lru_cache

@lru_cache()
def get_supabase_jwks(supabase_url: str):
    """Fetch the JSON Web Key Set (JWKS) from Supabase to verify ECC/RSA signatures."""
    jwks_url = f"{supabase_url}/auth/v1/.well-known/jwks.json"
    try:
        with urllib.request.urlopen(jwks_url) as response:
            return json.loads(response.read().decode())
    except Exception as e:
        print(f"Failed to fetch JWKS: {e}")
        return None

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UUID:
    settings = get_settings()
    token = credentials.credentials
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
        
        # If algorithm is ES256 (ECC), we need the public keys from JWKS
        if alg == "ES256":
            key = get_supabase_jwks(settings.supabase_url)
            if not key:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch JWKS for ES256 validation"
                )
        else:
            key = settings.supabase_jwt_secret

        payload = jwt.decode(
            token,
            key,
            algorithms=["HS256", "ES256"],
            options={"verify_aud": False, "verify_signature": True}
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
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}"
        )
