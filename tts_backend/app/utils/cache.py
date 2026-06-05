import hashlib
import redis as redis_client
from app.config import get_settings

settings = get_settings()

_redis = redis_client.from_url(settings.redis_url, decode_responses=True)

CACHE_TTL = 60 * 60 * 24 * 7  # 7 days


def _cache_key(text: str, language: str, voice_id: str, audio_format: str, model_id: str = "eleven_multilingual_v2") -> str:
    payload = f"{text}|{language}|{voice_id}|{audio_format}|{model_id}"
    digest = hashlib.sha256(payload.encode()).hexdigest()
    return f"tts_cache:{digest}"


def get_cached_key(text: str, language: str, voice_id: str, audio_format: str, model_id: str = "eleven_multilingual_v2") -> str | None:
    """Return the S3 key if this exact (text, language, voice, format, model) was already generated."""
    return _redis.get(_cache_key(text, language, voice_id, audio_format, model_id))


def set_cached_key(text: str, language: str, voice_id: str, audio_format: str, model_id: str = "eleven_multilingual_v2", s3_key: str = ""):
    """Store the S3 key for a generated audio piece."""
    _redis.setex(_cache_key(text, language, voice_id, audio_format, model_id), CACHE_TTL, s3_key)
