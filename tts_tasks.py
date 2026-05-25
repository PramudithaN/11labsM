import logging
from uuid import UUID

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.workers.celery_app import celery_app
from app.models.db_models import AudioFile, AudioStatus, Job, JobStatus
from app.services.tts import generate_audio_sync, TTSError
from app.storage.s3 import upload_audio
from app.utils.cache import get_cached_key, set_cached_key
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_sync_url = settings.database_url.replace("+asyncpg", "+psycopg2")
_engine = create_engine(_sync_url, pool_size=5, max_overflow=10)
_SessionLocal = sessionmaker(bind=_engine)


def _get_session() -> Session:
    """Synchronous DB session for Celery workers."""
    return _SessionLocal()


@celery_app.task(
    bind=True,
    max_retries=5,
    default_retry_delay=5,
    name="tts_tasks.generate_language_audio",
)
def generate_language_audio(
    self,
    job_id: str,
    audio_file_id: str,
    translated_text: str,
    language: str,
    voice_id: str,
    audio_format: str,
):
    """
    Worker task: generate TTS audio for a single language.
    Called once per language per job, runs in parallel across workers.
    """
    db: Session = _get_session()
    try:
        # Mark as generating
        audio_file: AudioFile = db.query(AudioFile).filter_by(id=UUID(audio_file_id)).first()
        if not audio_file:
            logger.error("AudioFile %s not found", audio_file_id)
            return

        audio_file.status = AudioStatus.generating
        db.commit()

        # --- Cache check: skip ElevenLabs call if already generated ---
        cached_key = get_cached_key(translated_text, language, voice_id, audio_format)
        if cached_key:
            logger.info("Cache HIT for job=%s lang=%s, reusing key=%s", job_id, language, cached_key)
            audio_file.file_url = cached_key
            audio_file.status = AudioStatus.complete
            db.commit()
            _maybe_complete_job(db, job_id)
            return

        # --- Generate audio via ElevenLabs ---
        audio_bytes = generate_audio_sync(translated_text, voice_id, audio_format)

        # --- Upload to S3/MinIO ---
        s3_key = upload_audio(job_id, language, voice_id, audio_bytes, audio_format)

        # --- Cache result ---
        set_cached_key(translated_text, language, voice_id, audio_format, s3_key)

        # --- Update DB ---
        audio_file.file_url = s3_key
        audio_file.status = AudioStatus.complete
        db.commit()

        logger.info("Completed TTS: job=%s lang=%s key=%s", job_id, language, s3_key)
        _maybe_complete_job(db, job_id)

    except TTSError as exc:
        logger.warning("TTS error for job=%s lang=%s: %s — retrying", job_id, language, exc)
        _mark_audio_failed(db, audio_file_id, str(exc))
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

    except Exception as exc:
        logger.error("Unexpected error for job=%s lang=%s: %s", job_id, language, exc, exc_info=True)
        _mark_audio_failed(db, audio_file_id, str(exc))
        _maybe_complete_job(db, job_id)

    finally:
        db.close()


def _mark_audio_failed(db: Session, audio_file_id: str, error: str):
    af = db.query(AudioFile).filter_by(id=UUID(audio_file_id)).first()
    if af:
        af.status = AudioStatus.failed
        af.error_message = error[:500]
        db.commit()


def _maybe_complete_job(db: Session, job_id: str):
    """
    Check whether all AudioFile rows for this job are done (complete or failed).
    If so, update the Job status to ready or partial.
    """
    job: Job = db.query(Job).filter_by(id=UUID(job_id)).first()
    if not job:
        return

    audio_files = db.query(AudioFile).filter_by(job_id=UUID(job_id)).all()
    statuses = {af.status for af in audio_files}

    still_pending = {AudioStatus.pending, AudioStatus.generating} & statuses
    if still_pending:
        return  # not all done yet

    has_failure = AudioStatus.failed in statuses
    has_success = AudioStatus.complete in statuses

    if has_success and has_failure:
        job.status = JobStatus.partial
    elif has_success:
        job.status = JobStatus.ready
    else:
        job.status = JobStatus.failed

    db.commit()
    logger.info("Job %s finalised with status=%s", job_id, job.status)
