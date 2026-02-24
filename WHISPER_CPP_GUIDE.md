# whisper.cpp Integration Guide

## Overview

This document describes how to use whisper.cpp for offline batch transcription during beta testing.

## Setup

### 1. Clone and Build whisper.cpp

```bash
cd whisper.cpp
make
```

### 2. Download Model

```bash
# For English (smallest, fastest)
./models/download-ggml-model.sh base.en

# For all languages (larger, slower)
./models/download-ggml-model.sh small
```

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| base.en | 74 MB | Fastest | Good |
| small | 244 MB | Fast | Better |
| medium | 769 MB | Medium | Best |

### 3. Test Installation

```bash
./main -m models/ggml-base.en.bin -f test_audio.mp3 -otxt
```

---

## Usage

### Command Line

```bash
# Transcribe a single file
python3 scripts/transcribe_batch.py --url "https://example.com/episode.mp3" --output transcripts/

# Process CSV file (has 'url' column)
python3 scripts/transcribe_batch.py --input episodes.csv --output transcripts/

# Process with limit
python3 scripts/transcribe_batch.py --input episodes.csv --output transcripts/ --limit 100

# Keep audio files after transcription
python3 scripts/transcribe_batch.py --input episodes.csv --output transcripts/ --keep-audio
```

### CSV Format

```csv
url,audio_url,title
https://podcast.com/episode1.mp3,https://podcast.com/episode1.mp3,Episode 1
https://podcast.com/episode2.mp3,https://podcast.com/episode2.mp3,Episode 2
```

---

## Batch Processing Script

Located at: `scripts/transcribe_batch.py`

### Features

- Download audio from URL
- Transcribe using whisper.cpp
- Output as plain text (.txt)
- Auto-cleanup audio files (save storage)
- Progress logging
- Error handling

### Example Output

```
ℹ️  Processing [1/100]...
✅ Downloaded (45.2 MB)
ℹ️  Transcribing episode1.mp3...
✅ Transcript saved: episode1.txt
✅ Cleaned up episode1.mp3 (45.2 MB)

✅ Processing complete!
✅ Success: 95
❌ Failed: 5
Total: 100
```

---

## Storage Savings

| Content | Size | 10K Episodes |
|---------|------|---------------|
| Audio (MP3) | 50 MB each | 500 GB |
| Transcript (.txt) | 50 KB each | 500 MB |

**93% reduction in storage costs!**

---

## Performance

### Processing Time (base.en model)

| Hardware | Time per Episode |
|----------|------------------|
| M2 MacBook Air | ~15 min (30 min audio) |
| Intel i7 (8 cores) | ~20 min |
| M2 Pro MacBook | ~8 min |

### Estimated Batch Time (1000 episodes)

| Hardware | Total Time |
|----------|------------|
| M2 MacBook Air | ~10 days |
| M2 Pro MacBook | ~5 days |
| 8-core Linux server | ~7 days |

---

## Next: Faster Whisper (MVP)

After beta, migrate to Faster Whisper for production:

```python
from faster_whisper import Whisper

model = WhisperModel("medium", device="cuda")
segments, info = model.transcribe("episode.mp3", beam_size=5)
```

**Benefits:**
- 4x faster than original Whisper
- GPU-accelerated
- Same output format (compatible)
