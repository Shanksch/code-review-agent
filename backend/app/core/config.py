import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    database_url: str = os.getenv("DATABASE_URL", "")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_jwt_secret: str = os.getenv("SUPABASE_JWT_SECRET", "")
    max_zip_size_bytes: int = 50 * 1024 * 1024  # 50MB
    max_file_size_bytes: int = 1 * 1024 * 1024   # 1MB
    
    class Config:
        env_file = ".env"

def get_settings():
    return Settings()
