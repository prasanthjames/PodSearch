# PodSearch Scripts Documentation

## Overview

PodSearch is a podcast search and discovery system using semantic embeddings. **Embeddings are generated ONLY from transcriptions** — that's the core workflow.

---

## Workflow Scripts

### 1. `master-trigger.js` — Daily at 5 AM
Fetches new episodes from Apple Podcasts based on TOPICS.

```bash
node scripts/master-trigger.js
# Cron: 0 5 * * *
```

### 2. `process-queue.js` — Sequential Processor
Processes ONE episode at a time: download → transcribe → embed → cleanup.

```bash
node scripts/process-queue.js
# Runs continuously until queue is empty
```

**Workflow:**
1. Download audio
2. Transcribe (Whisper API)
3. Generate embedding from transcription ONLY
4. Delete audio + transcription (not needed for search)
5. Repeat

---

## Search Scripts

### 3. `search.js` — Episode Search (No Time Slicing)

Search for episodes matching a query. Returns full episode URLs with metadata.

```bash
node scripts/search.js "finance"
node scripts/search.js "cartel" --urls
```

**Options:**
- `--urls` — Show audio URLs
- `--limit=N` — Number of results (default: 10)
- `--json` — JSON output

**Output:** Episode title, show name, topic, match %, full audio URL

---

### 2. `search-chunks.js` — Time-Sliced URLs

Generate time-sliced episode URLs using embeddings + transcription-based duration.

```bash
node scripts/search-chunks.js "cartel"
node scripts/search-chunks.js "stock market" --duration=300
```

**Options:**
- `--duration=N` — Chunk length in seconds (default: 300 = 5 min)
- `--limit=N` — Number of results (default: 5)
- `--json` — JSON output

---

### 3. `search-playlist.js` — Clickable Playlist

Build a clickable playlist from search results.

```bash
node scripts/search-playlist.js "cartel"
node scripts/search-playlist.js "finance" --markdown
```

---

## Data Pipeline Scripts

### 4. `fetch-episodes.js` — Fetch from Apple Podcasts

```bash
node scripts/fetch-episodes.js
```

Searches Apple Podcasts by topics in `TOPICS` array, saves to `data/episodes.json`.

---

### 5. `transcribe.js` — Transcribe Audio (REQUIRED)

```bash
node scripts/transcribe.js [episodeId]
```

**REQUIRED for embeddings.** Transcribes audio using OpenAI Whisper API.

- Saves to `data/transcriptions/{id}.txt` with timestamps
- **Transcription is required before embedding can be generated**

---

### 6. `generate-embeddings.js` — Create Embeddings from Transcriptions

```bash
node scripts/generate-embeddings.js
```

**IMPORTANT:** 
- Generates embeddings **ONLY from transcriptions**
- Skips episodes without valid transcriptions
- Won't generate from title/description alone
- Requires `transcribe.js` to run first

---

## Critical Workflow

```
1. fetch-episodes.js → episodes.json
                 ↓
2. transcribe.js   → data/transcriptions/*.txt
                 ↓
3. generate-embeddings.js → metadata/embeddings/embeddings.json
                 ↓
4. search.js / search-chunks.js / search-playlist.js
```

**Order matters:** You must transcribe episodes before generating embeddings. Embeddings require transcription text for semantic search to work properly.

---

## Supporting Files

### `paths.js` — Path Configuration

```javascript
{
  BASE_DIR,
  DATA_DIR,
  AUDIO_DIR,
  TRANSCRIPTIONS_DIR,
  METADATA_DIR,
  EMBEDDINGS_DIR,
  EPISODES_FILE,
  EMBEDDINGS_FILE
}
```

---

## Requirements

- Node.js
- OpenAI API key (`OPENAI_API_KEY` in `.env`)
- Episodes must be transcribed before embeddings can be generated
