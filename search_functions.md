# PodSearch Scripts Documentation

## Overview

PodSearch is a podcast search and discovery system using semantic embeddings. All scripts use embeddings for search — **no audio downloading**.

---

## Search Scripts

### 1. `search.js` — Episode Search (No Time Slicing)

Search for episodes matching a query. Returns full episode URLs with metadata.

```bash
node scripts/search.js "finance"
node scripts/search.js "cartel" --urls
node scripts/search.js "mexico city" --limit 5 --json
```

**Options:**
- `--urls` — Show audio URLs
- `--limit=N` — Number of results (default: 10)
- `--json` — JSON output

**Output:** Episode title, show name, topic, match %, full audio URL (no time slicing)

---

### 2. `search-chunks.js` — Time-Sliced URLs

Generate time-sliced episode URLs using embeddings + metadata. Estimates chunk positions for natural boundaries.

```bash
node scripts/search-chunks.js "cartel"
node scripts/search-chunks.js "stock market" --duration=300
node scripts/search-chunks.js "mexico" --limit=5 --json
```

**Options:**
- `--duration=N` — Chunk length in seconds (default: 300 = 5 min)
- `--limit=N` — Number of results (default: 5)
- `--json` — JSON output

**Features:**
- Uses embeddings to find relevant episodes
- Estimates duration from metadata (episode duration field or description)
- Skips intro (45s) and outro (30s)
- Positions content in middle of chunk
- Returns URL with `#t=start,end` hash for podcast app support

**Output:** Episode + time-sliced URL (start-end)

---

### 3. `search-playlist.js` — Clickable Playlist

Build a clickable playlist from search results. Internally uses search-chunks logic.

```bash
node scripts/search-playlist.js "cartel"
node scripts/search-playlist.js "finance" --markdown
node scripts/search-playlist.js "mexico" --json
```

**Options:**
- `--duration=N` — Chunk length (default: 300s)
- `--limit=N` — Number of results (default: 5)
- `--markdown` — Markdown table format
- `--json` — JSON output

**Output:** Clickable URLs formatted as a playlist

---

## Data Pipeline Scripts

### 4. `fetch-episodes.js` — Fetch from Apple Podcasts

```bash
node scripts/fetch-episodes.js
```

Searches Apple Podcasts by predefined topics, saves to `data/episodes.json`.

---

### 5. `transcribe.js` — Transcribe Audio

```bash
node scripts/transcribe.js [episodeId]
```

Transcribes using OpenAI Whisper API. Saves to `data/transcriptions/{id}.txt` with timestamps.

---

### 6. `generate-embeddings.js` — Create Embeddings

```bash
node scripts/generate-embeddings.js
```

Generates semantic embeddings for all episodes. Saves to `metadata/embeddings/embeddings.json`.

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

## Quick Reference

| Script | Purpose | Audio Download? | Time Slicing? |
|--------|---------|-----------------|---------------|
| `search.js` | Find episodes, get URLs | ❌ | ❌ |
| `search-chunks.js` | Time-sliced URLs | ❌ | ✅ |
| `search-playlist.js` | Clickable playlist | ❌ | ✅ |

---

## Workflow

```bash
# 1. Fetch episodes
node scripts/fetch-episodes.js

# 2. Generate embeddings (required for search)
node scripts/generate-embeddings.js

# 3. Search episodes (full URLs)
node scripts/search.js "your query" --urls

# 4. Get time-sliced chunks
node scripts/search-chunks.js "your query"

# 5. Generate playlist
node scripts/search-playlist.js "your query" --markdown
```

---

## Requirements

- Node.js
- OpenAI API key (`OPENAI_API_KEY` in `.env`)
- macOS (optional, for `afplay`)
- ffmpeg (optional)
