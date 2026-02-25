#!/usr/bin/env node
/**
 * Generate Embeddings
 * Creates semantic embeddings ONLY from transcriptions
 * 
 * Usage: node scripts/generate-embeddings.js
 * 
 * Requirement: Episodes must be transcribed first (transcripts needed for embeddings)
 */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const TRANSCRIPTIONS_DIR = path.join(DATA_DIR, 'transcriptions');
const METADATA_DIR = path.join(BASE_DIR, 'metadata');
const EMBEDDINGS_DIR = path.join(METADATA_DIR, 'embeddings');
const EPISODES_FILE = path.join(DATA_DIR, 'episodes.json');
const EMBEDDINGS_FILE = path.join(EMBEDDINGS_DIR, 'embeddings.json');

fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function generateEmbeddingWithOpenAI(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text.substring(0, 8000) })
  });
  const result = await response.json();
  return result.data[0].embedding;
}

/**
 * Generate embedding from transcription ONLY
 * Returns null if no transcription exists
 */
async function createEpisodeEmbedding(episode, episodeId) {
  const sid = episodeId || episode.externalId;
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${sid}.txt`);
  
  // Check if transcription exists
  if (!fs.existsSync(transcriptPath)) {
    console.log(`   ⚠️ No transcription for ${sid} - skipping embedding`);
    return null;
  }
  
  const transcriptContent = fs.readFileSync(transcriptPath, 'utf-8');
  
  // Check if transcription is valid (not just whisper logs)
  if (!transcriptContent.includes('[00:') && !transcriptContent.includes('-->')) {
    console.log(`   ⚠️ Invalid transcription for ${sid} - skipping embedding`);
    return null;
  }
  
  // Use transcription only (skip title/description)
  const text = transcriptContent.substring(0, 8000);
  
  if (!OPENAI_API_KEY) { 
    console.log('⚠️ No OPENAI_API_KEY'); 
    return null; 
  }
  
  const embedding = await generateEmbeddingWithOpenAI(text);
  
  // Count episode number for this topic
  const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  let episodeNum = 1;
  for (const ep of episodes) {
    if (ep.topic === episode.topic) {
      if (ep.externalId === episode.externalId) break;
      episodeNum++;
    }
  }
  const safeTopic = (episode.topic || 'unknown').replace(/[^a-z]/g, '_').substring(0, 20);
  const finalId = `${safeTopic}_${String(episodeNum).padStart(3, '0')}`;
  
  return { 
    episodeId: finalId, 
    topic: episode.topic, 
    embedding, 
    title: episode.title, 
    showName: episode.showName,
    audioUrl: episode.audioUrl || null,
    externalId: episode.externalId,
    duration: episode.duration || null
  };
}

module.exports = { createEpisodeEmbedding, generateEmbeddingWithOpenAI, EMBEDDINGS_FILE };

// Run if called directly
if (require.main === module) {
  async function main() {
    if (!fs.existsSync(EPISODES_FILE)) {
      console.log('❌ No episodes.json found. Run fetch-episodes.js first.');
      process.exit(1);
    }
    
    if (!OPENAI_API_KEY) {
      console.log('❌ Need OPENAI_API_KEY in .env');
      process.exit(1);
    }
    
    console.log('🎯 Generating embeddings from transcriptions only...\n');
    
    const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    const allEmbeddings = [];
    
    // Group by topic
    const byTopic = {};
    for (const ep of episodes) {
      const t = ep.topic || 'unknown';
      if (!byTopic[t]) byTopic[t] = [];
      byTopic[t].push(ep);
    }
    
    for (const [topic, eps] of Object.entries(byTopic)) {
      console.log(`📝 Processing ${topic}: ${eps.length} episodes`);
      
      for (let i = 0; i < eps.length; i++) {
        const ep = eps[i];
        
        const safeTopic = (topic || 'unknown').replace(/[^a-z]/g, '_').substring(0, 20);
        const episodeId = `${safeTopic}_${String(i+1).padStart(3, '0')}`;
        
        const result = await createEpisodeEmbedding(ep, episodeId);
        
        if (result) {
          allEmbeddings.push(result);
          console.log(`   ✅ ${episodeId}`);
        } else {
          console.log(`   ⏭️  ${episodeId} (no transcription)`);
        }
      }
    }
    
    console.log(`\n✅ Generated ${allEmbeddings.length} embeddings from transcriptions`);
    
    // Save embeddings
    fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify({ episodes: allEmbeddings }, null, 2));
    console.log(`💾 Saved to ${EMBEDDINGS_FILE}`);
  }
  
  main().catch(console.error);
}
