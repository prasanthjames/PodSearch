#!/usr/bin/env node
/**
 * Admin Dashboard - Workflow Stats
 * Shows scheduler statistics, DLQ, permanent fails
 * 
 * Usage: node scripts/admin-dashboard.js
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_DIR, AUDIO_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-episodes.json');
const PERMANENT_FAIL_FILE = path.join(DATA_DIR, 'permanent-fail.json');

// Load topics dynamically from fetch-episodes.js
let TOPICS = [];
try {
  const fetchContent = fs.readFileSync(path.join(__dirname, 'fetch-episodes.js'), 'utf-8');
  const match = fetchContent.match(/const TOPICS = \[[\s\S]*?\];/);
  if (match) {
    // Convert JS array to valid JSON (single quotes to double quotes)
    let topicsStr = match[0].replace('const TOPICS = ', '').replace(';', '');
    topicsStr = topicsStr.replace(/'/g, '"');
    TOPICS = JSON.parse(topicsStr);
  }
} catch (e) {
  TOPICS = ['finance', 'personal improvement']; // fallback
}

function loadJSON(file, defaultVal = []) {
  if (!fs.existsSync(file)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return defaultVal;
  }
}

function getStats() {
  // Queue: episodes identified but not yet downloaded
  const queue = loadJSON(path.join(DATA_DIR, 'scheduler-queue.json'));
  
  // Downloaded: ALL audio files in data folder
  const dataAudioFiles = fs.existsSync(AUDIO_DIR)
    ? fs.readdirSync(AUDIO_DIR).filter(f => f.endsWith('.mp3') || f.endsWith('.m4a')).length
    : 0;
  
  // Transcribed: audio files NOT yet transcribed
  const transcribedIds = fs.existsSync(TRANSCRIPTIONS_DIR) 
    ? new Set(fs.readdirSync(TRANSCRIPTIONS_DIR).filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', '')))
    : new Set();
    
  const downloadedPending = fs.existsSync(AUDIO_DIR) 
    ? fs.readdirSync(AUDIO_DIR).filter(f => (f.endsWith('.mp3') || f.endsWith('.m4a')) && !transcribedIds.has(f.replace(/\.(mp3|m4a)/, ''))).length
    : 0;
  
  // Transcribed: transcripts NOT yet embedded  
  const embeddedIds = new Set((loadJSON(path.join(EMBEDDINGS_DIR, 'embeddings.json')).episodes || []).map(e => e.episodeId));
  const transcribed = fs.existsSync(TRANSCRIPTIONS_DIR) 
    ? fs.readdirSync(TRANSCRIPTIONS_DIR).filter(f => f.endsWith('.txt') && !embeddedIds.has(f.replace('.txt', ''))).length
    : 0;
  
  // Embeddings: NOT yet embedded (transcribed but no embedding)
  const embeddingsRemaining = transcribed;
  const embeddingCount = embeddedIds.size;
  
  // Count embeddings by topic
  const embeddingsData = loadJSON(path.join(EMBEDDINGS_DIR, 'embeddings.json'));
  const embeddingsByTopic = {};
  for (const ep of (embeddingsData.episodes || [])) {
    const t = ep.topic || 'unknown';
    embeddingsByTopic[t] = (embeddingsByTopic[t] || 0) + 1;
  }
  
  // Processed: count "Done:" in last 24 hours from logs
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  let processedToday = 0;
  if (fs.existsSync(LOG_FILE)) {
    const logs = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
    for (const log of logs) {
      const match = log.match(/\[([\d\-T:+:.]+Z)\].*Done:/);
      if (match) {
        const logTime = new Date(match[1]).getTime();
        if (logTime > oneDayAgo) processedToday++;
      }
    }
  }
  
  const dlq = loadJSON(DLQ_FILE);
  const permanentFail = loadJSON(PERMANENT_FAIL_FILE);
  
  // Recent log entries with timestamps
  let recentLogs = [];
  let currentStatus = null;
  
  if (fs.existsSync(LOG_FILE)) {
    const logs = fs.readFileSync(LOG_FILE, 'utf-8').split('\n');
    
    // Get current in-progress status
    const processing = logs.filter(l => l.includes('Processing:')).pop();
    if (processing) {
      const match = processing.match(/Processing: (.+)/);
      if (match) currentStatus = match[1].substring(0, 50);
    }
    
    // Get last 10 process events
    const logLines = logs.filter(l => 
      l.includes('FETCH') || l.includes('BUILD QUEUE') || l.includes('PROCESS') || l.includes('COMPLETE') || l.includes('Processing:')
    );
    recentLogs = logLines.slice(-15).reverse();
  }
  
  return {
    transcribed,
    downloaded: dataAudioFiles,
    downloadedPending,
    embeddingsRemaining,
    embeddingCount,
    embeddingsByTopic,
    processedToday,
    queueCount: queue.length,
    dlqCount: dlq.length,
    permanentFailCount: permanentFail.length,
    currentStatus,
    recentLogs
  };
}

function displayDashboard() {
  const stats = getStats();
  
  // Build topic stats string
  const topicStats = TOPICS.map(t => `${t}:${stats.embeddingsByTopic[t] || 0}`).join(' | ');
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           PODSEARCH ADMIN DASHBOARD                        ║');
  console.log(`║  📻 Topics: ${topicStats}`.padEnd(56) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  📥 Queue:            ${String(stats.queueCount).padStart(6)} (Remaining)              ║`);
  console.log(`║  ⬇️  Downloaded:       ${String(stats.downloaded).padStart(6)} total | ${String(stats.downloadedPending).padStart(3)} pending             ║`);
  console.log(`║  📝 Transcribed:      ${String(stats.transcribed).padStart(6)} (Remaining)             ║`);
  console.log(`║  🔢 Embeddings:        ${String(stats.embeddingsRemaining).padStart(6)} (Remaining)              ║`);
  console.log(`║  ✅ Processed:         ${String(stats.processedToday).padStart(6)} (24h)                       ║`);
  console.log(`║  ⏳ DLQ:               ${String(stats.dlqCount).padStart(6)} (Remaining)                   ║`);
  console.log(`║  ❌ Failed:            ${String(stats.permanentFailCount).padStart(6)}                       ║`);
  
  if (stats.currentStatus) {
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║  🔄 CURRENT: ${stats.currentStatus.padEnd(36)}║`);
  }
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  📜 Recent Activity:                                     ║');
  for (const log of stats.recentLogs) {
    // Extract timestamp and message
    const match = log.match(/\[([\d\-T:+:.]+Z)\]\s*(.*)/);
    if (match) {
      const time = new Date(match[1]).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      const msg = match[2].substring(0, 40);
      console.log(`║  ${time} │ ${msg.padEnd(40)}║`);
    } else {
      console.log(`║    ${log.substring(0, 50).padStart(50)}║`);
    }
  }
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  // Show DLQ if any
  if (stats.dlqCount > 0) {
    console.log('\n⏳ DLQ (Dead Letter Queue):');
    const dlq = loadJSON(DLQ_FILE);
    dlq.slice(-5).forEach((item, i) => {
      console.log(`  ${i+1}. ${item.episode?.title?.substring(0, 40) || item.episode?.externalId}`);
      console.log(`     Error: ${item.error?.substring(0, 50)}`);
      console.log(`     Retries: ${item.retryCount}, Failed: ${item.failedAt}`);
    });
  }
  
  // Show permanent fails
  if (stats.permanentFailCount > 0) {
    console.log('\n❌ Failed:');
    const fails = loadJSON(PERMANENT_FAIL_FILE);
    fails.slice(-5).forEach((item, i) => {
      console.log(`  ${i+1}. ${item.episode?.title?.substring(0, 40) || item.episode?.externalId}`);
      console.log(`     Final Error: ${item.error?.substring(0, 50)}`);
    });
  }
}

displayDashboard();
