#!/usr/bin/env node
/**
 * Process Queue
 * Sequential processor: download → transcribe → embed → cleanup
 * Processes ONE episode at a time
 * 
 * Usage: node scripts/process-queue.js
 * Runs continuously until queue is empty
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { EPISODES_FILE, DATA_DIR, AUDIO_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_DIR } = require('./paths');

require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Ensure directories
fs.mkdirSync(AUDIO_DIR, { recursive: true });
fs.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });

const QUEUE_FILE = path.join(DATA_DIR, 'processing-queue.json');
const EMBEDDINGS_FILE = path.join(EMBEDDINGS_DIR, 'embeddings.json');

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) return [];
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
}

function loadEpisodes() {
  if (!fs.existsSync(EPISODES_FILE)) return new Map();
  const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  const map = new Map();
  for (const ep of episodes) {
    map.set(ep.externalId, ep);
  }
  return map;
}

function loadEmbeddings() {
  if (!fs.existsSync(EMBEDDINGS_FILE)) return [];
  const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  return data.episodes || [];
}

function saveEmbeddings(embeddings) {
  fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify({ episodes: embeddings }, null, 2));
}

/**
 * Step 1: Download audio
 */
async function downloadAudio(episode, audioUrl) {
  const ext = path.extname(new URL(audioUrl).pathname) || '.mp3';
  const audioPath = path.join(AUDIO_DIR, `${episode.externalId}${ext}`);
  
  if (fs.existsSync(audioPath)) {
    console.log(`   📁 Audio already exists`);
    return audioPath;
  }
  
  console.log(`   ⬇️  Downloading audio...`);
  
  return new Promise((resolve, reject) => {
    execSync(`curl -sL -o "${audioPath}" "${audioUrl}"`, (err) => {
      if (err) reject(err);
      else resolve(audioPath);
    });
  });
}

/**
 * Step 2: Transcribe audio
 */
async function transcribeAudio(episodeId, audioPath) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  
  if (fs.existsSync(transcriptPath)) {
    console.log(`   📝 Transcription already exists`);
    return transcriptPath;
  }
  
  console.log(`   🎤 Transcribing...`);
  
  // Use OpenAI Whisper API
  const formData = new FormData();
  formData.append('file', fs.createReadStream(audioPath));
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities', 'segment');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }
  
  const result = await response.json();
  
  // Convert to timestamped format
  let text = '';
  if (result.segments) {
    for (const seg of result.segments) {
      const start = formatTimestamp(seg.start);
      const end = formatTimestamp(seg.end);
      text += `[${start} --> ${end}] ${seg.text.trim()}\n\n`;
    }
  }
  
  fs.writeFileSync(transcriptPath, text);
  return transcriptPath;
}

function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Step 3: Generate embedding from transcription
 */
async function generateEmbedding(episode, episodeId) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  
  if (!fs.existsSync(transcriptPath)) {
    console.log(`   ⚠️ No transcription - skipping embedding`);
    return null;
  }
  
  const transcript = fs.readFileSync(transcriptPath, 'utf-8');
  
  // Validate transcription
  if (!transcript.includes('[00:') && !transcript.includes('-->')) {
    console.log(`   ⚠️ Invalid transcription - skipping embedding`);
    return null;
  }
  
  console.log(`   🧠 Generating embedding...`);
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: transcript.substring(0, 8000)
    })
  });
  
  const result = await response.json();
  const embedding = result.data[0].embedding;
  
  // Load existing embeddings
  const embeddings = loadEmbeddings();
  
  // Determine episode number for this topic
  const topicEps = embeddings.filter(e => e.topic === episode.topic);
  const episodeNum = topicEps.length + 1;
  const safeTopic = (episode.topic || 'unknown').replace(/[^a-z]/g, '_').substring(0, 20);
  const finalId = `${safeTopic}_${String(episodeNum).padStart(3, '0')}`;
  
  embeddings.push({
    episodeId: finalId,
    topic: episode.topic,
    embedding,
    title: episode.title,
    showName: episode.showName,
    audioUrl: episode.audioUrl,
    externalId: episode.externalId,
    duration: episode.duration
  });
  
  saveEmbeddings(embeddings);
  console.log(`   ✅ Embedding saved: ${finalId}`);
  
  return finalId;
}

/**
 * Step 4: Cleanup - delete audio and transcription
 */
function cleanup(episodeId, audioPath) {
  // Delete audio
  if (audioPath && fs.existsSync(audioPath)) {
    fs.unlinkSync(audioPath);
    console.log(`   🗑️ Deleted audio`);
  }
  
  // Delete transcription
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  if (fs.existsSync(transcriptPath)) {
    fs.unlinkSync(transcriptPath);
    console.log(`   🗑️ Deleted transcription`);
  }
}

/**
 * Process one episode from queue
 */
async function processOne() {
  const queue = loadQueue();
  
  // Find next pending episode
  const pending = queue.find(e => e.status === 'pending');
  
  if (!pending) {
    console.log(`\n✅ Queue is empty! All episodes processed.\n`);
    return false;
  }
  
  // Mark as processing
  pending.status = 'processing';
  pending.startedAt = new Date().toISOString();
  saveQueue(queue);
  
  // Get episode details
  const episodesMap = loadEpisodes();
  const episode = episodesMap.get(pending.externalId);
  
  if (!episode) {
    console.log(`\n❌ Episode not found: ${pending.externalId}\n`);
    pending.status = 'error';
    pending.error = 'Episode not found';
    saveQueue(queue);
    return true;
  }
  
  console.log(`\n📦 Processing: ${episode.title?.substring(0, 40)}`);
  console.log(`   Topic: ${episode.topic}`);
  console.log(`   ID: ${pending.externalId}`);
  
  try {
    // Step 1: Download
    if (!episode.audioUrl) {
      throw new Error('No audio URL');
    }
    const audioPath = await downloadAudio(episode, episode.audioUrl);
    
    // Step 2: Transcribe
    const transcriptPath = await transcribeAudio(pending.externalId, audioPath);
    
    // Step 3: Generate embedding
    const embeddingId = await generateEmbedding(episode, pending.externalId);
    
    // Step 4: Cleanup
    cleanup(pending.externalId, audioPath);
    
    // Mark complete
    pending.status = 'completed';
    pending.completedAt = new Date().toISOString();
    pending.embeddingId = embeddingId;
    saveQueue(queue);
    
    console.log(`   ✅ Complete!\n`);
    return true;
    
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    pending.status = 'error';
    pending.error = e.message;
    saveQueue(queue);
    return true;
  }
}

/**
 * Main - process queue continuously
 */
async function main() {
  console.log('\n🔄 PROCESS QUEUE - Sequential processing\n');
  
  const maxRuns = parseInt(process.argv.find(a => a.startsWith('--max='))?.split('=')[1]) || 10;
  
  for (let i = 0; i < maxRuns; i++) {
    console.log(`\n--- Run ${i + 1}/${maxRuns} ---`);
    const hadWork = await processOne();
    if (!hadWork) break;
  }
  
  // Final stats
  const queue = loadQueue();
  const completed = queue.filter(e => e.status === 'completed').length;
  const pending = queue.filter(e => e.status === 'pending').length;
  const errors = queue.filter(e => e.status === 'error').length;
  
  console.log(`\n📊 Queue Stats:`);
  console.log(`   Completed: ${completed}`);
  console.log(`   Pending: ${pending}`);
  console.log(`   Errors: ${errors}`);
  
  const embeddings = loadEmbeddings();
  console.log(`   Total embeddings: ${embeddings.length}\n`);
}

main().catch(console.error);
