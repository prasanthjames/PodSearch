# Architecture Design

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Web/iOS)                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   React/Next.js │  │  iOS (SwiftUI)  │  │  React Native   │ │
│  │   (MVP - Web)   │  │  (MVP2 - App)   │  │  (Future)       │ │
│  └────────┬────────┘  └─────────────────┘  └─────────────────┘ │
└───────────┼─────────────────────────────────────────────────────┘
            │ API Calls (REST/GraphQL)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Authentication | Rate Limiting | Request Routing        │    │
│  └─────────────────────────────────────────────────────────┘    │
└───────────┬─────────────────────────────────────────────────────┘
            │
    ┌───────┴───────┬─────────────────────┬─────────────────────┐
    ▼               ▼                     ▼                     ▼
┌─────────┐   ┌─────────┐          ┌─────────┐          ┌─────────┐
│  Auth   │   │  User   │          │Playlist │          │ Search  │
│ Service │   │ Service │          │ Service │          │ Service │
└─────────┘   └─────────┘          └─────────┘          └─────────┘
    │               │                     │                     │
    └───────────────┴─────────────────────┴─────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES LAYER                        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Catalog    │  │ Transcriber │  │   Embedding Generator   │  │
│  │  Ingestor   │  │  Service    │  │      Service            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Summarizer │  │ Relevance   │  │    Vector Database     │  │
│  │  Service    │  │  Scorer     │  │    (Pinecone/Weaviate)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ PostgreSQL  │  │    Redis    │  │   Object Storage        │  │
│  │ (Users,     │  │  (Cache,    │  │   (S3/MinIO)           │  │
│  │  Metadata)  │  │   Sessions) │  │   (Audio, Transcripts)  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Message Queue (RabbitMQ/Kafka)            ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL INTEGRATIONS                         │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Apple       │  │ OpenAI/     │  │   Transcription API     │  │
│  │ Podcasts    │  │ Claude API  │  │   (Whisper/DeepGram)   │  │
│  │ API         │  │ (Summaries) │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. Frontend (MVP - Web)

| Component | Technology | Purpose |
|-----------|------------|---------|
| Framework | Next.js 14 (React) | SSR, routing, API routes |
| UI Library | Tailwind CSS + shadcn/ui | Component library |
| State | Zustand | Client-side state |
| Auth | NextAuth.js | Authentication flow |
| Player | Howler.js | Audio playback |

**Architecture Pattern:** Client-side rendering with SSR for critical pages

---

### 2. API Gateway

**Technology:** Kong API Gateway or AWS API Gateway

**Responsibilities:**
- Request authentication/authorization
- Rate limiting (100 req/min per user)
- Request routing to microservices
- Request/response transformation
- Logging and monitoring

---

### 3. Authentication Service

**Technology:** Go or Node.js with JWT

**Endpoints:**
```
POST   /auth/register
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
PUT    /auth/me
DELETE /auth/me
```

**Security:**
- JWT tokens with 7-day expiry
- Refresh token rotation
- Password hashing: bcrypt (cost 12)
- 2FA optional (MVP2)

---

### 4. User Service

**Technology:** Node.js/Express or Go

**Endpoints:**
```
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
GET    /users/:id/topics
POST   /users/:id/topics
DELETE /users/:id/topics/:topicId
GET    /users/:id/playlists
POST   /users/:id/playlists
GET    /users/:id/history
```

**Database Schema:**
```sql
users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP
)

user_topics (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  topic_text TEXT,
  embedding VECTOR(384),
  created_at TIMESTAMP
)

user_playlists (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  name VARCHAR(255),
  created_at TIMESTAMP
)
```

---

### 5. Playlist Service

**Technology:** Node.js with Redis cache

**Endpoints:**
```
GET    /playlists/daily
GET    /playlists/:id
POST   /playlists/:id/bookmark
DELETE /playlists/:id/bookmark
GET    /playlists/:id/history
```

**Algorithm:**
```
1. Get user's saved topics with embeddings
2. Query vector DB for relevant episodes (top 100)
3. Score by: relevance * recency_weight
4. Filter: remove already listened, limit 1 per show
5. Return sorted by final score
```

**Recency Weight Formula:**
```
recency_weight = 1 / (1 + 0.1 * days_since_published)
```

---

### 6. Search Service

**Technology:** Go with custom ranking

**Endpoints:**
```
GET    /search?q=...
GET    /search/semantic?q=...
GET    /search/trending
GET    /search/suggestions?q=...
```

**Query Processing:**
```
1. Parse query → extract keywords, entities
2. Generate query embedding (all-MiniLM-L6-v2)
3. Hybrid search: BM25 + Vector similarity
4. Rerank with cross-encoder
5. Return top 20 results
```

**Ranking Formula:**
```
final_score = 0.4 * bm25_score + 0.6 * semantic_score + 0.1 * recency_boost
```

---

### 7. Catalog Ingestor

**Technology:** Python (fast for data processing)

**Pipeline:**
```
Apple Podcasts RSS → Parse Episodes → Deduplicate → Queue for Processing
                                                        │
                                                        ▼
                                              Transcriber Service
                                                        │
                                                        ▼
                                              Summarizer Service
                                                        │
                                                        ▼
                                              Embedding Generator
                                                        │
                                                        ▼
                                              Vector Database Index
```

**Daily Processing:**
- Fetch new episodes from Apple Podcasts API (every 6 hours)
- Filter by top 10 topics using keyword matching
- Queue 5,000-10,000 episodes/day for processing
- Processing time: ~2 minutes per episode (transcription)

---

### 8. Transcriber Service

**Technology:** Python with FastAPI

**Integration:**
- Primary: OpenAI Whisper (API or self-hosted)
- Alternative: DeepGram (real-time, cheaper)

**Output:**
```json
{
  "episode_id": "uuid",
  "transcript": "full text...",
  "duration_seconds": 1800,
  "language": "en",
  "confidence": 0.95
}
```

**Cost Estimate:** $0.006/minute (Whisper API)

---

### 9. Summarizer Service

**Technology:** Python with LLM API

**Integration:**
- OpenAI GPT-4o-mini (cost-effective)
- Fallback: Claude Haiku

**Prompt:**
```
Summarize this podcast transcript in exactly 3 sentences.
Focus on main topics, key insights, and actionable takeaways.
Use simple language.

Transcript:
{transcript}

Summary:
```

**Output:**
```json
{
  "summary": "...",
  "topics": ["finance", "investing", "stocks"],
  "entities": ["AAPL", "S&P 500", "Federal Reserve"]
}
```

---

### 10. Embedding Generator

**Technology:** Python with sentence-transformers

**Model:** all-MiniLM-L6-v2 (384 dimensions, fast, good quality)

**Pipeline:**
```python
# Generate embedding for episode summary + transcript chunks
embedding = model.encode(
    f"{summary} {transcript[:5000]}",  # Truncate for speed
    normalize_embeddings=True
)
```

---

### 11. Vector Database

**Technology:** Pinecone (managed) or Weaviate (self-hosted)

**Schema:**
```yaml
index_name: episodes
dimension: 384
metric: cosine
fields:
  - name: episode_id
  - name: show_id
  - name: published_at
  - name: topics
  - name: summary
  - name: embedding
```

**Query Example:**
```python
results = index.query(
    vector=user_embedding,
    filter={"topics": {"$in": user_topics}},
    top_k=100,
    include_metadata=True
)
```

---

## Data Flow Diagrams

### Episode Ingestion Flow
```
┌─────────────────┐
│ Apple Podcasts  │
│     API         │
└────────┬────────┘
         │ HTTP/RSS
         ▼
┌─────────────────┐     ┌─────────────┐
│   Catalog       │────▶│  Dedupe    │
│   Ingestor      │     │  Service   │
└─────────────────┘     └──────┬──────┘
                               │
                               ▼
┌─────────────────┐     ┌─────────────┐
│  Message Queue  │◀────│  Filter     │
│  (RabbitMQ)     │     │  by Topic  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Transcriber     │────▶│  Summarizer │
│ Service         │     │  Service    │
└─────────────────┘     └──────┬──────┘
                               │
                               ▼
┌─────────────────┐     ┌─────────────┐
│ Embedding       │◀────│  Topic      │
│ Generator       │     │  Extractor  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐
│  Vector DB      │
│  (Pinecone)     │
└─────────────────┘
```

### User Playlist Generation
```
┌─────────────────┐
│  User Request   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Get User Topics │────▶│  PostgreSQL │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Generate Query  │────▶│  Embedding  │
│ Embedding       │     │  Generator  │
└────────┬────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────┐
│ Vector DB       │────▶│  Relevance  │
│ Semantic Search │     │  Scorer     │
└────────┬────────┘     └──────┬──────┘
         │                     │
         │                     ▼
         │            ┌─────────────────┐
         │            │ Filter &        │
         │            │ Diversify       │
         │            └────────┬────────┘
         │                     │
         ▼                     ▼
┌─────────────────┐    ┌─────────────────┐
│   Redis Cache   │    │  Final Sort     │
│ (1-hour TTL)   │    │  (Score × Date) │
└────────┬────────┘    └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
            ┌─────────────────┐
            │   Return JSON   │
            └─────────────────┘
```

---

## Infrastructure

### MVP (Month 1-3)
| Service | Provider | Cost Estimate |
|---------|----------|---------------|
| Frontend | Vercel | $0-50/mo |
| Database | Supabase/Neon | $25/mo |
| Vector DB | Pinecone | $70/mo |
| APIs | AWS/GCP | $100/mo |
| AI/Transcription | OpenAI/Whisper | $500-1000/mo |

**Total: ~$750-1,200/month**

### Scale (Month 4-12)
- Kubernetes on AWS/GCP
- Self-hosted Whisper (GPU instance)
- Weaviate cluster for vectors
- Estimated: $3,000-5,000/month

---

## API Contracts

### Playlist Response
```json
{
  "data": {
    "episodes": [
      {
        "id": "uuid",
        "title": "Episode Title",
        "show_name": "Podcast Name",
        "show_id": "uuid",
        "summary": "3-sentence summary...",
        "published_at": "2026-02-18T10:00:00Z",
        "duration_minutes": 45,
        "audio_url": "https://...",
        "relevance_score": 0.92,
        "topics": ["finance", "crypto"]
      }
    ],
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 1500
    }
  }
}
```

### Search Response
```json
{
  "data": {
    "query": "bad bunny",
    "results": [
      {
        "episode_id": "uuid",
        "title": "...",
        "score": 0.95,
        "highlights": ["mentioning bad bunny's new album"]
      }
    ],
    "suggestions": ["bad bunny", "bad bunny nfl", "latin music"]
  }
}
```
