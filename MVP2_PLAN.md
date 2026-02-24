# PodSearch - MVP Roadmap

## MVP1: Core Search + Audio Playlist (Current)
**Goal:** User searches topic → gets audio playlist with time-chunked URLs

### Features
- [x] Download podcast episodes
- [x] Transcription with timestamps (whisper.cpp)
- [x] Text search on transcripts
- [x] Dynamic chunk sizing (±2-5 min windows)
- [x] Audio playback with time anchors (#t=start,end)
- [x] **Skip episode intro** (configurable, default 60-180 sec)
- [x] **Multiple chunks per episode** - find all matches, add all to playlist
- [x] **Build full playlist** - aggregate all matching chunks from all episodes
- [x] **Search results as audio playlist** - clickable URLs with natural start/end (~5 min chunks)
- [x] **Hourly scheduler** - download → transcribe → embed new episodes every hour
- [x] **Process 3 episodes per topic** - sorted by publish date + show rating
- [x] **Delete audio after transcription** - save storage
- [x] **Exponential backoff retries** - 1s, 2s, 4s, 8s, 16s
- [x] **DLQ (Dead Letter Queue)** - failed episodes tracked in `data/dlq.json`
- [x] **Permanent fail database** - `data/permanent-fail.json` for max-retries exceeded
- [ ] **Admin dashboard** - workflow stats, episode status, DLQ, permanent fails
- [ ] **Show rating filter** - only highly rated shows
- [ ] **Continuous playlist playback** ← NEXT

### Hourly Scheduler Workflow (REQUIRED)
1. **Fetch** new episodes from Apple Podcasts API
2. **Identify** 3 new episodes per topic (newest + highly rated)
3. **Process each episode:**
   - Download audio
   - Transcribe with timestamps
   - Generate embedding & save
   - Delete audio file (cleanup)
   - Delete transcription file (keep in embeddings)
4. **Error handling:**
   - Exponential backoff retries (1s, 2s, 4s, 8s, 16s)
   - Add failed episodes to DLQ
   - After max retries → move to permanent fail DB
5. **Admin Dashboard:** Show workflow stats per run

### Search Result Format (REQUIRED)
All search results MUST display as audio playlist with:
- Clickable URL with #t=start,end anchor
- Natural conversation start/end points (~5 min chunks)
- Format: `[Episode | Start-End]URL#t=start,end`

Example:
```
[finance_003 | 5:46-11:13]https://chrt.fm/track/...#t=346,673
[finance_001 | 27:29-32:56]https://chrt.fm/track/...#t=1649,1976
```

### Chunk Logic
- Skip intro: First 60-180 seconds (configurable)
- Multiple matches: Add each as separate chunk in playlist
- Dynamic window: ±2 min around each match
- Smart boundaries: Don't cut mid-sentence
- Playlist: Aggregate all chunks, sorted by timestamp

### Tech Stack
| Component | Implementation |
|-----------|----------------|
| Transcription | whisper.cpp (local) |
| Search | Text matching + embeddings |
| Embeddings | OpenAI (working!) |
| Storage | Local JSON |

---

## MVP2: Scale + Semantic Search
**Goal:** Better search + cloud storage

### Features
- [ ] Switch transcription to OpenAI Whisper API
- [ ] Set up Supabase project
- [ ] Configure pgvector for semantic search
- [ ] Migrate to Supabase database

### Tech Stack
| Component | Implementation |
|-----------|----------------|
| Transcription | OpenAI Whisper API |
| Embeddings | OpenAI text-embedding-3-small |
| Storage | Supabase (PostgreSQL) |
| Vector Search | Supabase pgvector |

---
*Updated: Feb 22, 2026*
