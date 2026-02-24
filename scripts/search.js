#!/usr/bin/env node
/**
 * Search CLI
 * Search episodes by topic using semantic search
 * 
 * Usage: node scripts/search.js "finance"
 *        node scripts/search.js "mexico city"
 */

const fs = require('fs');
const path = require('path');
const { EMBEDDINGS_FILE, EPISODES_FILE, TRANSCRIPTIONS_DIR } = require('./paths');

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Main search function
 */
async function search(query, limit = 10) {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.log('❌ No embeddings found.');
    console.log('\n📋 Run these commands first:');
    console.log('   1. node scripts/fetch-episodes.js');
    console.log('   2. node scripts/transcribe.js');
    console.log('   3. node scripts/generate-embeddings.js');
    process.exit(1);
  }
  
  if (!OPENAI_API_KEY) {
    console.log('❌ Need OPENAI_API_KEY in .env to search');
    process.exit(1);
  }
  
  console.log(`🔍 Searching for: "${query}"\n`);
  
  // Load embeddings
  const embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  
  // Generate query embedding
  const queryEmbedding = await getQueryEmbedding(query);
  
  // Calculate similarities
  const results = embeddings.map(ep => ({
    title: ep.title,
    showName: ep.showName,
    topic: ep.topic,
    similarity: cosineSimilarity(queryEmbedding, ep.embedding)
  }));
  
  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity);
  
  // Display results
  console.log('📊 Results:\n');
  
  const topResults = results.slice(0, limit);
  
  topResults.forEach((result, i) => {
    const score = (result.similarity * 100).toFixed(1);
    const topic = result.topic ? `[${result.topic}]` : '';
    
    console.log(`${i + 1}. ${result.title}`);
    console.log(`   📻 ${result.showName} ${topic}`);
    console.log(`   🎯 Match: ${score}%\n`);
  });
  
  console.log(`Showing ${topResults.length} of ${results.length} episodes`);
  
  return topResults;
}

// Get query from command line
const query = process.argv.slice(2).join(' ');

if (!query) {
  console.log('Usage: node scripts/search.js "your search query"');
  console.log('Example: node scripts/search.js "finance tips"');
  process.exit(1);
}

search(query).catch(console.error);
