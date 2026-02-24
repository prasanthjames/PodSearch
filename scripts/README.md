# Tell Me More - Backend Scripts

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy env and add your OpenAI key
cp .env.example .env
# Edit .env and add OPENAI_API_KEY

# 3. Fetch episodes for topics
npm run fetch

# 4. Transcribe (requires audio download - may take time)
npm run transcribe

# 5. Generate embeddings
npm run embed

# 6. Search!
npm run search -- "finance"
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run fetch` | Fetch episodes from Apple Podcasts |
| `npm run transcribe` | Transcribe audio to text |
| `npm run embed` | Generate semantic embeddings |
| `npm run search -- "query"` | Search episodes |

## Topics

Currently configured:
- Finance
- Personal Improvement  
- Mexico City

## Data Flow

```
Apple Podcasts API → fetch-episodes.js → episodes.json
        ↓
    episodes.json → transcribe.js → transcripts/*.txt
        ↓
    transcripts → generate-embeddings.js → embeddings.json
        ↓
    embeddings.json + query → search.js → results
```

## Requirements

- Node.js 18+
- OpenAI API key (for embeddings + transcription)
- Internet connection (to fetch from Apple Podcasts)

## Files

```
tell-me-more/
├── prisma/
│   └── schema.prisma          # Database schema
├── scripts/
│   ├── fetch-episodes.js      # Fetch from Apple Podcasts
│   ├── transcribe.js          # Transcribe audio
│   ├── generate-embeddings.js # Create vectors
│   ├── search.js              # Search CLI
│   └── data/                  # Generated data
├── package.json
├── .env.example
└── README.md
```

## Notes

- Transcriptions can take a while (depends on audio length)
- OpenAI API has costs (~$0.006/1k chars for embeddings)
- For production: use Supabase + pgvector for vector storage
