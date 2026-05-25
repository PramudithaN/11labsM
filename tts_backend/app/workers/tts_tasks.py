import logging

from app.workers.celery_app import celery_app
from app.services.tts import generate_audio_sync, TTSError
from app.services.translation import translate_sync, TranslationError
from app.storage.s3 import upload_audio
from app.utils.cache import get_cached_key, set_cached_key
from app.utils.redis_store import sync_update_audio_file, sync_maybe_complete_job

logger = logging.getLogger(__name__)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=5,
    name="tts_tasks.generate_language_audio",
)
def generate_language_audio(
    self,
    job_id: str,
    audio_file_id: str,
    source_text: str,
    language: str,
    voice_id: str,
    audio_format: str,
):
    import asyncio

    try:
        sync_update_audio_file(audio_file_id, status="generating")

        # Translate source text — sync call, no event loop overhead
        try:
            translated_text = translate_sync(source_text, language)
        except (TranslationError, Exception) as exc:
            logger.warning("Translation failed for lang=%s: %s", language, exc)
            sync_update_audio_file(audio_file_id, status="failed", error_message=f"Translation error: {exc}"[:500])
            sync_maybe_complete_job(job_id)
            return

        # Cache check — skip ElevenLabs call if already generated
        cached_key = get_cached_key(translated_text, language, voice_id, audio_format)
        if cached_key:
            logger.info("Cache HIT for job=%s lang=%s", job_id, language)
            sync_update_audio_file(audio_file_id, status="complete", file_url=cached_key)
            sync_maybe_complete_job(job_id)
            return

        audio_bytes = generate_audio_sync(translated_text, voice_id, audio_format)
        s3_key = upload_audio(job_id, language, voice_id, audio_bytes, audio_format)
        set_cached_key(translated_text, language, voice_id, audio_format, s3_key)

        sync_update_audio_file(audio_file_id, status="complete", file_url=s3_key)
        logger.info("Completed TTS: job=%s lang=%s key=%s", job_id, language, s3_key)
        sync_maybe_complete_job(job_id)

    except TTSError as exc:
        logger.warning("TTS error for job=%s lang=%s: %s — retrying", job_id, language, exc)
        sync_update_audio_file(audio_file_id, status="failed", error_message=str(exc)[:500])
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

    except Exception as exc:
        logger.error("Unexpected error for job=%s lang=%s: %s", job_id, language, exc, exc_info=True)
        sync_update_audio_file(audio_file_id, status="failed", error_message=str(exc)[:500])
        sync_maybe_complete_job(job_id)

