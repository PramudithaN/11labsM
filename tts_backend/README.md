# Multilingual TTS Platform — Backend

FastAPI + Celery + Redis + PostgreSQL + S3/MinIO + ElevenLabs

---

## Quick start (Docker)

```bash
cp .env.example .env
# Fill in ELEVENLABS_API_KEY, DEEPL_API_KEY or GOOGLE_TRANSLATE_API_KEY

docker compose up --build
```

Services:
- API:          http://localhost:8000
- Swagger docs: http://localhost:8000/docs
- MinIO console: http://localhost:9001  (minioadmin / minioadmin)

---

## Local development (without Docker)

### 1. Install dependencies
```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Start infrastructure
```bash
# PostgreSQL, Redis, and MinIO — use docker compose for just the infra:
docker compose up db redis minio -d
```

### 3. Set environment variables
```bash
cp .env.example .env
# Edit .env with your API keys and local connection strings
```

### 4. Run the API
```bash
uvicorn app.main:app --reload
```

### 5. Run the Celery worker (separate terminal)
```bash
celery -A app.workers.celery_app worker --loglevel=info --concurrency=4
```

---

## API reference

### POST /jobs/create
Create a new TTS job.

```json
{
  "text": "Hello, world!",
  "languages": ["fr", "es", "de"],
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "audio_format": "mp3_44100_128"
}
```

Response `202 Accepted`:
```json
{ "job_id": "uuid", "status": "processing" }
```

### GET /jobs/{job_id}
Poll job and per-language status.

### GET /jobs/{job_id}/download
Stream a ZIP file with all completed audio files.

### GET /jobs/{job_id}/files/{language}/url
Get a pre-signed S3 URL for a single language file.

### GET /voices/
List all available ElevenLabs voices.

### GET /health
Health check.

---

## Project layout

```
app/
├── api/
│   ├── jobs.py          # Job creation, status, download endpoints
│   └── voices.py        # Voice listing endpoint
├── models/
│   ├── db_models.py     # SQLAlchemy ORM models (Job, AudioFile)
│   └── schemas.py       # Pydantic request/response schemas
├── services/
│   ├── translation.py   # DeepL / Google Translate integration
│   └── tts.py           # ElevenLabs TTS API client
├── storage/
│   └── s3.py            # S3 / MinIO upload, download, presigned URLs
├── workers/
│   ├── celery_app.py    # Celery app and config
│   └── tts_tasks.py     # Per-language TTS Celery task
├── utils/
│   ├── cache.py         # Redis-based TTS deduplication cache
│   └── database.py      # Async + sync SQLAlchemy sessions
├── config.py            # Pydantic settings (reads .env)
└── main.py              # FastAPI app, middleware, lifespan
```

---

## Database migrations (production)

```bash
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs API key |
| `TRANSLATION_PROVIDER` | ✅ | `deepl` or `google` |
| `DEEPL_API_KEY` | if DeepL | DeepL auth key |
| `GOOGLE_TRANSLATE_API_KEY` | if Google | Google Translate key |
| `DATABASE_URL` | ✅ | PostgreSQL async URL |
| `REDIS_URL` | ✅ | Redis connection URL |
| `S3_ENDPOINT_URL` | MinIO only | Leave blank for AWS S3 |
| `S3_ACCESS_KEY` | ✅ | S3 / MinIO access key |
| `S3_SECRET_KEY` | ✅ | S3 / MinIO secret key |
| `S3_BUCKET` | ✅ | Bucket name |
