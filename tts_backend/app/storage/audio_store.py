"""Redis-based audio storage. Audio bytes are base64-encoded and stored with a 24h TTL."""
import base64
import logging

import redis as _redis

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

_PREFIX = "audio_data:"
_TTL = 86_400  # 24 hours


def _client(decode_responses: bool = False):
    return _redis.from_url(settings.redis_url, decode_responses=decode_responses)


def upload_audio(job_id: str, language: str, voice_id: str, audio_bytes: bytes, audio_format: str = "mp3_44100_128") -> str:
    """Store audio bytes in Redis. Returns a key used to retrieve them later."""
    ext = "mp3" if "mp3" in audio_format else "wav"
    key = f"{job_id}/{language}_{voice_id}.{ext}"
    r = _client()
    r.set(f"{_PREFIX}{key}", base64.b64encode(audio_bytes), ex=_TTL)
    r.close()
    logger.info("Stored audio in Redis: %s", key)
    return key


def download_audio(key: str) -> bytes:
    """Retrieve audio bytes from Redis by key."""
    r = _client()
    data = r.get(f"{_PREFIX}{key}")
    r.close()
    if not data:
        raise FileNotFoundError(f"Audio not found (key={key}). It may have expired.")
    return base64.b64decode(data)
