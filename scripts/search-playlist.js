#!/usr/bin/env node
/**
 * Search Playlist CLI
 * Generate a clickable playlist of time-sliced episodes
 * Internally uses search-chunks to get chunked URLs
 * 
 * Usage:
 *   node scripts/search-playlist.js "cartel"
 *   node scripts/search-playlist.js "stock market" --duration=300
 *   node scripts/search-playlist.js "mexico" --markdown
 * 
 * Output: Clickable playlist URLs for browsers/podcast apps
 */

const fs = require('fs');
const path = require('path');
const { EMBEDDINGS_FILE, EPISODES_FILE } = require('./paths');

require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Config
const DEFAULT_CHUNK_DURATION = 300;
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

const MARKDOWN = process.argv.includes('--markdown') || process.argv.includes('-m');
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
 * Estimate duration
 */
function estimateDuration(episode) {
  if (episode.duration) return parseInt(episode.duration);
  if (episode.description) {
    const minMatch = episode.description.match(/(\d+)\s*min/i);
    if (minMatch) return parseInt(minMatch[1]) * 60;
  }
  return 1800;
}

/**
 * Find natural boundaries
 */
function findChunkBoundaries(estimatedDuration, chunkDuration = CHUNK_DURATION) {
  const INTRO_SKIP = 45;
  const OUTRO_SKIP = 30;
  
  const minStart = INTRO_SKIP;
  const maxEnd = estimatedDuration - OUTRO_SKIP;
  const availableDuration = maxEnd - minStart;
  
  if (availableDuration <= chunkDuration) {
    return { start: minStart, end: Math.min(estimatedDuration - OUTRO_SKIP, minStart + chunkDuration) };
  }
  
  const idealStart = minStart + (availableDuration - chunkDuration) / 2;
  return { start: Math.round(idealStart), end: Math.round(idealStart + chunkDuration) };
}

/**
 * Generate time-sliced URL
 */
function generateTimeSliceUrl(audioUrl, start, end) {
  if (!audioUrl) return null;
  try {
    const url = new URL(audioUrl);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    const baseUrl = audioUrl.split('?')[0];
    return `${baseUrl}#t=${start},${end}`;
  } catch (e) {
    return `${audioUrl}#t=${start},${end}`;
  }
}

/**
 * Format time
 */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Main playlist function
 */
async function searchPlaylist(query) {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.log('❌ No embeddings found. Run: node scripts/generate-embeddings.js');
    process.exit(1);
  }
  
  if (!OPENAI_API_KEY) {
    console.log('❌ Need OPENAI_API_KEY in .env');
    process.exit(1);
  }
  
  console.log(`\n🎵 Building playlist for: "${query}"`);
  console.log(`📏 Chunk: ${CHUNK_DURATION}s | Limit: ${SEARCH_LIMIT}\n`);
  
  // Load embeddings
  const embeddingsData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = (embeddingsData.episodes || embeddingsData).filter(ep => ep.embedding);
  
  // Load episodes
  const episodesMap = loadEpisodes();
  
  // Generate query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  // Score and sort
  const results = embeddings.map(ep => {
    const episode = episodesMap.get(ep.externalId) || {};
    return {
      title: ep.title || episode.title || 'Unknown',
      showName: ep.showName || episode.showName || 'Unknown',
      audioUrl: ep.audioUrl || episode.audioUrl || null,
      estimatedDuration: estimateDuration(episode),
      similarity: cosineSimilarity(queryEmbedding, ep.embedding)
    };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, SEARCH_LIMIT);
  
  // Generate playlist items
  const playlist = results.map((r, i) => {
    const boundaries = findChunkBoundaries(r.estimatedDuration);
    const chunkUrl = generateTimeSliceUrl(r.audioUrl, boundaries.start, boundaries.end);
    
    return {
      index: i + 1,
      episode: r.title,
      show: r.showName,
      match: r.similarity,
      chunk: {
        start: boundaries.start,
        end: boundaries.end,
        url: chunkUrl
      }
    };
  }).filter(p => p.chunk.url);
  
  // Output formats
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(playlist, null, 2));
    return playlist;
  }
  
  if (MARKDOWN) {
    console.log('# 🎧 Podcast Playlist\n');
    console.log(`**Search:** "${query}" | **Duration:** ${CHUNK_DURATION}s per chunk\n`);
    console.log('| # | Episode | Show | Match | Chunk | URL |');
    console.log('|---|---------|------|-------|-------|-----|');
    
    playlist.forEach(p => {
      const chunkStr = `${formatTime(p.chunk.start)}-${formatTime(p.chunk.end)}`;
      const url = p.chunk.url || '';
      const title = (p.episode || 'Unknown').substring(0, 25);
      const show = (p.show || 'Unknown').substring(0, 15);
      console.log(`| ${p.index} | ${title} | ${show} | ${(p.match*100).toFixed(0)}% | ${chunkStr} | [▶️ Play](${url}) |`);
    });
    
    console.log('\n💡 Click URLs to play in podcast app or browser');
    return playlist;
  }
  
  // Default: clickable format
  console.log('🎧 PLAYLIST\n' + '═'.repeat(50));
  
  playlist.forEach(p => {
    const chunkStr = `${formatTime(p.chunk.start)}-${formatTime(p.chunk.end)}`;
    console.log(`\n${p.index}. ${p.episode}`);
    console.log(`   📻 ${p.showName} (${(p.match*100).toFixed(0)}% match)`);
    console.log(`   ⏱️  ${chunkStr}`);
    console.log(`   🔗 ${p.chunk.url}`);
  });
  
  console.log('\n' + '═'.repeat(50));
  console.log(`Total: ${playlist.length} chunks`);
  console.log('\n💡 Copy URLs to podcast app or click to play in browser');
  
  return playlist;
}

// Run
const query = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');

if (!query) {
  console.log('Usage: node scripts/search-playlist.js "query" [options]');
  console.log('Options:');
  console.log('  --duration=N   Chunk duration (default: 300s)');
  console.log('  --limit=N      Results (default: 5)');
  console.log('  --markdown     Markdown table format');
  console.log('  --json         JSON output');
  console.log('\nNote: Internally uses search-chunks logic. Does NOT download audio.');
  process.exit(1);
}

searchPlaylist(query).catch(console.error);
