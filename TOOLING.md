# Tooling & Tech Stack

## 1. Frontend

### MVP (Web App)

| Category | Tool | Reason |
|----------|------|--------|
| Framework | **Next.js 14** | SSR, App Router, API routes, great DX |
| Language | **TypeScript** | Type safety, maintainability |
| UI Library | **Tailwind CSS** | Rapid styling |
| Components | **shadcn/ui** | Accessible, copy-paste, customizable |
| State Management | **Zustand** | Simple, lightweight, no boilerplate |
| Forms | **React Hook Form + Zod** | Validation, performance |
| Auth | **NextAuth.js (v5)** | Flexible auth providers |
| Audio Player | **Howler.js** | Cross-browser audio |
| HTTP Client | **Axios** | Request handling, interceptors |
| Date Handling | **date-fns** | Lightweight date utilities |
| Icons | **Lucide React** | Clean, consistent icons |

### MVP2 (Mobile App)

| Category | Tool | Reason |
|----------|------|--------|
| Framework | **React Native** (Expo) | Code sharing (web + mobile), large ecosystem |
| Language | **TypeScript** | Shared with web frontend |
| Navigation | **React Navigation** | Native navigation |
| Audio | **expo-av** | Audio playback |
| Notifications | **Expo Notifications** | Push notifications |
| State | **Zustand** | Shared with web |
| Auth | **NextAuth** (shared) | Same auth as web |

---

## 2. Backend Services

### Language Selection

| Service | Language | Reason |
|---------|----------|--------|
| API Gateway | **Go** | Performance, low latency, concurrency |
| User Service | **Node.js/TypeScript** | Fast development, shared types |
| Playlist Service | **Go** | Performance, caching logic |
| Search Service | **Go** | Performance, low latency |
| Catalog Ingestor | **Python** | AI/ML ecosystem |
| Transcriber | **Python** | Whisper integration |
| Summarizer | **Python** | LLM API integration |

### Frameworks

| Category | Tool | Use Case |
|----------|------|----------|
| API Framework | **FastAPI** (Python) | AI services, async |
| API Framework | **Gin** (Go) | High-performance APIs |
| API Framework | **Express** (Node) | User service (if Node) |
| gRPC | **gRPC** | Microservice communication |
| GraphQL | **Apollo Server** | Flexible queries (optional) |

---

## 3. Database

### Primary Database

| Tool | **PostgreSQL** (Supabase/Neon) |
|------|--------------------------------|
| Why | Reliable, mature, JSON support, vector extension |

**Schema Tools:**
- **Prisma** (TypeScript) - ORM for Node.js
- **GORM** (Go) - ORM for Go
- **Alembic** (Python) - Database migrations

### Vector Database

| Tool | **Pinecone** (Managed) | **Weaviate** (Self-hosted) |
|------|------------------------|----------------------------|
| Why | Managed, scalable, fast | Open-source, self-hosted option |
| Cost | $70+/month | Infrastructure only |

### Cache

| Tool | **Redis** (Upstash/Redis Cloud) |
|------|----------------------------------|
| Why | Fast, flexible, supports pub/sub |
| Use | Session storage, API caching, rate limiting |

### Object Storage

| Tool | **AWS S3** | **MinIO** (Self-hosted) |
|------|------------|------------------------|
| Use | Audio files, transcripts, embeddings | Self-hosted alternative |

---

## 4. AI/ML Services

### Transcription - Two-Phase Approach

| Phase | Tool | Speed | Cost | Use Case |
|-------|------|-------|------|----------|
| **Beta** | **whisper.cpp** | ~2x real-time | **Free** | Offline batch processing |
| **MVP** | **Faster Whisper** | ~100x real-time | $0.50/hr GPU | Production scale |

#### whisper.cpp (Beta - Free)

| Aspect | Detail |
|--------|--------|
| Why | No API costs, runs on CPU |
| Model | ggml-base.en.bin (74 MB) |
| Output | .txt transcript files |
| Integration | Python subprocess wrapper |

```bash
# Download and run
./main -m models/ggml-base.en.bin -f episode.mp3 -otxt
```

#### Faster Whisper (MVP - GPU)

| Aspect | Detail |
|--------|--------|
| Why | 4x faster than original Whisper, GPU-accelerated |
| Model | medium (with CUDA) |
| Output | Structured JSON with timestamps |
| Hosting | GPU instance (g4dn.xlarge) |

```python
from faster_whisper import Whisper

model = WhisperModel("medium", device="cuda")
segments, info = model.transcribe("episode.mp3", beam_size=5)
```

#### Migration Path
```
Beta transcripts (whisper.cpp) → Re-transcribe with Faster Whisper → Same format ✓
```

### Summarization

| Tool | **OpenAI GPT-4o-mini** |
|------|------------------------|
| Why | Fast, cheap, good quality |
| Cost | $0.15/1M input tokens |
| Alternative | **Claude Haiku** (Anthropic) |

### Embeddings

| Tool | **sentence-transformers** |
|------|---------------------------|
| Model | all-MiniLM-L6-v2 |
| Why | Fast, 384 dimensions, good quality |
| Hosting | Self-hosted (CPU) |

**Alternative (Managed):**
- OpenAI text-embedding-3-small
- Cohere Embed v3

---

## 5. DevOps & Infrastructure

### Hosting

| Service | Provider | Use |
|---------|----------|-----|
| Frontend | **Vercel** | Next.js deployment |
| Backend | **Railway/Render** | Service hosting |
| Database | **Supabase** | PostgreSQL |
| Vector DB | **Pinecone** | Vector storage |
| Cache | **Upstash** | Redis |
| Storage | **AWS S3** | Object storage |

### CI/CD

| Tool | GitHub Actions |
|------|----------------|
| Why | Free for open source, integrated |
| Pipeline | Test → Build → Deploy |

**Workflows:**
- `ci.yml` - Run tests on PR
- `cd.yml` - Deploy on main branch

### Containerization

| Tool | **Docker** |
|------|------------|
| Why | Consistent environments |
| Orchestration | Docker Compose (dev), Kubernetes (prod) |

---

## 6. External APIs

### Podcast Data

| Source | **Apple Podcasts API** |
|--------|------------------------|
| Endpoint | https://itunes.apple.com/search |
| Data | Podcast shows, episodes, metadata |
| Rate Limit | ~20 requests/minute |

**Alternative:**
- Listen Notes API (paid, more data)
- Spotify Podcast API (MVP2)

### Authentication

| Provider | Setup |
|----------|-------|
| Google | Google Cloud Console |
| Apple | Apple Developer Portal |

---

## 7. Monitoring & Observability

| Tool | Use |
|------|-----|
| **LogRocket** | Frontend error tracking |
| **Sentry** | Backend error tracking |
| **Datadog** | APM, infrastructure monitoring |
| **Pingdom** | Uptime monitoring |

---

## 8. Development Tools

### Code Quality

| Tool | Purpose |
|------|---------|
| **ESLint** | TypeScript linting |
| **Prettier** | Code formatting |
| **Husky** | Git hooks |
| **commitlint** | Commit message standards |

### Testing

| Tool | Type |
|------|------|
| **Vitest** | Unit tests (JS/TS) |
| **Testing Library** | React component tests |
| **Playwright** | E2E tests |
| **Go test** | Go unit tests |
| **pytest** | Python tests |

### Design

| Tool | Use |
|------|-----|
| **Figma** | UI/UX design |
| **Excalidraw** | Diagrams |

---

## 9. Project Management

| Tool | Use |
|------|-----|
| **GitHub Issues** | Task tracking |
| **Linear** | Sprint planning (optional) |
| **Notion** | Documentation |

---

## 10. Cost Breakdown (MVP)

| Service | Monthly Cost | Notes |
|---------|---------------|-------|
| Vercel Pro | $20 | Team features |
| Supabase | $25 | Database |
| Pinecone | $70 | Vector DB |
| Upstash | $25 | Redis |
| AWS S3 | $10 | Storage |
| **Beta: whisper.cpp** | **$0** | **Free (CPU processing)** |
| **MVP: Faster Whisper GPU** | **$70** | **g4dn.xlarge instance** |
| GitHub Actions | $0 | CI/CD |
| **Beta Total** | **~$150/month** | |
| **MVP Total** | **~$220/month** | |

### Cost Optimization Strategies
1. **whisper.cpp (Beta):** Free, offline, CPU-based — no API costs
2. **Faster Whisper (MVP):** GPU instance ~$0.50/hr, only when processing
3. **Batch processing:** Run GPU overnight, shut down during day
4. **Cache transcriptions:** Never re-transcribe same episode
5. **Use smaller models:** all-MiniLM-L6-v2 for embeddings

---

## 11. Recommended Setup Commands

### Frontend
```bash
# Create Next.js app
npx create-next-app@latest PodSearch-web --typescript --tailwind --eslint
cd PodSearch-web

# Install dependencies
npm install zustand next-auth howler axios lucide-react date-fns clsx tailwind-merge react-hook-form @hookform/resolvers/zod zod

# Install dev dependencies
npm install -D @types/node @types/react @types/react-dom @types/howler eslint prettier
```

### Backend (Python Services)
```bash
# Create Python project
mkdir PodSearch-api
cd PodSearch-api
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn pydantic pydantic-settings
pip install openai sentence-transformers redis pika python-dotenv
pip install pytest pytest-asyncio httpx

# Install dev dependencies
pip install black isort mypy
```

### Infrastructure
```bash
# Docker setup
docker-compose.yml includes:
  - postgres
  - redis
  - minio (S3 alternative)
```

---

## 12. File Structure

```
PodSearch/
├── PodSearch-web/           # Next.js frontend
│   ├── src/
│   │   ├── app/                # App Router pages
│   │   ├── components/         # React components
│   │   ├── lib/               # Utilities
│   │   ├── hooks/             # Custom hooks
│   │   └── types/             # TypeScript types
│   ├── public/
│   └── package.json
│
├── PodSearch-api/           # Python backend
│   ├── services/
│   │   ├── catalog/           # Ingestion pipeline
│   │   ├── transcriber/       # Whisper integration
│   │   ├── summarizer/        # LLM integration
│   │   └── embedding/         # Vector generation
│   ├── api/                   # FastAPI endpoints
│   ├── models/                # Pydantic models
│   └── tests/
│
├── PodSearch-go/            # Go services
│   ├── cmd/
│   │   ├── auth-service/
│   │   ├── playlist-service/
│   │   └── search-service/
│   └── pkg/
│
├── infrastructure/
│   ├── docker/
│   ├── kubernetes/
│   └── terraform/
│
└── docs/
    ├── PROJECT_PLAN.md ✅
    ├── REQUIREMENTS.md ✅
    ├── ARCHITECTURE.md ✅
    ├── TOOLING.md (this file)
    └── ROADMAP.md
```
