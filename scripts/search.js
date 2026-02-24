#!/usr/bin/env node
/**
 * Search CLI
 * Search episodes by topic using semantic search - returns URLs with metadata
 * 
 * Usage: 
 *   node scripts/search.js "finance"
 *   node scripts/search.js "cartel" --urls
 *   node scripts/search.js "mexico city" --limit 5
 * 
 * Output: Episode URLs (no time slicing), metadata (title, show, match %)
 */

const fs = require('fs');
const path = require('path');
const { EMBEDDINGS_FILE, EPISODES_FILE } = require('./paths');

require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Parse args
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit'))?.split('=')[1]) || 10;
const SHOW_URLS = process.argv.includes('--urls') || process.argv.includes('-u');
const JSON_OUTPUT = process.argv.includes('--json');

/**
 * Generate query embedding using OpenAI
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
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Load episodes for metadata lookup
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
 * Main search function
 */
async function search(query) {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.log('❌ No embeddings found. Run: node scripts/generate-embeddings.js');
    process.exit(1);
  }
  
  if (!OPENAI_API_KEY) {
    console.log('❌ Need OPENAI_API_KEY in .env');
    process.exit(1);
  }
  
  console.log(`🔍 Searching for: "${query}"\n`);
  
  // Load embeddings
  const embeddingsData = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = (embeddingsData.episodes || embeddingsData).filter(ep => ep.embedding);
  
  // Load episodes for metadata
  const episodesMap = loadEpisodes();
  
  // Generate query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  // Score and sort
  const results = embeddings.map(ep => {
    const episode = episodesMap.get(ep.externalId) || {};
    return {
      episodeId: ep.episodeId,
      externalId: ep.externalId,
      title: ep.title || episode.title || 'Unknown',
      showName: ep.showName || episode.showName || 'Unknown',
      topic: ep.topic || episode.topic || 'unknown',
      audioUrl: ep.audioUrl || episode.audioUrl || null,
      duration: episode.duration || null,
      description: episode.description || null,
      similarity: cosineSimilarity(queryEmbedding, ep.embedding)
    };
  }).sort((a, b) => b.similarity - a.similarity).slice(0, LIMIT);
  
  // Output
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(results, null, 2));
    return results;
  }
  
  console.log('📊 Results:\n');
  
  results.forEach((r, i) => {
    const score = (r.similarity * 100).toFixed(1);
    console.log(`${i + 1}. ${r.title}`);
    console.log(`   📻 ${r.showName} [${r.topic}]`);
    console.log(`   🎯 Match: ${score}%`);
    
    if (SHOW_URLS && r.audioUrl) {
      console.log(`   🔗 ${r.audioUrl}`);
    }
    console.log('');
  });
  
  console.log(`Showing ${results.length} episodes`);
  
  if (SHOW_URLS) {
    console.log('\n💡 URL format: Full episode URL (no time slicing)');
    console.log('💡 For time-sliced URLs, use: node scripts/search-chunks.js');
  }
  
  return results;
}

// Run
const query = process.argv.slice(2).filter(a => !a.startsWith('--')).join(' ');

if (!query) {
  console.log('Usage: node scripts/search.js "query" [options]');
  console.log('Options:');
  console.log('  --urls      Show audio URLs');
  console.log('  --limit=N   Limit results (default: 10)');
  console.log('  --json      JSON output');
  process.exit(1);
}

search(query).catch(console.error);
