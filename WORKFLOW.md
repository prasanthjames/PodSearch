# PodSearch Workflow Requirements

## Core Philosophy
- **Embeddings are generated ONLY from transcriptions**
- Episodes are processed **one at a time**, sequentially
- **Audio and transcription are deleted** after embedding is generated (not needed for search)

## Workflow Pipeline

### Step 1: Fetch (master-trigger)
- Runs daily at 5 AM
- Fetches episodes from Apple Podcasts based on TOPICS
- Adds new episodes to processing queue
- Only fetches NEW episodes (not already in queue)

### Step 2: Download
- Downloads audio file for episode
- One episode at a time

### Step 3: Transcribe
- Transcribes audio to text using Whisper
- Saves transcription with timestamps to data/transcriptions/{id}.txt

### Step 4: Generate Embedding
- Creates semantic embedding from transcription ONLY
- Skips if no valid transcription
- Saves to metadata/embeddings/embeddings.json

### Step 5: Cleanup
- Deletes audio file
- Deletes transcription file
- Not needed for search - only embedding vector is used

## Files Required

1. **master-trigger.js** - Daily at 5 AM, fetches new episodes by topic
2. **process-queue.js** - Sequential processor: download → transcribe → embed → cleanup
3. **scheduler-orchestrator.js** - Existing, manages the queue

## Admin Dashboard Stats After Full Run
- Topics: X episodes fetched
- Downloaded: 0 (all cleaned up)
- Transcribed: 0 (all cleaned up)
- Embeddings: N (where N = total episodes processed)
- Queue: 0 (all processed)

## Key Metrics
- Embeddings count = Total successfully processed episodes
- Audio/Transcription files should always be 0 after cleanup
- Queue shows pending episodes waiting to be processed
