# BeeBuddy

An open-source, AI-powered beekeeping management platform.

## Features

- **Offline-first mobile app** — Record inspections in the field with no signal
- **AI-powered insights** — Get summaries, recommendations, and trend analysis (Phase 2)
- **Weather integration** — Location-based weather data for your apiaries
- **Task management** — Reminders and AI-suggested tasks
- **Cross-platform** — iOS, Android, and web via Expo

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native (Expo) + WatermelonDB |
| Backend | Python + FastAPI + SQLAlchemy + Celery |
| Database | PostgreSQL |
| Auth | Self-built JWT + OAuth2 social login (Google/Apple/Microsoft) |
| Cache | Redis |
| Storage | S3 (MinIO for local dev) |
| AI | Ollama (local) / OpenAI / Anthropic / Bedrock |

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- [nvidia-container-toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (for GPU acceleration)

### Quick Start

```bash
# Start everything
cd infra/docker
docker compose up -d

# First run pulls llama3.2:3b (~2GB)
docker logs -f beebuddy-ollama-init
```

This starts:

| Service | URL | Description |
|---------|-----|-------------|
| **API** | http://localhost:8000 | FastAPI backend |
| **API Docs** | http://localhost:8000/docs | Swagger UI |
| **PostgreSQL** | localhost:5432 | Database |
| **Redis** | localhost:6379 | Cache |
| **MinIO** | http://localhost:9001 | S3 storage (see `.env.example`) |
| **Ollama** | http://localhost:11434 | Local LLM with GPU |

### Mobile App (run locally)

```bash
cd apps/mobile
npm install
npm start
```

Then press `w` for web, `a` for Android, or `i` for iOS.

> Mobile runs locally (not in Docker) for better hot reload and device connectivity.

### Using Larger Local Models

With your GPU, you can use larger models:

```bash
# Pull a larger model
docker exec beebuddy-ollama ollama pull llama3.1:8b
docker exec beebuddy-ollama ollama pull qwen2.5:7b

# Update the API to use it
docker compose down
# Edit infra/docker/docker-compose.yml: LLM_MODEL=llama3.1:8b
docker compose up -d
```

### Switching to Cloud LLM Providers

Edit `apps/api/.env`:

```bash
# OpenAI
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...

# Anthropic
LLM_PROVIDER=anthropic
LLM_MODEL=claude-3-haiku-20240307
ANTHROPIC_API_KEY=sk-ant-...
```

Then restart: `docker compose restart api`

## Project Structure

```
BeeBuddy/
├── apps/
│   ├── api/              # FastAPI backend
│   │   ├── app/
│   │   │   ├── routers/  # API endpoints
│   │   │   ├── models/   # SQLAlchemy models
│   │   │   ├── schemas/  # Pydantic schemas
│   │   │   └── services/ # Business logic
│   │   └── tests/
│   │
│   └── mobile/           # Expo React Native app
│       ├── app/          # Expo Router screens
│       ├── components/
│       ├── services/     # API client
│       └── stores/       # Zustand stores
│
├── infra/
│   ├── docker/           # Docker Compose for local dev
│   └── terraform/        # Cloud infrastructure (planned -- provider TBD)
│
├── data/
│   └── knowledge_base/   # RAG corpus (planned -- Phase 2)
│
└── docs/
    └── openbeehive-plan.md  # Project plan
```

## Development Roadmap

- **Phase 1:** Core inspection logging with offline sync
- **Phase 2:** AI integration (RAG, chat, summaries)
- **Phase 3:** IoT sensors + advanced features
- **Phase 4:** Polish and launch

See [docs/openbeehive-plan.md](docs/openbeehive-plan.md) for full details.

## License

Apache-2.0
