"""
Redis-backed job store — replaces PostgreSQL entirely.

Key layout:
  job:{job_id}          → JSON  job metadata (no audio_files)
  audio:{af_id}         → JSON  audio-file metadata
  job_files:{job_id}    → Redis list of audio_file_id strings
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
import redis

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

JOB_TTL = 86_400  # 24 hours


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Async helpers (FastAPI) ───────────────────────────────────────────────────

def _async_client() -> aioredis.Redis:
    return aioredis.from_url(settings.redis_url, decode_responses=True)


async def create_job(
    text: str, voice_id: str, audio_format: str, languages: list
) -> tuple[dict, list[dict]]:
    r = _async_client()
    job_id = str(uuid.uuid4())
    now = _now()

    audio_files: list[dict] = []
    af_ids: list[str] = []
    pipe = r.pipeline()

    for lang in languages:
        af_id = str(uuid.uuid4())
        af = {
            "id": af_id,
            "job_id": job_id,
            "language": lang,
            "voice_id": voice_id,
            "file_url": None,
            "status": "pending",
            "error_message": None,
            "created_at": now,
            "updated_at": now,
        }
        audio_files.append(af)
        af_ids.append(af_id)
        pipe.set(f"audio:{af_id}", json.dumps(af), ex=JOB_TTL)

    job = {
        "id": job_id,
        "status": "processing",
        "voice_id": voice_id,
        "audio_format": audio_format,
        "created_at": now,
        "updated_at": now,
    }
    pipe.set(f"job:{job_id}", json.dumps(job), ex=JOB_TTL)
    pipe.rpush(f"job_files:{job_id}", *af_ids)
    pipe.expire(f"job_files:{job_id}", JOB_TTL)
    await pipe.execute()
    await r.aclose()

    job["audio_files"] = audio_files
    return job, audio_files


async def get_job(job_id: str) -> Optional[dict]:
    r = _async_client()
    try:
        job_data = await r.get(f"job:{job_id}")
        if not job_data:
            return None
        job = json.loads(job_data)
        af_ids = await r.lrange(f"job_files:{job_id}", 0, -1)
        af_raw = await r.mget([f"audio:{aid}" for aid in af_ids]) if af_ids else []
        job["audio_files"] = [json.loads(d) for d in af_raw if d]
        return job
    finally:
        await r.aclose()


# ── Sync helpers (Celery workers) ─────────────────────────────────────────────

def _sync_client() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


def sync_update_audio_file(af_id: str, **updates) -> None:
    r = _sync_client()
    data = r.get(f"audio:{af_id}")
    if not data:
        logger.warning("audio:%s not found in Redis", af_id)
        return
    af = json.loads(data)
    af.update(updates)
    af["updated_at"] = _now()
    r.set(f"audio:{af_id}", json.dumps(af), ex=JOB_TTL)
    r.close()


def sync_maybe_complete_job(job_id: str) -> None:
    r = _sync_client()
    af_ids = r.lrange(f"job_files:{job_id}", 0, -1)
    if not af_ids:
        r.close()
        return

    af_raw = r.mget([f"audio:{aid}" for aid in af_ids])
    statuses = {json.loads(d)["status"] for d in af_raw if d}

    if {"pending", "generating"} & statuses:
        r.close()
        return  # still in progress

    has_failure = "failed" in statuses
    has_success = "complete" in statuses

    if has_success and has_failure:
        new_status = "partial"
    elif has_success:
        new_status = "ready"
    else:
        new_status = "failed"

    job_data = r.get(f"job:{job_id}")
    if job_data:
        job = json.loads(job_data)
        job["status"] = new_status
        job["updated_at"] = _now()
        r.set(f"job:{job_id}", json.dumps(job), ex=JOB_TTL)
        logger.info("Job %s → %s", job_id, new_status)
    r.close()
