import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, DateTime, ForeignKey, Text, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base, relationship
import enum

Base = declarative_base()


class JobStatus(str, enum.Enum):
    pending = "pending"
    translating = "translating"
    processing = "processing"
    ready = "ready"
    partial = "partial"       # some languages failed
    failed = "failed"


class AudioStatus(str, enum.Enum):
    pending = "pending"
    generating = "generating"
    complete = "complete"
    failed = "failed"


class Job(Base):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status = Column(SAEnum(JobStatus), default=JobStatus.pending, nullable=False)
    source_text = Column(Text, nullable=False)
    voice_id = Column(String(128), nullable=False)
    audio_format = Column(String(16), default="mp3_44100_128")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    audio_files = relationship("AudioFile", back_populates="job", cascade="all, delete-orphan")


class AudioFile(Base):
    __tablename__ = "audio_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    language = Column(String(16), nullable=False)   # e.g. "en", "fr"
    voice_id = Column(String(128), nullable=False)
    file_url = Column(Text, nullable=True)          # S3 key, populated after upload
    status = Column(SAEnum(AudioStatus), default=AudioStatus.pending, nullable=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    job = relationship("Job", back_populates="audio_files")
