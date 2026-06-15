# 11LabsM

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![ElevenLabs](https://img.shields.io/badge/ElevenLabs-000000?style=for-the-badge&logo=elevenlabs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![AntDesign](https://img.shields.io/badge/Ant_Design-0170FE?style=for-the-badge&logo=ant-design&logoColor=white)

> A full-stack Neural Voice Synthesizer & Translator that converts text into multiple languages simultaneously and generates high-quality speech using ElevenLabs.

---

## 📸 Preview

**Home Page**
![Preview](frontend/public/Images/labsm.jpeg)

---

## 📖 About This Project

11LabsM is a powerful tool designed for content creators and developers who need to localize speech content quickly. By leveraging the ElevenLabs API and advanced translation providers (DeepL, Google, MyMemory), it can take a single input text and produce high-quality audio in dozens of languages at once.

The application features a modern distributed architecture with a React frontend, a FastAPI backend, and Celery workers for asynchronous processing. It employs a content-addressed caching system in Redis to minimize API costs and latency for repeat requests.

---

## ✨ Features

- 🌍 **Multilingual Translation** - Translate text into 17+ languages simultaneously including Spanish, French, German, and more.
- 🎙️ **Neural TTS Synthesis** - Generate ultra-realistic speech using ElevenLabs' industry-leading neural voices.
- ⚡ **Asynchronous Processing** - Long-running tasks are handled in the background with Celery and Redis.
- 📊 **Real-time Status Tracking** - Monitor the progress of each language's translation and synthesis in real-time.
- 💾 **Smart Caching** - SHA-256 content-addressed caching stores generated audio to reduce costs and latency.
- 🎧 **Audio Player & Downloads** - Stream generated audio directly in the browser or download a ZIP of all files.
- 🛠️ **Customizable Formats** - Support for multiple audio formats (MP3, PCM) and bitrates.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend Framework** | [React 18](https://reactjs.org/) |
| **Build Tool** | [Vite 5](https://vitejs.dev/) |
| **UI Components** | [Ant Design 6](https://ant.design/) |
| **API Backend** | [FastAPI 0.111](https://fastapi.tiangolo.com/) |
| **Task Queue** | [Celery 5.3](https://docs.celeryq.dev/) |
| **Relational Database** | [PostgreSQL 16](https://www.postgresql.org/) |
| **Cache / Broker** | [Redis 7.0](https://redis.io/) |
| **Object Storage** | [MinIO](https://min.io/) / [AWS S3](https://aws.amazon.com/s3/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) / [Python 3.10+](https://www.python.org/) |
| **Deployment** | [Vercel](https://vercel.com/) / [Render](https://render.com/) |

---

## 📋 Prerequisites

- **Node.js** v18 or higher
- **Python** 3.10 or higher
- **pnpm** (preferred) or npm
- **Docker & Docker Compose** (for local development)
- **ElevenLabs API Key**
- **DeepL or Google Translate API Key**

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd 11labsM
```

### 2. Set up Backend

```bash
cd tts_backend
cp .env.example .env
# Edit .env and fill in your API keys
```

### 3. Start Infrastructure with Docker

The easiest way to get started is using Docker Compose, which spins up the API, Worker, Redis, PostgreSQL, and MinIO.

```bash
# From the root directory
docker-compose -f tts_backend/docker-compose.yml up --build
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **API Docs**: `http://localhost:8000/docs`
- **MinIO Console**: `http://localhost:9001` (minioadmin / minioadmin)

---

## 📦 Available Scripts

### Frontend (`frontend/`)
| Command | Description |
|---------|-------------|
| `pnpm dev` | Starts the Vite development server |
| `pnpm build` | Builds the application for production |
| `pnpm preview` | Previews the production build locally |

### Backend (`tts_backend/`)
| Command | Description |
|---------|-------------|
| `uvicorn app.main:app --reload` | Starts the FastAPI server |
| `celery -A app.workers.celery_app worker --loglevel=info` | Starts the Celery worker |

---

## 📁 Project Structure

```
11labsM/
├── frontend/                  # React + Vite application
│   ├── src/
│   │   ├── api/               # API client and typed fetch wrappers
│   │   ├── components/        # UI components (JobForm, JobStatus)
│   │   └── types/             # TypeScript interfaces
│   └── public/                # Static assets & Images
├── tts_backend/               # FastAPI + Celery backend
│   ├── app/
│   │   ├── api/               # API routers (jobs, voices, models)
│   │   ├── models/            # SQLAlchemy & Pydantic models
│   │   ├── services/          # TTS and Translation logic
│   │   ├── storage/           # S3 / MinIO storage logic
│   │   ├── utils/             # Redis caching and DB utils
│   │   └── workers/           # Celery task definitions
│   ├── alembic/               # Database migrations
│   └── Dockerfile             # Backend container definition
├── render.yaml                # Render deployment configuration
├── docker-compose.yml         # Local development orchestration (links to backend)
└── PROJECT_ANALYSIS.md        # Technical architecture documentation
```

---

## 🙋‍♂️ Connect with Me

- **GitHub**: [github.com/PramudithaN](https://github.com/PramudithaN)
- **LinkedIn**: [linkedin.com/in/pramuditha-nadun-612b1b204](https://linkedin.com/in/pramuditha-nadun-612b1b204)
- **Email**: pramudithanadun@gmail.com

---

*Developed with ❤️ by Pramuditha Nadun.*
