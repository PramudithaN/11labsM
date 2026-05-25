import httpx
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)
import logging
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


class TTSError(Exception):
    pass


class RateLimitError(TTSError):
    pass


def _raise_for_status(resp: httpx.Response):
    if resp.status_code == 429:
        raise RateLimitError("ElevenLabs rate limit hit")
    if resp.status_code >= 400:
        raise TTSError(f"ElevenLabs error {resp.status_code}: {resp.text}")


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((RateLimitError, httpx.TimeoutException, httpx.NetworkError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
async def generate_audio(text: str, voice_id: str, audio_format: str = "mp3_44100_128") -> bytes:
    """
    Call ElevenLabs TTS API and return raw audio bytes.
    Retries up to 5 times with exponential backoff on rate limits or network errors.
    """
    url = f"{settings.elevenlabs_base_url}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": settings.elevenlabs_model,
        "output_format": audio_format,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, headers=headers, json=payload)
        _raise_for_status(resp)
        return resp.content


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((RateLimitError, httpx.TimeoutException, httpx.NetworkError)),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def generate_audio_sync(text: str, voice_id: str, audio_format: str = "mp3_44100_128") -> bytes:
    """
    Synchronous TTS call for Celery workers — identical retry logic to the async version.
    Avoids asyncio.run() inside worker processes.
    """
    url = f"{settings.elevenlabs_base_url}/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": settings.elevenlabs_api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": settings.elevenlabs_model,
        "output_format": audio_format,
    }
    with httpx.Client(timeout=60) as client:
        resp = client.post(url, headers=headers, json=payload)
        _raise_for_status(resp)
        return resp.content


async def list_voices() -> list[dict]:
    """Fetch available voices from ElevenLabs."""
    url = f"{settings.elevenlabs_base_url}/voices"
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            url,
            headers={"xi-api-key": settings.elevenlabs_api_key},
        )
        resp.raise_for_status()
        return resp.json().get("voices", [])
