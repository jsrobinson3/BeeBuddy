# BeeBuddy

An open-source, AI-powered beekeeping management platform.

## Features

- **Offline-first mobile app** — Record inspections in the field with no signal via WatermelonDB
- **Full beekeeping lifecycle** — Apiaries, hives, queens, inspections, treatments, harvests, events
- **Wizard-style data entry** — Multi-step forms with experience-level templates (beginner/intermediate/advanced)
- **Weather integration** — Current conditions, forecasts, and bee-friendly insights per apiary
- **Smart task management** — Hemisphere-aware cadences with automatic task generation via Celery Beat
- **Social login** — Google and Apple OAuth (native ID token verification)
- **User management** — Email verification, password reset, GDPR account deletion with 30-day grace period
- **Photo capture** — In-field photos with S3 presigned URL uploads
- **Error tracking** — Sentry integration for API, Celery workers, and React Native
- **Custom design system** — Hexagonal shape language, honey/forest palette, dark mode, WCAG AA accessible
- **AI-powered insights** — Summaries, recommendations, and trend analysis (Phase 2 — planned)
- **Cross-platform** — iOS, Android, and web via Expo

## Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | React Native (Expo SDK 54) + WatermelonDB + TanStack Query + Zustand |
| Backend | Python 3.11+ + FastAPI + SQLAlchemy 2.0 async + Celery + Pydantic v2 |
| Database | PostgreSQL 16 (UUIDs, JSONB, soft deletes) |
| Auth | Self-built JWT + Google/Apple OAuth (JWKS ID token verification) |
| Cache | Redis |
| Storage | S3-compatible (MinIO for local dev) |
| Email | SendGrid API |
| Monitoring | Sentry (API + Celery + React Native) |
| AI | Ollama (local) / OpenAI / Anthropic / Bedrock (Phase 2) |

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
│   ├── api/              # FastAPI backend (Python)
│   │   ├── app/
│   │   │   ├── auth/     # JWT + OAuth2 dependencies
│   │   │   ├── db/       # SQLAlchemy session + Alembic migrations
│   │   │   ├── models/   # SQLAlchemy 2.0 async models
│   │   │   ├── routers/  # API endpoints (thin handlers)
│   │   │   ├── schemas/  # Pydantic v2 request/response schemas
│   │   │   ├── services/ # Business logic (service layer)
│   │   │   ├── templates/# Email templates (Jinja2)
│   │   │   └── utils/    # Shared helpers
│   │   └── tests/
│   │
│   └── mobile/           # Expo React Native app (TypeScript)
│       ├── app/          # Expo Router file-based routes
│       │   ├── (auth)/   # Login, register, social login
│       │   └── (tabs)/   # Tab navigator (home, tasks, settings)
│       ├── components/   # Shared UI (HexIcon, CustomTabBar, GradientHeader, etc.)
│       │   └── illustrations/ # SVG illustration components
│       ├── database/     # WatermelonDB models + sync
│       ├── hooks/        # TanStack Query hooks (one per resource)
│       ├── services/     # API client + OAuth
│       ├── stores/       # Zustand stores (auth, theme, hiveSetup)
│       └── theme/        # Design tokens, themes, shared styles
│
├── infra/
│   └── docker/           # Docker Compose for local dev (Postgres, Redis, MinIO, Ollama)
│
├── docs/
│   ├── design-language.md    # Full design system spec
│   ├── oauth-setup.md        # Google & Apple OAuth setup guide
│   └── RandD/                # Research docs (datasets, UI research)
│
└── .claude/
    └── plans/            # Project plans and roadmaps
```

## Development Roadmap

### Phase 1: Foundation — NEARLY COMPLETE
Core inspection logging with offline sync, full CRUD for all beekeeping resources, wizard-style data entry, social login, user management, weather integration, and custom design system.

**Remaining:** CI/CD pipeline (GitHub Actions), cloud deployment, app store internal testing.

### Phase 2: AI Integration — NEXT
RAG knowledge base, LLM-powered chat, post-inspection AI summaries, natural language queries, AI-generated task suggestions, feedback system. Dataset research completed (see `docs/RandD/`).

### Phase 3: IoT + Advanced Features
TimescaleDB for time-series, MQTT sensor ingestion (BEEP-compatible), sensor dashboards, anomaly detection, brood pattern image analysis, community features.

### Phase 4: Polish + Scale
Harvest QR codes, PDF reports, multi-language, audio queen detection, predictive analytics, self-hosting guide, public launch.

See [.claude/plans/openbeehive-plan.md](.claude/plans/openbeehive-plan.md) for the full plan with completion status.

## License

Apache-2.0
