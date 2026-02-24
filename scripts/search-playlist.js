#!/usr/bin/env node
/**
 * Search transcripts and output as audio playlist with time-chunked URLs
 * Output format: [Episode | Start-End]URL#t=start,end
 * 
 * Usage: node scripts/search-playlist.js "search query"
 */

const fs = require('fs');
const path = require('path');
const { EPISODES_FILE, TRANSCRIPTIONS_DIR } = require('./paths');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Load episodes
const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));

/**
 * Generate embedding for semantic search
 */
async function generateEmbeddingWithOpenAI(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text.substring(0, 8000)
    })
  });
  const result = await response.json();
  return result.data[0].embedding;
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find episode by simplified ID (e.g., "finance_001")
 */
function getEpisodeBySimplifiedId(simplifiedId) {
  const match = simplifiedId.match(/^(\w+)_(\d+)$/);
  if (!match) return null;
  
  const [, topic, num] = match;
  const topicEpisodes = episodes.filter(ep => ep.topic === topic);
  return topicEpisodes[parseInt(num) - 1] || null;
}

/**
 * Parse timestamp to seconds
 */
function timestampToSeconds(ts) {
  const parts = ts.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Find natural start/end bounds for ~5 min chunk around match
 */
function findChunkBounds(episodeId, targetSecs, windowSecs = 300) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  if (!fs.existsSync(transcriptPath)) return null;
  
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --[^\]]+\]\s*([^\[]+)/g;
  const segments = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const secs = timestampToSeconds(match[1]);
    segments.push({
      ts: match[1],
      secs,
      text: match[2].trim()
    });
  }
  
  if (segments.length === 0) return null;
  
  const windowStart = Math.max(0, targetSecs - windowSecs / 2);
  const windowEnd = targetSecs + windowSecs / 2;
  
  // Find start: first segment that falls within window
  const startSeg = segments.find(m => m.secs >= windowStart - 30 && m.secs <= windowStart + 60);
  if (!startSeg) return null;
  
  // Find end: last segment within ~5 mins from start
  let endSeg = startSeg;
  for (const seg of segments) {
    if (seg.secs > startSeg.secs && seg.secs <= startSeg.secs + windowSecs + 30) {
      endSeg = seg;
    }
  }
  
  return {
    start: startSeg.ts,
    end: endSeg.ts,
    startSecs: startSeg.secs,
    endSecs: endSeg.secs
  };
}

/**
 * Search transcript for query and return best match position
 */
function searchTranscript(episodeId, query) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  if (!fs.existsSync(transcriptPath)) return null;
  
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const queryLower = query.toLowerCase();
  const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --[^\]]+\]\s*([^\[]+)/g;
  
  let match, bestMatch = null, bestScore = 0;
  
  while ((match = regex.exec(content)) !== null) {
    const text = match[2].trim().toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    const overlap = queryWords.filter(w => w.length > 2 && text.includes(w)).length;
    const score = overlap / queryWords.length;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        ts: match[1],
        secs: timestampToSeconds(match[1]),
        text: match[2].trim()
      };
    }
  }
  
  return bestScore > 0.3 ? bestMatch : null;
}

/**
 * Main search function
 */
async function searchPlaylist(query, topK = 10) {
  // Load embeddings
  const EMBEDDINGS_FILE = './metadata/embeddings/embeddings.json';
  const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = data.episodes || data;
  
  // If we have an API key, do semantic search
  let results;
  if (OPENAI_API_KEY) {
    const queryEmbedding = await generateEmbeddingWithOpenAI(query);
    results = embeddings.map(ep => ({
      episodeId: ep.episodeId,
      title: ep.title,
      similarity: cosineSimilarity(queryEmbedding, ep.embedding)
    })).sort((a, b) => b.similarity - a.similarity);
  } else {
    // Fallback to text search
    results = embeddings.map(ep => ({
      episodeId: ep.episodeId,
      title: ep.title,
      similarity: 0
    }));
  }
  
  // Build playlist
  const playlist = [];
  
  for (const result of results.slice(0, topK)) {
    const episode = getEpisodeBySimplifiedId(result.episodeId);
    if (!episode) continue;
    
    const match = searchTranscript(result.episodeId, query);
    if (!match) continue;
    
    const bounds = findChunkBounds(result.episodeId, match.secs);
    if (!bounds) continue;
    
    // Build time-anchored URL
    const startSecs = Math.floor(bounds.startSecs);
    const endSecs = Math.floor(bounds.endSecs);
    const urlWithTime = `${episode.audioUrl}#t=${startSecs},${endSecs}`;
    
    const startTime = formatTime(bounds.startSecs);
    const endTime = formatTime(bounds.endSecs);
    
    playlist.push({
      episodeId: result.episodeId,
      title: result.title,
      similarity: result.similarity,
      startTime,
      endTime,
      url: urlWithTime
    });
  }
  
  return playlist;
}

/**
 * Output as markdown playlist
 */
function outputPlaylist(playlist, query) {
  console.log(`🔍 Search: "${query}"`);
  console.log(`📻 Found ${playlist.length} clips\n`);
  
  for (const item of playlist) {
    const simPct = item.similarity > 0 ? `(${Math.round(item.similarity * 100)}%)` : '';
    console.log(`[${item.title} | ${item.startTime}-${item.endTime}]${item.url}`);
  }
}

/**
 * Output as simple list (for Telegram)
 */
function outputSimpleList(playlist, query) {
  console.log(`🔍 Search: "${query}"\n`);
  
  for (const item of playlist) {
    const simPct = item.similarity > 0 ? ` ${Math.round(item.similarity * 100)}%` : '';
    console.log(`${item.title} | ${item.startTime}-${item.endTime}`);
    console.log(item.url);
    console.log('');
  }
}

// Run
const query = process.argv.slice(2).join(' ');
if (!query) {
  console.log('Usage: node scripts/search-playlist.js "search query"');
  process.exit(1);
}

searchPlaylist(query).then(playlist => {
  outputPlaylist(playlist, query);
}).catch(console.error);
