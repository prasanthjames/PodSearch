#!/usr/bin/env node
/**
 * Search transcripts with timestamps and play matching segment from streaming URL
 * Usage: node scripts/search-and-play.js "search query"
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { EPISODES_FILE, TRANSCRIPTIONS_DIR } = require('./paths');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Load episodes
const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));

/**
 * Generate embedding for query
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
 * Parse timestamp to seconds
 */
function timestampToSeconds(ts) {
  const parts = ts.split(':');
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

/**
 * Search transcript file for matching text
 */
function searchTranscript(episodeId, query) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  if (!fs.existsSync(transcriptPath)) return null;
  
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const queryLower = query.toLowerCase();
  
  // Parse timestamps: [00:00:00.000 --> 00:00:06.240]
  const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --[^\]]+\]\s*([^\[]+)/g;
  let match;
  let bestMatch = null;
  let bestScore = 0;
  
  while ((match = regex.exec(content)) !== null) {
    const timestamp = match[1];
    const text = match[2].trim().toLowerCase();
    
    // Simple word overlap scoring
    const queryWords = queryLower.split(/\s+/);
    const textWords = text.split(/\s+/);
    const overlap = queryWords.filter(w => w.length > 2 && text.includes(w)).length;
    const score = overlap / queryWords.length;
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { timestamp, text: match[2].trim(), seconds: timestampToSeconds(timestamp) };
    }
  }
  
  return bestScore > 0.3 ? bestMatch : null;
}

/**
 * Get episode by externalId from episodes.json
 * Handles both complex IDs and simplified topic IDs
 */
function getEpisodeById(episodeId) {
  // Direct match
  let episode = episodes.find(ep => ep.externalId === episodeId);
  
  if (!episode) {
    // Try matching by topic-based ID (e.g., "finance_001")
    // Extract topic and number from episodeId
    const match = episodeId.match(/^(\w+)_(\d+)$/);
    if (match) {
      const [, topic, num] = match;
      // Find episode with this topic
      const topicEpisodes = episodes.filter(ep => ep.topic === topic);
      if (topicEpisodes[num - 1]) {
        episode = topicEpisodes[num - 1];
      }
    }
  }
  
  return episode;
}

/**
 * Play audio stream with start time using stream-mp3 (Node.js)
 * or direct curl pipe to afplay
 */
async function playFromStream(url, startSeconds, duration = 30) {
  const endSeconds = startSeconds + duration;
  
  console.log(`🎵 Streaming from ${url}`);
  console.log(`   Start: ${startSeconds}s, End: ${endSeconds}s`);
  
  // Use curl with Range header to stream specific portion
  // Then pipe to afplay
  return new Promise((resolve, reject) => {
    const curlCmd = `curl -s -H "Range: bytes=${startSeconds * 16000}-${endSeconds * 16000}" "${url}" | afplay -`;
    
    exec(curlCmd, (err, stdout, stderr) => {
      if (err) {
        console.log(`Note: curl range may not work for all servers, playing from start`);
        // Fallback: just play
        exec(`curl -s "${url}" | afplay -`, (err2) => {
          if (err2) reject(err2);
          else resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Main search and play
 */
async function searchAndPlay(query, topK = 3) {
  // Load embeddings
  const EMBEDDINGS_FILE = './metadata/embeddings/embeddings.json';
  const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = data.episodes || data;
  
  // Get query embedding
  const queryEmbedding = await generateEmbeddingWithOpenAI(query);
  
  // Find top episodes
  const results = embeddings.map(ep => ({
    episodeId: ep.episodeId,
    title: ep.title,
    similarity: cosineSimilarity(queryEmbedding, ep.embedding)
  })).sort((a, b) => b.similarity - a.similarity).slice(0, topK);
  
  console.log(`🔍 Search: "${query}"\n`);
  console.log(`Top ${topK} episodes:`);
  results.forEach((r, i) => console.log(`  ${i+1}. ${r.title} (${(r.similarity*100).toFixed(1)}%)`));
  
  // Search each transcript for matching text
  console.log(`\n📝 Transcript matches:`);
  for (const result of results) {
    const match = searchTranscript(result.episodeId, query);
    if (match) {
      console.log(`\n  ▶️ ${result.title}`);
      console.log(`     Time: ${match.timestamp} (${match.seconds}s)`);
      console.log(`     Text: "${match.text.substring(0, 100)}..."`);
      
      // Get episode with audio URL
      const episode = getEpisodeById(result.episodeId);
      if (episode && episode.audioUrl) {
        console.log(`\n🎵 Playing from ${match.timestamp}...`);
        await playFromStream(episode.audioUrl, match.seconds);
        return;
      } else if (episode) {
        console.log(`  ⚠️ No audio URL for episode`);
      }
    }
  }
  
  console.log(`\n❌ No matching audio found`);
}

// Run
const query = process.argv.slice(2).join(' ');
if (!query) {
  console.log('Usage: node scripts/search-and-play.js "search query"');
  process.exit(1);
}

searchAndPlay(query).catch(console.error);
