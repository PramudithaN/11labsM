import zipfile
import io
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.db_models import Job, AudioFile, JobStatus, AudioStatus
from app.models.schemas import CreateJobRequest, CreateJobResponse, JobResponse
from app.services.translation import translate_to_all, TranslationError
from app.storage.s3 import download_audio, generate_presigned_url
from app.workers.tts_tasks import generate_language_audio
from app.utils.database import get_db

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


# ── POST /jobs/create ─────────────────────────────────────────────────────────

@router.post("/create", response_model=CreateJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_job(payload: CreateJobRequest, db: AsyncSession = Depends(get_db)):
    """
    1. Validate input
    2. Translate text into all requested languages
    3. Persist Job + AudioFile rows
    4. Enqueue one Celery TTS task per language
    """
    # --- Translation (synchronous dependency; must complete before queuing) ---
    try:
        language_map = await translate_to_all(payload.text, payload.languages)
    except TranslationError as exc:
        raise HTTPException(status_code=502, detail=f"Translation failed: {exc}")

    # --- Create Job row ---
    job = Job(
        source_text=payload.text,
        voice_id=payload.voice_id,
        audio_format=payload.audio_format,
        status=JobStatus.processing,
    )
    db.add(job)
    await db.flush()  # get job.id without committing

    # --- Create AudioFile rows, collect task params, then enqueue after commit ---
    task_params = []
    for lang, translated_text in language_map.items():
        audio_file = AudioFile(
            job_id=job.id,
            language=lang,
            voice_id=payload.voice_id,
        )
        db.add(audio_file)
        await db.flush()  # get audio_file.id
        task_params.append(dict(
            job_id=str(job.id),
            audio_file_id=str(audio_file.id),
            translated_text=translated_text,
            language=lang,
            voice_id=payload.voice_id,
            audio_format=payload.audio_format,
        ))

    await db.commit()  # commit before enqueuing so rows exist when workers query

    for params in task_params:
        generate_language_audio.delay(**params)

    logger.info("Job %s created with %d language(s)", job.id, len(language_map))
    return CreateJobResponse(job_id=job.id, status=job.status)


# ── GET /jobs/{id} ────────────────────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    """Poll job status and per-language audio status."""
    result = await db.execute(
        select(Job).where(Job.id == job_id).options(selectinload(Job.audio_files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ── GET /jobs/{id}/download ───────────────────────────────────────────────────

@router.get("/{job_id}/download")
async def download_job(job_id: UUID, db: AsyncSession = Depends(get_db)):
    """
    Stream a ZIP archive containing all successfully generated audio files.
    Raises 404 if the job is unknown, 409 if no audio is ready yet.
    """
    result = await db.execute(
        select(Job).where(Job.id == job_id).options(selectinload(Job.audio_files))
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ready_files = [af for af in job.audio_files if af.status == AudioStatus.complete and af.file_url]
    if not ready_files:
        raise HTTPException(status_code=409, detail="No completed audio files available yet")

    def generate_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for af in ready_files:
                try:
                    audio_bytes = download_audio(af.file_url)
                    ext = af.file_url.rsplit(".", 1)[-1]
                    filename = f"{af.language}_{af.voice_id}.{ext}"
                    zf.writestr(filename, audio_bytes)
                except Exception as exc:
                    logger.error("Failed to include %s in ZIP: %s", af.file_url, exc)
        buf.seek(0)
        yield from buf

    filename = f"translations_{job_id}.zip"
    return StreamingResponse(
        generate_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── GET /jobs/{id}/files/{language}/stream ────────────────────────────────────

@router.get("/{job_id}/files/{language}/stream")
async def stream_audio_file(job_id: UUID, language: str, db: AsyncSession = Depends(get_db)):
    """Stream a single completed audio file directly to the browser."""
    result = await db.execute(
        select(AudioFile).where(
            AudioFile.job_id == job_id,
            AudioFile.language == language,
            AudioFile.status == AudioStatus.complete,
        )
    )
    af = result.scalar_one_or_none()
    if not af:
        raise HTTPException(status_code=404, detail="Audio file not found or not ready")

    try:
        audio_bytes = download_audio(af.file_url)
    except Exception as exc:
        logger.error("Failed to fetch audio for streaming: %s", exc)
        raise HTTPException(status_code=502, detail="Could not retrieve audio file")

    ext = af.file_url.rsplit(".", 1)[-1] if "." in af.file_url else "mp3"
    media_type = "audio/mpeg" if ext == "mp3" else f"audio/{ext}"

    return StreamingResponse(
        iter([audio_bytes]),
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{language}.{ext}"'},
    )
