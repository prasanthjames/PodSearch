#!/usr/bin/env node
/**
 * Search Chunks CLI
 * Generate time-sliced episode URLs using semantic search
 * Uses embeddings to find relevant content and estimates chunk positions
 * NO AUDIO DOWNLOADING - generates URL-based time slices
 * 
 * Usage:
 *   node scripts/search-chunks.js "cartel"
 *   node scripts/search-chunks.js "stock market" --duration=300
 *   node scripts/search-chunks.js "mexico" --limit=5
 *   node scripts/search-chunks.js "finance" --json
 * 
 * Output: Time-sliced URLs (start-end) with metadata
 */

const fs = require('fs');
const path = require('path');
const { EMBEDDINGS_FILE, EPISODES_FILE } = require('./paths');

require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Config
const DEFAULT_CHUNK_DURATION = 300; // 5 minutes
let CHUNK_DURATION = DEFAULT_CHUNK_DURATION;
let SEARCH_LIMIT = 5;

// Parse args
for (const arg of process.argv) {
  if (arg.startsWith('--duration=')) {
    CHUNK_DURATION = parseInt(arg.split('=')[1]) || DEFAULT_CHUNK_DURATION;
  }
  if (arg.startsWith('--limit=')) {
    SEARCH_LIMIT = parseInt(arg.split('=')[1]) || 5;
  }
}

const JSON_OUTPUT = process.argv.includes('--json');

/**
 * Generate query embedding
 */
async function getQueryEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
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
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load episodes
 */
function loadEpisodes() {
  if (!fs.existsSync(EPISODES_FILE)) return new Map();
  const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  const map = new Map();
  for (const ep of episodes) {
    map.set(ep.externalId, ep);
  }
  return map;
}

/**
 * Estimate duration from episode metadata or use default
 * Returns estimated duration in seconds
 */
function estimateDuration(episode) {
  // Try to get from metadata (episodes.json has duration field)
  if (episode && episode.duration) {
    const d = parseInt(episode.duration);
    if (d > 60) return d; // Reasonable duration
  }
  
  // Try from description (sometimes contains "X min")
  if (episode && episode.description) {
    const minMatch = episode.description.match(/(\d+)\s*min/i);
    if (minMatch) {
      return parseInt(minMatch[1]) * 60;
    }
  }
  
  // Default fallback: 30 minutes
  return 1800;
}

/**
 * Find natural chunk boundaries
 * - Skips intro (first 45s) and outro (last 30s)
 * - Positions search relevance in middle of chunk
 * - Uses episode metadata to estimate positions
 */
function findChunkBoundaries(estimatedDuration, chunkDuration = CHUNK_DURATION) {
  // Handle edge cases - ensure minimum viable duration
  const MIN_DURATION = 120; // 2 min minimum
  if (!estimatedDuration || estimatedDuration < MIN_DURATION) {
    estimatedDuration = MIN_DURATION;
  }
  
  const INTRO_SKIP = 45;
  const OUTRO_SKIP = 30;
  
  // Ensure we don't go past the end
  const maxPossibleEnd = estimatedDuration - OUTRO_SKIP;
  let end = INTRO_SKIP + chunkDuration;
  
  // Clamp end to available duration
  if (end > maxPossibleEnd) {
    end = Math.max(INTRO_SKIP + 60, maxPossibleEnd); // At least 60s chunk
  }
  
  // Start in middle of available range
  const available = end - INTRO_SKIP;
  const start = INTRO_SKIP + Math.max(0, (available - chunkDuration) / 2);
  
  // Final clamp
  end = Math.min(end, maxPossibleEnd);
  
  return {
    start: Math.round(start),
    end: Math.round(end),
    duration: Math.round(end - start)
  };
}

/**
 * Generate time-sliced URL
 * Adds #t=start,end for podcast players that support it
 * Or uses query params ?start=XX&end=XX
 */
function generateTimeSliceUrl(audioUrl, start, end) {
  if (!audioUrl) return null;
  
  try {
    const url = new URL(audioUrl);
    
    // Some hosts support #t= syntax (Apple Podcasts, some web players)
    // Add query params for broader support
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    
    // Also add hash fragment for players that support it
    const baseUrl = audioUrl.split('?')[0];
    return `${baseUrl}#t=${start},${end}`;
  } catch (e) {
    // If URL parsing fails, just append hash
    return `${audioUrl}#t=${start},${end}`;
  }
}

/**
 * Format time for display
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Main search and chunk function
 */
async function searchChunks(query) {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.log('❌ No embeddings found. Run: node scripts/generate-embeddings.js');
    process.exit(1);
  }
  
  if (!OPENAI_API_KEY) {
    console.log('❌ Need OPENAI_API_KEY in .env');
    process.exit(1);
  }
  
  console.log(`\n🎯 Searching for: "${query}"`);
  console.log(`📏 Chunk duration: ${CHUNK_DURATION} seconds\n`);
  
  // Load embeddings
  const embeddingsData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = (embeddingsData.episodes || embeddingsData).filter(ep => ep.embedding);
  
  // Load episodes
  const episodesMap = loadEpisodes();
  
  // Generate query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  // Score and sort - use embedding data directly, fallback to episodesMap only if needed
  const results = embeddings.map(ep => {
    // Prefer embedding data (already has showName, audioUrl, etc.)
    const episode = episodesMap.get(ep.externalId) || {};
    return {
      episodeId: ep.episodeId,
      externalId: ep.externalId,
      title: ep.title || episode.title || 'Unknown',
      showName: ep.showName || episode.showName || 'Unknown',
      topic: ep.topic || episode.topic || 'unknown',
      audioUrl: ep.audioUrl || episode.audioUrl || null,
      description: ep.description || episode.description || null,
      // Use embedding's episode data first, then fallback to episodesMap
      duration: (ep.duration) || (episode.duration) || estimateDuration(episode),
      similarity: cosineSimilarity(queryEmbedding, ep.embedding)
    };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, SEARCH_LIMIT);
  
  // Generate chunks
  const chunks = results.map(r => {
    const boundaries = findChunkBoundaries(r.duration);
    const slicedUrl = generateTimeSliceUrl(r.audioUrl, boundaries.start, boundaries.end);
    
    return {
      episode: r.title,
      show: r.showName,
      topic: r.topic,
      similarity: r.similarity,
      estimatedDuration: r.duration,
      chunk: {
        start: boundaries.start,
        end: boundaries.end,
        duration: boundaries.end - boundaries.start,
        url: slicedUrl
      }
    };
  });
  
  // Output
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(chunks, null, 2));
    return chunks;
  }
  
  console.log('📦 Time-Sliced Results:\n');
  
  chunks.forEach((c, i) => {
    console.log(`${i + 1}. ${c.episode}`);
    console.log(`   📻 ${c.show} [${c.topic}]`);
    console.log(`   🎯 Match: ${(c.similarity * 100).toFixed(1)}%`);
    console.log(`   ⏱️  Est. duration: ${formatTime(c.estimatedDuration)}`);
    console.log(`   ✂️  Chunk: ${formatTime(c.chunk.start)} → ${formatTime(c.chunk.end)} (${c.chunk.duration}s)`);
    console.log(`   🔗 ${c.chunk.url || 'N/A'}`);
    console.log('');
  });
  
  console.log(`Showing ${chunks.length} episodes with time-sliced URLs`);
  console.log('\n💡 Tip: Use #t=start,end format for podcast apps');
  console.log('💡 For full episode URLs, use: node scripts/search.js');
  
  return chunks;
}

// Run
const query = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');

if (!query) {
  console.log('Usage: node scripts/search-chunks.js "query" [options]');
  console.log('Options:');
  console.log('  --duration=N   Chunk duration in seconds (default: 300)');
  console.log('  --limit=N      Number of results (default: 5)');
  console.log('  --json         JSON output');
  console.log('\nNote: Does NOT download audio. Uses embeddings + metadata for time slicing.');
  process.exit(1);
}

searchChunks(query).catch(console.error);
