#!/usr/bin/env node
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

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; normA += a[i] * a[i]; normB += b[i] * b[i]; }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function createEpisodeEmbedding(episode, episodeId) {
  const sid = episodeId || episode.externalId;
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${sid}.txt`);
  const text = [episode.title, episode.description, fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf-8').substring(0, 4000) : ''].join('\n\n');
  
  if (!OPENAI_API_KEY) { console.log('⚠️ No OPENAI_API_KEY'); return null; }
  
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
  
  return { episodeId: finalId, topic: episode.topic, embedding, title: episode.title, showName: episode.showName };
}

module.exports = { createEpisodeEmbedding, generateEmbeddingWithOpenAI, cosineSimilarity, EMBEDDINGS_FILE };
