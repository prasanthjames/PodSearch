#!/usr/bin/env node
/**
 * Transcription Script
 * Uses OpenAI Whisper API to transcribe podcast episodes
 * 
 * Usage: node scripts/transcribe.js [episodeId]
 * 
 * Note: Requires OPENAI_API_KEY in .env
 * Can switch to local whisper.cpp when installed
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { pipeline } = require('stream/promises');
const { EPISODES_FILE, TRANSCRIPTIONS_DIR, EMBEDDINGS_FILE, AUDIO_DIR } = require('./paths');
const { createEpisodeEmbedding } = require('./generate-embeddings');

// Ensure directories exist
fs.mkdirSync(TRANSCRIPTIONS_DIR, { recursive: true });

// Load API key from env
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Download audio file
 */
async function downloadAudio(url, outputPath) {
  console.log(`📥 Downloading: ${url.substring(0, 50)}...`);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  
  const stream = fs.createWriteStream(outputPath);
  await pipeline(response.body, stream);
  
  console.log(`💾 Saved to: ${outputPath}`);
  return outputPath;
}

/**
 * Transcribe using OpenAI Whisper API
 */
async function transcribeWithOpenAI(audioPath) {
  console.log(`🎙️ Transcribing with OpenAI...`);
  
  const audioData = fs.readFileSync(audioPath);
  const fileName = path.basename(audioPath);
  
  // Create FormData with proper multipart form data
  const formData = new FormData();
  formData.append('file', new Blob([audioData]), fileName);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: formData
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(result.error.message);
  }
  
  return result.text;
}

/**
 * Transcribe using local whisper.cpp
 * (Called when whisper.cpp is installed)
 */
async function transcribeWithWhisperCpp(audioPath) {
  console.log(`🎙️ Transcribing with whisper.cpp...`);
  
  const { execSync } = require('child_process');
  
  const outputPath = audioPath.replace(/\.[^.]+$/, '.txt');
  
  execSync(`./main -m ./models/ggml-base.bin -f "${audioPath}" -o "${outputPath}"`, {
    cwd: '/usr/local/share/whisper.cpp'
  });
  
  return fs.readFileSync(outputPath, 'utf-8');
}

/**
 * Main transcription function
 * Tries OpenAI first, falls back to local if configured
 */
async function transcribeEpisode(episode) {
  const { audioUrl, externalId } = episode;
  
  // Skip if no audio URL
  if (!audioUrl) {
    console.log('⚠️ No audio URL, skipping');
    return null;
  }
  
  const audioExt = audioUrl.match(/\.([^.?]+)$/)?.[1] || 'mp3';
  const tempPath = path.join(TRANSCRIPTIONS_DIR, `${externalId}.${audioExt}`);
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${externalId}.txt`);
  
  try {
    // Download audio
    await downloadAudio(audioUrl, tempPath);
    
    let transcript;
    
    // Try OpenAI first
    if (OPENAI_API_KEY) {
      transcript = await transcribeWithOpenAI(tempPath);
    } else {
      // Use local whisper.cpp
      transcript = await transcribeWithWhisperCpp(tempPath);
    }
    
    // Save transcript
    fs.writeFileSync(transcriptPath, transcript);
    
    // Generate embedding automatically after transcription
    console.log(`🔢 Generating embedding...`);
    try {
      const embedding = await createEpisodeEmbedding(episode);
      if (embedding) {
        // Load existing embeddings or create new array
        let embeddings = [];
        if (fs.existsSync(EMBEDDINGS_FILE)) {
          embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
        }
        // Add new embedding, filter out existing one for same episodeId
        embeddings = embeddings.filter(e => e.episodeId !== episode.externalId);
        embeddings.push(embedding);
        fs.writeFileSync(EMBEDDINGS_FILE, JSON.stringify(embeddings, null, 2));
        console.log(`✅ Embedding saved for ${episode.externalId}`);
        
        // Delete original audio file to save space
        const originalAudioPath = path.join(AUDIO_DIR, `${externalId}.${audioExt}`);
        if (fs.existsSync(originalAudioPath)) {
          fs.unlinkSync(originalAudioPath);
          console.log(`🗑️ Deleted original audio: ${originalAudioPath}`);
        }
      }
    } catch (embErr) {
      console.error(`⚠️ Embedding failed: ${embErr.message}`);
    }
    
    // Cleanup audio file
    fs.unlinkSync(tempPath);
    
    console.log(`✅ Transcribed: ${episode.title?.substring(0, 40)}...`);
    
    return {
      episodeId: externalId,
      transcript,
      status: 'done'
    };
    
  } catch (err) {
    console.error(`❌ Error transcribing: ${err.message}`);
    
    // Cleanup on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    return {
      episodeId: externalId,
      transcript: null,
      status: 'failed',
      error: err.message
    };
  }
}

/**
 * Process all episodes
 */
async function processAllEpisodes(limit = null) {
  if (!fs.existsSync(EPISODES_FILE)) {
    console.error('❌ No episodes found. Run fetch-episodes.js first!');
    process.exit(1);
  }
  
  const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  const toProcess = limit ? episodes.slice(0, limit) : episodes;
  
  console.log(`📚 Processing ${toProcess.length} episodes...\n`);
  
  const results = [];
  
  for (const episode of toProcess) {
    const result = await transcribeEpisode(episode);
    results.push(result);
  }
  
  // Save results
  fs.writeFileSync(
    path.join(TRANSCRIPTS_DIR, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log(`\n✅ Done! Results saved.`);
  
  const done = results.filter(r => r.status === 'done').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  console.log(`📊 Success: ${done}, Failed: ${failed}`);
  
  return results;
}

// Run if called directly
if (require.main === module) {
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;
  processAllEpisodes(limit).catch(console.error);
}

module.exports = { transcribeEpisode, processAllEpisodes };
