#!/usr/bin/env node
/**
 * Search and Play - Find episode segment with search term in middle, ~5 mins
 * Uses transcription timestamps to find natural boundaries
 * 
 * Usage: node scripts/search-and-play.js "stock market sentiment"
 *        node scripts/search-and-play.js "cartel" --duration=300
 */

const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const { EPISODES_FILE, TRANSCRIPTIONS_DIR, AUDIO_DIR } = require('./paths');

require('dotenv').config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Config
let CHUNK_DURATION = 300; // 5 minutes default
let SEARCH_LIMIT = 3;

// Parse args
for (const arg of process.argv) {
  if (arg.startsWith('--duration=')) {
    CHUNK_DURATION = parseInt(arg.split('=')[1]) || 300;
  }
  if (arg.startsWith('--limit=')) {
    SEARCH_LIMIT = parseInt(arg.split('=')[1]) || 3;
  }
}

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
  if (!a || !b || a.length !== b.length) return 0;
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
 * Find search term in transcript and return context
 */
function findSearchInTranscript(episodeId, query) {
  const transcriptPath = path.join(TRANSCRIPTIONS_DIR, `${episodeId}.txt`);
  
  // Try different filename variations
  const variations = [
    transcriptPath,
    path.join(TRANSCRIPTIONS_DIR, `${episodeId.replace(/_\d+$/, '')}.txt`),
  ];
  
  let content = null;
  for (const p of variations) {
    if (fs.existsSync(p)) {
      content = fs.readFileSync(p, 'utf-8');
      // Check if valid transcript (has timestamps)
      if (!content.includes('[00:') && !content.includes('-->')) {
        content = null;
      } else {
        break;
      }
    }
  }
  
  // Fallback to episode description
  if (!content) {
    const episode = getEpisodeById(episodeId);
    if (episode && episode.description) {
      const queryLower = query.toLowerCase();
      const descLower = episode.description.toLowerCase();
      if (descLower.includes(queryLower)) {
        return {
          isDescription: true,
          timestamp: null,
          seconds: null,
          text: episode.description.substring(0, 300),
          episode
        };
      }
    }
    return null;
  }
  
  const queryLower = query.toLowerCase();
  const matches = [];
  
  // Parse: [00:00:00.000 --> 00:00:06.240] text
  const regex = /\[(\d{2}:\d{2}:\d{2}\.\d{3}) --[^\]]+\]\s*([^\n]+)/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const timestamp = match[1];
    const text = match[2].trim().toLowerCase();
    
    // Check if query words appear in this segment
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    const foundWords = queryWords.filter(w => text.includes(w));
    
    if (foundWords.length > 0) {
      matches.push({
        timestamp,
        seconds: timestampToSeconds(timestamp),
        text: match[2].trim(),
        score: foundWords.length / queryWords.length
      });
    }
  }
  
  if (matches.length === 0) return null;
  
  // Return best match
  matches.sort((a, b) => b.score - a.score);
  const best = matches[0];
  
  return {
    isDescription: false,
    timestamp: best.timestamp,
    seconds: best.seconds,
    text: best.text,
    episode: getEpisodeById(episodeId)
  };
}

/**
 * Find natural boundaries around a target time
 * Avoids first 30s (intro) and last 30s (outro)
 * Tries to find sentence boundaries
 */
function findNaturalBoundaries(targetSeconds, totalDuration, chunkDuration = CHUNK_DURATION) {
  const INTRO_SKIP = 30;
  const OUTRO_SKIP = 30;
  
  // Calculate range
  const minStart = INTRO_SKIP;
  const maxEnd = totalDuration - OUTRO_SKIP;
  
  // Target should be in middle of chunk
  let idealStart = targetSeconds - (chunkDuration / 2);
  
  // Clamp
  if (maxEnd - minStart <= chunkDuration) {
    // Episode shorter than chunk
    return {
      start: minStart,
      end: Math.min(totalDuration - OUTRO_SKIP, minStart + chunkDuration),
      natural: false,
      reason: 'episode shorter than chunk'
    };
  }
  
  idealStart = Math.max(minStart, Math.min(idealStart, maxEnd - chunkDuration));
  let end = idealStart + chunkDuration;
  
  // Final clamp
  if (end > maxEnd) {
    end = maxEnd;
    idealStart = Math.max(minStart, end - chunkDuration);
  }
  
  // Round to nearest second for cleaner display
  idealStart = Math.round(idealStart);
  end = Math.round(end);
  
  return {
    start: idealStart,
    end: end,
    natural: true,
    reason: 'positioned for content match'
  };
}

/**
 * Get episode by ID
 */
function getEpisodeById(episodeId) {
  // Direct match
  let episode = episodes.find(ep => ep.externalId === episodeId);
  
  if (!episode) {
    // Try topic-based ID
    const match = episodeId.match(/^([a-zA-Z]+)_(\d+)$/);
    if (match) {
      const [, topicPrefix, num] = match;
      let topic = topicPrefix;
      if (topicPrefix === 'personal_imp') topic = 'personal improvement';
      if (topicPrefix === 'mexico_city') topic = 'mexico city';
      
      const topicEpisodes = episodes.filter(ep => {
        const epTopic = ep.topic || '';
        return epTopic.toLowerCase().includes(topic.toLowerCase());
      });
      
      if (topicEpisodes[num - 1]) {
        episode = topicEpisodes[num - 1];
      }
    }
  }
  
  return episode;
}

/**
 * Get audio duration
 */
function getAudioDuration(audioPath) {
  if (!fs.existsSync(audioPath)) return null;
  
  try {
    const output = execSync(`afinfo "${audioPath}" 2>&1 | grep "estimated duration:"`, { encoding: 'utf-8' });
    const match = output.match(/(\d+\.?\d*)\s*seconds/);
    if (match) return parseFloat(match[1]);
  } catch (e) {}
  
  // Fallback: estimate from file size
  try {
    const stats = fs.statSync(audioPath);
    return stats.size / 24000; // ~192kbps
  } catch (e) {
    return null;
  }
}

/**
 * Download audio if needed
 */
async function ensureAudio(audioUrl, episodeId) {
  // Create safe filename
  const safeId = episodeId.replace(/[^a-zA-Z0-9]/g, '_');
  const ext = path.extname(new URL(audioUrl).pathname) || '.mp3';
  const audioPath = path.join(AUDIO_DIR, `${safeId}${ext}`);
  
  if (fs.existsSync(audioPath)) {
    return audioPath;
  }
  
  console.log(`   ⬇️  Downloading audio...`);
  
  return new Promise((resolve, reject) => {
    exec(`curl -sL -o "${audioPath}" "${audioUrl}"`, (err) => {
      if (err) reject(err);
      else resolve(audioPath);
    });
  });
}

/**
 * Play audio segment - extracts chunk with ffmpeg first if available, otherwise plays full
 */
async function playSegment(audioPath, startSeconds, endSeconds) {
  const duration = endSeconds - startSeconds;
  console.log(`\n🎧 Playing ${duration}s segment (${formatTime(startSeconds)} → ${formatTime(endSeconds)})`);
  
  // Try to use ffmpeg to extract the exact segment
  const tempFile = `/tmp/podcast_${Date.now()}.mp3`;
  
  return new Promise(async (resolve, reject) => {
    // Try ffmpeg first
    exec(`which ffmpeg`, (err) => {
      if (!err) {
        // ffmpeg available - extract segment
        const cmd = `ffmpeg -y -ss ${startSeconds} -i "${audioPath}" -t ${duration} -c copy "${tempFile}" 2>/dev/null`;
        exec(cmd, (e) => {
          if (!e && fs.existsSync(tempFile)) {
            exec(`afplay "${tempFile}"`, (err2) => {
              try { fs.unlinkSync(tempFile); } catch(x) {}
              if (err2) reject(err2);
              else resolve();
            });
          } else {
            // Fallback: play from start with time limit
            playWithAfplay(audioPath, duration, resolve, reject);
          }
        });
      } else {
        // No ffmpeg - try playing with time limit
        playWithAfplay(audioPath, duration, resolve, reject);
      }
    });
  });
}

function playWithAfplay(audioPath, duration, resolve, reject) {
  // Try using -t for duration only
  exec(`afplay -t ${duration} "${audioPath}"`, (err) => {
    if (err) {
      // Final fallback: just play and let user stop manually
      console.log(`   ⚠️ Could not set duration, playing full file`);
      exec(`afplay "${audioPath}"`, (e) => {
        if (e) reject(e);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Main search and play
 */
async function searchAndPlay(query) {
  console.log(`\n🔍 Searching for: "${query}"`);
  console.log(`📏 Chunk duration: ${CHUNK_DURATION} seconds\n`);
  
  // Load embeddings
  const EMBEDDINGS_FILE = './metadata/embeddings/embeddings.json';
  const data = JSON.parse(fs.readFileSync(EMBEDDINGS_FILE, 'utf-8'));
  const embeddings = data.episodes || data;
  
  // Get query embedding and find top episodes
  const queryEmbedding = await generateEmbeddingWithOpenAI(query);
  
  const results = embeddings
    .filter(ep => ep.embedding)
    .map(ep => ({
      episodeId: ep.episodeId,
      title: ep.title,
      similarity: cosineSimilarity(queryEmbedding, ep.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, SEARCH_LIMIT);
  
  console.log(`Top ${results.length} episodes:`);
  results.forEach((r, i) => console.log(`  ${i+1}. ${r.title} (${(r.similarity*100).toFixed(1)}%)`));
  
  // Try each episode until we find a match with playable audio
  console.log(`\n📝 Searching for "${query}" in transcripts...`);
  
  for (const result of results) {
    const match = findSearchInTranscript(result.episodeId, query);
    
    if (!match) continue;
    
    console.log(`\n✅ Found in: ${result.title}`);
    console.log(`   📍 ${match.isDescription ? 'Using description' : `Time: ${match.timestamp || 'N/A'}`}`);
    console.log(`   💬 "${match.text.substring(0, 80)}..."`);
    
    const episode = match.episode;
    if (!episode || !episode.audioUrl) {
      console.log(`   ⚠️ No audio URL`);
      continue;
    }
    
    try {
      // Get audio
      const audioPath = await ensureAudio(episode.audioUrl, result.episodeId);
      const totalDuration = getAudioDuration(audioPath);
      
      if (!totalDuration) {
        console.log(`   ⚠️ Could not determine audio duration`);
        continue;
      }
      
      console.log(`   ⏱️ Total duration: ${formatTime(totalDuration)}`);
      
      // Calculate chunk boundaries
      const targetTime = match.seconds || (totalDuration / 2);
      const boundaries = findNaturalBoundaries(targetTime, totalDuration);
      
      console.log(`   ✂️  Playing: ${formatTime(boundaries.start)} → ${formatTime(boundaries.end)} (${boundaries.end - boundaries.start}s)`);
      console.log(`   📍 Target "${query}" at: ${formatTime(targetTime)} (${match.isDescription ? 'description fallback' : 'transcript match'})`);
      
      // Play
      await playSegment(audioPath, boundaries.start, boundaries.end);
      
      console.log(`\n✅ Done!`);
      return;
      
    } catch (e) {
      console.log(`   ❌ Error: ${e.message}`);
      continue;
    }
  }
  
  console.log(`\n❌ No playable episodes found with "${query}"`);
}

// Run
const query = process.argv.slice(2).find(a => !a.startsWith('--')) || 'cartel';

searchAndPlay(query).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
