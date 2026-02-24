#!/usr/bin/env node
/**
 * PodSearch Hourly Scheduler v2
 * Downloads, transcribes, and embeds new podcast episodes
 * 
 * Features:
 * - Process 3 episodes per topic per run
 * - Filter by show rating
 * - Exponential backoff retries
 * - Dead Letter Queue for failures
 * 
 * Usage: node scripts/scheduler.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EPISODES_FILE, DATA_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-episodes.json');

const MAX_EPISODES_PER_TOPIC = 3;
const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

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
 * Load DLQ
 */
function loadDLQ() {
  if (fs.existsSync(DLQ_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DLQ_FILE, 'utf-8'));
    } catch (e) { return []; }
  }
  return [];
}

/**
 * Save DLQ
 */
function saveDLQ(dlq) {
  fs.writeFileSync(DLQ_FILE, JSON.stringify(dlq, null, 2));
}

/**
 * Add to DLQ
 */
function addToDLQ(episode, error, retryCount) {
  const dlq = loadDLQ();
  dlq.push({
    episode,
    error: error.message || String(error),
    retryCount,
    failedAt: new Date().toISOString()
  });
  saveDLQ(dlq);
  log(`Added to DLQ: ${episode.externalId} (${retryCount} retries)`);
}

/**
 * Load processed episodes
 */
function loadProcessed() {
  if (fs.existsSync(PROCESSED_FILE)) {
    try {
      return new Set(JSON.parse(fs.readFileSync(PROCESSED_FILE, 'utf-8')));
    } catch (e) { return new Set(); }
  }
  return new Set();
}

/**
 * Save processed episodes
 */
function saveProcessed(processed) {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify([...processed], null, 2));
}

/**
 * Get transcribed IDs
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
 * Run command with exponential backoff retry
 */
async function runWithRetry(cmd, args, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await runCommand(cmd, args);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries - 1) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        log(`Retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms...`);
        await sleep(backoffMs);
      }
    }
  }
  throw lastError;
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
 * Get topic key for episode
 */
function getTopicKey(episode) {
  return episode.topic || 'unknown';
}

/**
 * Check if episode is from highly rated show
 * (In future: check showRating from API)
 */
function isHighlyRated(episode) {
  // For now, accept all shows
  // TODO: Integrate show rating from Apple Podcasts API
  return true;
}

/**
 * Main scheduler
 */
async function checkAndProcess() {
  log('=== Starting hourly scheduler ===');
  
  const dlq = loadDLQ();
  const processed = loadProcessed();
  const transcribed = getTranscribedIds();
  
  log(`DLQ: ${dlq.length}, Processed: ${processed.size}, Transcribed: ${transcribed.size}`);
  
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
  
  // 3. Group by topic and sort by publish date (newest first)
  const topics = {};
  for (const ep of allEpisodes) {
    const key = getTopicKey(ep);
    if (!topics[key]) topics[key] = [];
    topics[key].push(ep);
  }
  
  // Sort each topic by publish date
  for (const key in topics) {
    topics[key].sort((a, b) => {
      const dateA = new Date(a.publishDate || 0);
      const dateB = new Date(b.publishDate || 0);
      return dateB - dateA; // newest first
    });
  }
  
  // 4. Process up to 3 episodes per topic
  let processedCount = 0;
  
  for (const topic in topics) {
    if (processedCount >= 9) break; // Max 9 episodes per run (3 topics x 3)
    
    const topicEps = topics[topic];
    let topicProcessed = 0;
    
    for (const episode of topicEps) {
      if (topicProcessed >= MAX_EPISODES_PER_TOPIC) break;
      if (processedCount >= 9) break;
      
      // Create simplified ID
      const topicNum = topicEps.indexOf(episode) + 1;
      const simpId = `${topic}_${String(topicNum).padStart(3, '0')}`;
      
      // Skip if already processed
      if (processed.has(simpId) || transcribed.has(simpId)) {
        continue;
      }
      
      // Check if in DLQ (skip if too many retries)
      const dlqEntry = dlq.find(d => d.episode?.externalId === episode.externalId);
      if (dlqEntry && dlqEntry.retryCount >= MAX_RETRIES) {
        log(`Skipping ${simpId}: max retries exceeded`);
        continue;
      }
      
      // Skip if not highly rated
      if (!isHighlyRated(episode)) {
        log(`Skipping ${simpId}: not highly rated`);
        processed.add(simpId); // Mark as skipped
        continue;
      }
      
      log(`Processing: ${episode.title?.substring(0, 40)}... (${simpId})`);
      
      // Process episode with retry
      try {
        await runWithRetry('node', ['scripts/transcribe.js', '1'], MAX_RETRIES);
        
        // Mark as processed
        processed.add(simpId);
        saveProcessed(processed);
        
        log(`Done: ${simpId}`);
        processedCount++;
        topicProcessed++;
        
      } catch (err) {
        log(`Failed: ${simpId} - ${err.message}`);
        addToDLQ(episode, err, (dlqEntry?.retryCount || 0) + 1);
        processedCount++;
        topicProcessed++;
      }
    }
  }
  
  log(`=== Scheduler complete. Processed ${processedCount} episodes ===`);
}

// Run if called directly
if (require.main === module) {
  checkAndProcess().catch(err => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { checkAndProcess };
