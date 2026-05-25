from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "tts_worker",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tts_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,               # re-queue if worker crashes mid-task
    worker_prefetch_multiplier=1,      # one task per worker at a time (fair distribution)
    task_track_started=True,
    task_soft_time_limit=120,          # warn after 2 min
    task_time_limit=180,               # kill after 3 min
    broker_connection_retry_on_startup=True,
)
