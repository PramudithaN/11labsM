# Project Analysis: 11LabsM - Neural Voice Synthesizer & Translator

## Overview
11LabsM is a full-stack web application designed to translate text into multiple languages simultaneously and generate high-quality text-to-speech (TTS) audio using the ElevenLabs API. It handles long-running translation and synthesis tasks asynchronously, providing a real-time progress UI for users.

## Architecture
The application follows a modern distributed architecture:
- **Frontend**: A React single-page application (SPA) that manages user interactions, job submission, and real-time status polling.
- **API Backend**: A FastAPI server that handles HTTP requests, job creation, and serves generated audio.
- **Task Worker**: A Celery worker that executes the heavy lifting (translation and TTS synthesis) in the background.
- **Message Broker & Store**: Redis acts as the central hub, serving as the Celery broker, result store, and primary data persistence layer (replacing traditional RDBMS like PostgreSQL for jobs and audio metadata).

### Data Flow
1. **Submission**: User submits text, target languages, and voice selection via the frontend.
2. **Job Creation**: FastAPI creates a job record in Redis and dispatches Celery tasks for each language.
3. **Background Processing**:
   - Celery worker translates the text (DeepL, Google, or MyMemory).
   - Worker checks Redis cache for existing audio (content-addressed by text/lang/voice).
   - If cache miss, worker calls ElevenLabs API for TTS.
   - Generated audio bytes are stored in Redis (Base64 encoded).
4. **Polling & Preview**: Frontend polls the job status. Once complete, users can stream audio previews directly or download a ZIP of all files.

## Tech Stack

### Frontend
- **Framework**: React 18 (TypeScript)
- **Build Tool**: Vite 5
- **UI Library**: Ant Design 6
- **Styling**: Tailwind CSS (referenced in documentation)
- **API Communication**: Typed Fetch wrappers (housed in `src/api/client.ts`)

### Backend
- **Framework**: FastAPI 0.111
- **Asynchronous Tasks**: Celery 5.3
- **Primary Data Store**: Redis 5.0 (using custom logic in `redis_store.py`)
- **TTS Provider**: ElevenLabs (REST API)
- **Translation Providers**: DeepL, Google Translate, MyMemory
- **HTTP Client**: httpx (with `tenacity` for exponential backoff retries)

## Key Components & Files

### Backend (`tts_backend/app/`)
- `main.py`: Application entry point, CORS configuration, and router registration.
- `api/jobs.py`: Core endpoints for job management (create, poll, download, stream).
- `workers/tts_tasks.py`: The main Celery task logic for the translation/TTS pipeline.
- `services/tts.py`: Client for ElevenLabs with robust retry logic for rate limits.
- `utils/redis_store.py`: Implementation of the Redis-based persistence layer for jobs and audio metadata.
- `utils/cache.py`: SHA-256 content-addressed caching mechanism to minimize ElevenLabs API usage.

### Frontend (`frontend/src/`)
- `App.tsx`: Main layout orchestrating the two-column view (Form vs. Status).
- `components/JobForm.tsx`: Dynamic form for inputting text and selecting voices/languages.
- `components/JobStatus.tsx`: Real-time status tracker with waveform audio player and download options.
- `api/client.ts`: Centralized API client using TypeScript for end-to-end type safety.

## Infrastructure & Deployment
- **Local**: Managed via `docker-compose.yml` (API, Worker, Redis, plus legacy PostgreSQL/MinIO containers).
- **Deployment**:
  - Frontend: Vercel (with proxy rewrites for `/api/*`).
  - Backend: Render.com (Blueprint-based deployment for API, Worker, and Redis).

## Notable Patterns
- **Content-Addressed Caching**: Using SHA-256 hashes of input parameters to cache audio results for 7 days, significantly reducing costs and latency.
- **Surgical Redis Usage**: Eschewing a traditional DB for Redis to handle short-lived (24h) job state and audio data, optimizing for speed and simplicity in a high-concurrency environment.
- **Resilient API Integration**: Heavy use of `tenacity` to handle the volatility of third-party TTS and translation APIs.
