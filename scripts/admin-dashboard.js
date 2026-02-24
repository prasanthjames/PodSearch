#!/usr/bin/env node
/**
 * Admin Dashboard - Workflow Stats
 * Shows scheduler statistics, DLQ, permanent fails
 * 
 * Usage: node scripts/admin-dashboard.js
 */

const fs = require('fs');
const path = require('path');
const { DATA_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-episodes.json');
const PERMANENT_FAIL_FILE = path.join(DATA_DIR, 'permanent-fail.json');

function loadJSON(file, defaultVal = []) {
  if (!fs.existsSync(file)) return defaultVal;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) {
    return defaultVal;
  }
}

function getStats() {
  // Episode counts
  const transcribed = fs.existsSync(TRANSCRIPTIONS_DIR) 
    ? fs.readdirSync(TRANSCRIPTIONS_DIR).filter(f => f.endsWith('.txt')).length 
    : 0;
  
  const embeddings = loadJSON(path.join(EMBEDDINGS_DIR, 'embeddings.json'));
  const embeddingCount = embeddings.episodes?.length || embeddings.length || 0;
  
  const processed = loadJSON(PROCESSED_FILE);
  const dlq = loadJSON(DLQ_FILE);
  const permanentFail = loadJSON(PERMANENT_FAIL_FILE);
  const queue = loadJSON(path.join(DATA_DIR, 'scheduler-queue.json'));
  
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
    embeddingCount,
    processedCount: processed.length,
    queueCount: queue.length,
    dlqCount: dlq.length,
    permanentFailCount: permanentFail.length,
    currentStatus,
    recentLogs
  };
}

function displayDashboard() {
  const stats = getStats();
  
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           PODSEARCH ADMIN DASHBOARD                        ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  📥 Queue Ready:       ${String(stats.queueCount).padStart(6)}                       ║`);
  console.log(`║  📻 Episodes Transcribed:  ${String(stats.transcribed).padStart(6)}                       ║`);
  console.log(`║  🔢 Embeddings Created:   ${String(stats.embeddingCount).padStart(6)}                       ║`);
  console.log(`║  ✅ Processed Successfully: ${String(stats.processedCount).padStart(5)}                      ║`);
  console.log(`║  ⏳ DLQ (Retry Queue):    ${String(stats.dlqCount).padStart(6)}                       ║`);
  console.log(`║  ❌ Permanent Fails:      ${String(stats.permanentFailCount).padStart(6)}                       ║`);
  
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
    console.log('\n❌ Permanent Fails:');
    const fails = loadJSON(PERMANENT_FAIL_FILE);
    fails.slice(-5).forEach((item, i) => {
      console.log(`  ${i+1}. ${item.episode?.title?.substring(0, 40) || item.episode?.externalId}`);
      console.log(`     Final Error: ${item.error?.substring(0, 50)}`);
    });
  }
}

displayDashboard();
