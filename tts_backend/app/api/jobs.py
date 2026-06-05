import zipfile
import io
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.models.schemas import (
    CreateJobRequest, CreateJobResponse, JobResponse, AudioFileResponse
)
from app.storage.audio_store import download_audio
from app.workers.tts_tasks import generate_language_audio
from app.utils.redis_store import create_job, get_job

router = APIRouter(prefix="/jobs", tags=["jobs"])
logger = logging.getLogger(__name__)


def _to_response(job: dict) -> JobResponse:
    return JobResponse(
        id=job["id"],
        status=job["status"],
        voice_id=job["voice_id"],
        audio_format=job["audio_format"],
        created_at=datetime.fromisoformat(job["created_at"]),
        updated_at=datetime.fromisoformat(job["updated_at"]),
        audio_files=[
            AudioFileResponse(
                id=af["id"],
                language=af["language"],
                voice_id=af["voice_id"],
                file_url=af.get("file_url"),
                status=af["status"],
                error_message=af.get("error_message"),
                created_at=datetime.fromisoformat(af["created_at"]),
                updated_at=datetime.fromisoformat(af["updated_at"]),
            )
            for af in job.get("audio_files", [])
        ],
    )


# ── POST /jobs/create ─────────────────────────────────────────────────────────

@router.post("/create", response_model=CreateJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def create_job_endpoint(payload: CreateJobRequest):
    job, audio_files = await create_job(
        text=payload.text,
        voice_id=payload.voice_id,
        audio_format=payload.audio_format,
        languages=payload.languages,
    )

    for af in audio_files:
        generate_language_audio.delay(
            job_id=job["id"],
            audio_file_id=af["id"],
            source_text=payload.text,
            language=af["language"],
            voice_id=payload.voice_id,
            model_id=payload.model_id,
            audio_format=payload.audio_format,
        )

    logger.info("Job %s queued for %d language(s)", job["id"], len(audio_files))
    return CreateJobResponse(job_id=job["id"], status=job["status"])


# ── GET /jobs/{id} ────────────────────────────────────────────────────────────

@router.get("/{job_id}", response_model=JobResponse)
async def get_job_endpoint(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _to_response(job)


# ── GET /jobs/{id}/download ───────────────────────────────────────────────────

@router.get("/{job_id}/download")
async def download_job(job_id: str):
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    ready_files = [af for af in job.get("audio_files", []) if af["status"] == "complete" and af.get("file_url")]
    if not ready_files:
        raise HTTPException(status_code=409, detail="No completed audio files available yet")

    def generate_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            for af in ready_files:
                try:
                    audio_bytes = download_audio(af["file_url"])
                    ext = af["file_url"].rsplit(".", 1)[-1]
                    filename = f"{af['language']}_{af['voice_id']}.{ext}"
                    zf.writestr(filename, audio_bytes)
                except Exception as exc:
                    logger.error("Failed to include %s in ZIP: %s", af["file_url"], exc)
        buf.seek(0)
        yield from buf

    return StreamingResponse(
        generate_zip(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="translated_voices.zip"'},
    )


# ── GET /jobs/{id}/files/{language}/stream ────────────────────────────────────

@router.get("/{job_id}/files/{language}/stream")
async def stream_audio_file(job_id: str, language: str):
    """Stream a single completed audio file directly to the browser."""
    job = await get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    af = next(
        (f for f in job.get("audio_files", []) if f["language"] == language and f["status"] == "complete"),
        None,
    )
    if not af:
        raise HTTPException(status_code=404, detail="Audio file not found or not ready")

    try:
        audio_bytes = download_audio(af["file_url"])
    except Exception as exc:
        logger.error("Failed to fetch audio for streaming: %s", exc)
        raise HTTPException(status_code=502, detail="Could not retrieve audio file")

    ext = af["file_url"].rsplit(".", 1)[-1] if "." in af["file_url"] else "mp3"
    media_type = "audio/mpeg" if ext == "mp3" else f"audio/{ext}"

    return StreamingResponse(
        iter([audio_bytes]),
        media_type=media_type,
        headers={"Content-Disposition": f'inline; filename="{language}.{ext}"'},
    )
