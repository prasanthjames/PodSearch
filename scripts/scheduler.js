#!/usr/bin/env node
/**
 * Hourly Scheduler for PodSearch
 * Downloads, transcribes, and embeds new podcast episodes
 * 
 * Usage: node scripts/scheduler.js
 * Run via cron: 0 * * * * /usr/bin/node /path/to/scripts/scheduler.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EPISODES_FILE, DATA_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_FILE } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');

/**
 * Log with timestamp
 */
function log(msg) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${msg}`;
  console.log(logLine);
  fs.appendFileSync(LOG_FILE, logLine + '\n');
}

/**
 * Run a command and return promise
 */
function runCommand(cmd, args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: path.join(__dirname, '..') });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    
    const timeoutId = setTimeout(() => {
      timedOut = true;
      proc.kill();
      reject(new Error('Command timed out'));
    }, timeout);
    
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    
    proc.on('close', code => {
      clearTimeout(timeoutId);
      if (timedOut) return;
      if (code === 0) resolve(stdout);
      else reject(new Error(`Exit ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/**
 * Get already transcribed IDs
 */
function getTranscribedIds() {
  if (!fs.existsSync(TRANSCRIPTIONS_DIR)) return new Set();
  return new Set(
    fs.readdirSync(TRANSCRIPTIONS_DIR)
      .filter(f => f.endsWith('.txt'))
      .map(f => f.replace('.txt', ''))
  );
}

/**
 * Check for new episodes and process them
 */
async function checkAndProcess() {
  log('=== Starting hourly check ===');
  
  // Get already transcribed
  const transcribed = getTranscribedIds();
  log(`Already transcribed: ${transcribed.size}`);
  
  // 1. Fetch new episodes
  log('Fetching new episodes...');
  try {
    await runCommand('node', ['scripts/fetch-episodes.js'], 60000);
    log('Fetch complete');
  } catch (err) {
    log(`Fetch error: ${err.message}`);
  }
  
  // 2. Load episodes
  if (!fs.existsSync(EPISODES_FILE)) {
    log('No episodes file found');
    return;
  }
  
  const allEpisodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  
  // 3. Build simplified ID mapping: episode[index] -> topic_N
  const topicCounts = {};
  const episodeToSimplified = {};
  
  for (let i = 0; i < allEpisodes.length; i++) {
    const ep = allEpisodes[i];
    const topic = ep.topic || 'unknown';
    if (!topicCounts[topic]) topicCounts[topic] = 0;
    topicCounts[topic]++;
    episodeToSimplified[i] = `${topic}_${String(topicCounts[topic]).padStart(3, '0')}`;
  }
  
  // 4. Find first unprocessed episode
  let firstUnprocessed = null;
  for (let i = 0; i < allEpisodes.length; i++) {
    const simpId = episodeToSimplified[i];
    if (!transcribed.has(simpId)) {
      firstUnprocessed = { index: i, simplifiedId: simpId, episode: allEpisodes[i] };
      break;
    }
  }
  
  if (!firstUnprocessed) {
    log('All episodes already transcribed');
    return;
  }
  
  log(`Next episode to process: ${firstUnprocessed.simplifiedId}`);
  log(`Title: ${firstUnprocessed.episode.title?.substring(0, 50)}`);
  
  // 5. Process one episode
  try {
    await runCommand('node', ['scripts/transcribe.js', '1'], 300000);
    log(`Transcription complete: ${firstUnprocessed.simplifiedId}`);
  } catch (err) {
    log(`Transcription error: ${err.message}`);
  }
  
  log('=== Hourly check complete ===');
}

// Run if called directly
if (require.main === module) {
  checkAndProcess().catch(err => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { checkAndProcess };
