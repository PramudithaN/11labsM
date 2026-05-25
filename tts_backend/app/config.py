from pydantic_settings import BaseSettings
from pydantic import field_validator
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

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # App
    app_env: str = "production"
    secret_key: str = "changeme"
    max_text_length: int = 5000
    max_languages_per_job: int = 20
    cors_origins: str = "http://localhost:3000,http://localhost:3002,http://localhost:3003"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # silently ignore unknown env vars (e.g. VITE_* frontend vars)


@lru_cache()
def get_settings() -> Settings:
    return Settings()
