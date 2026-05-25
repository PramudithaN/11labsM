import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import jobs, voices
from app.config import get_settings
from app.utils.database import init_db
from app.storage.s3 import ensure_bucket_exists

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TTS backend (env=%s)", settings.app_env)
    if settings.app_env == "development":
        await init_db()        # auto-create tables in dev; use Alembic in production
        ensure_bucket_exists() # create S3/MinIO bucket if missing
    yield
    logger.info("Shutting down TTS backend")


app = FastAPI(
    title="11LabsM_Translater",
    description="Translate text and generate speech in multiple languages via ElevenLabs.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # add your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(jobs.router)
app.include_router(voices.router)


# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )


@app.get("/health", tags=["meta"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
