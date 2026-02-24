#!/usr/bin/env node
/**
 * Embedding Generator
 * Generates embeddings for episodes using OpenAI or local model
 * 
 * Usage: node scripts/generate-embeddings.js
 * 
 * Requires: OPENAI_API_KEY or local embedding model
 */

const fs = require('fs');
const path = require('path');
const { EPISODES_FILE, TRANSCRIPTIONS_DIR, EMBEDDINGS_FILE, EMBEDDINGS_DIR } = require('./paths');

// Ensure directories exist
fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });

require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Generate embedding using OpenAI text-embedding-3-small
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
      input: text.substring(0, 8000) // Limit to avoid token limits
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message);
  }
  
  return result.data[0].embedding;
}

/**
 * Generate embedding using sentence-transformers (local)
 * Requires: pip install sentence-transformers
 */
async function generateEmbeddingLocal(text) {
  // This would require Python - use as fallback
  const { execSync } = require('child_process');
  
  // Write temp file
  const tempFile = path.join(__dirname, 'data', 'temp_text.txt');
  fs.writeFileSync(tempFile, text.substring(0, 8000));
  
  // Run Python script (you'd create this separately)
  const result = execSync(`python3 scripts/embed_local.py "${tempFile}"`, {
    cwd: path.join(__dirname, '..')
  });
  
  return JSON.parse(result.toString());
}

/**
 * Create embedding from episode data
 */
async function createEpisodeEmbedding(episode) {
  // Combine title, description, and transcript for rich embedding
  const text = [
    episode.title,
    episode.description,
    fs.existsSync(path.join(TRANSCRIPTS_DIR, `${episode.externalId}.txt`))
      ? fs.readFileSync(path.join(TRANSCRIPTS_DIR, `${episode.externalId}.txt`), 'utf-8').substring(0, 4000)
      : ''
  ].join('\n\n');
  
  let embedding;
  
  if (OPENAI_API_KEY) {
    embedding = await generateEmbeddingWithOpenAI(text);
  } else {
    console.log('⚠️ No OPENAI_API_KEY, skipping embedding generation');
    return null;
  }
  
  return {
    episodeId: episode.externalId,
    topic: episode.topic,
    embedding,
    title: episode.title,
    showName: episode.showName
  };
}

/**
 * Process all episodes
 */
async function generateAllEmbeddings() {
  if (!fs.existsSync(EPISODES_FILE)) {
    console.error('❌ No episodes found. Run fetch-episodes.js first!');
    process.exit(1);
  }
  
  const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  
  console.log(`📚 Generating embeddings for ${episodes.length} episodes...\n`);
  
  const embeddings = [];
  
  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i];
    
    try {
      console.log(`[${i + 1}/${episodes.length}] ${episode.title?.substring(0, 40)}...`);
      
      const embedding = await createEpisodeEmbedding(episode);
      
      if (embedding) {
        embeddings.push(embedding);
      }
      
    } catch (err) {
      console.error(`❌ Error: ${err.message}`);
    }
  }
  
  // Save all embeddings
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
  
  console.log(`\n✅ Done! ${embeddings.length} embeddings saved to ${EMBEDDINGS_FILE}`);
  
  return embeddings;
}

/**
 * Simple cosine similarity for searching
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
 * Search embeddings by topic/query
 */
async function searchByQuery(query, topK = 10) {
  if (!fs.existsSync(EMBEDDINGS_FILE)) {
    console.error('❌ No embeddings found. Run generate-embeddings.js first!');
    process.exit(1);
  }
  
  const embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  
  // Generate query embedding
  const queryEmbedding = await (OPENAI_API_KEY 
    ? generateEmbeddingWithOpenAI(query)
    : generateEmbeddingLocal(query));
  
  // Calculate similarities
  const results = embeddings.map(ep => ({
    ...ep,
    similarity: cosineSimilarity(queryEmbedding, ep.embedding)
  }));
  
  // Sort by similarity
  results.sort((a, b) => b.similarity - a.similarity);
  
  return results.slice(0, topK);
}

// Run if called directly
if (require.main === module) {
  generateAllEmbeddings().catch(console.error);
}

module.exports = { 
  generateAllEmbeddings, 
  searchByQuery, 
  createEpisodeEmbedding,
  cosineSimilarity 
};
