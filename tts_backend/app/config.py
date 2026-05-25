from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_base_url: str = "https://api.elevenlabs.io/v1"
    elevenlabs_model: str = "eleven_multilingual_v2"

    # Translation
    translation_provider: str = "deepl"  # "deepl" or "google"
    deepl_api_key: str = ""
    google_translate_api_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://user:password@localhost:5432/tts_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # S3 / MinIO
    s3_endpoint_url: str = ""  # blank = AWS; set to http://minio:9000 for Docker MinIO
    s3_public_endpoint_url: str = ""  # public URL for presigned URLs (e.g. http://localhost:9000)
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "tts-audio"
    s3_region: str = "us-east-1"

    # App
    app_env: str = "development"
    secret_key: str = "changeme"
    max_text_length: int = 5000
    max_languages_per_job: int = 20
    cors_origins: str = "http://localhost:3000,http://localhost:3002,http://localhost:3003"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
