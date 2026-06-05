from pydantic import BaseModel, Field, field_validator
from typing import List, Optional
from datetime import datetime
from app.models.db_models import JobStatus, AudioStatus


# ── Request schemas ──────────────────────────────────────────────────────────

class CreateJobRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Source text to synthesise")
    languages: List[str] = Field(..., min_length=1, description="Target language codes, e.g. ['en','fr','es']")
    voice_id: str = Field(..., description="ElevenLabs voice ID")
    model_id: str = Field(default="eleven_multilingual_v2", description="ElevenLabs model ID")
    audio_format: str = Field(default="mp3_44100_128", description="ElevenLabs output format")

    @field_validator("languages")
    @classmethod
    def languages_not_empty(cls, v):
        cleaned = [lang.strip().lower() for lang in v if lang.strip()]
        if not cleaned:
            raise ValueError("At least one language must be provided")
        if len(cleaned) > 20:
            raise ValueError("Maximum 20 languages per job")
        return cleaned


class RenameFileRequest(BaseModel):
    language: str
    new_name: str = Field(..., min_length=1, max_length=128)


# ── Response schemas ─────────────────────────────────────────────────────────

class AudioFileResponse(BaseModel):
    id: str
    language: str
    voice_id: str
    file_url: Optional[str]
    status: AudioStatus
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class JobResponse(BaseModel):
    id: str
    status: JobStatus
    voice_id: str
    audio_format: str
    created_at: datetime
    updated_at: datetime
    audio_files: List[AudioFileResponse] = []

    model_config = {"from_attributes": True}


class CreateJobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str = "Job created and queued for processing"


class VoiceResponse(BaseModel):
    voice_id: str
    name: str
    preview_url: Optional[str]
    labels: dict = {}


class ModelResponse(BaseModel):
    model_id: str
    name: str
    description: Optional[str] = None
    can_do_text_to_speech: bool = True
    languages: list = []
