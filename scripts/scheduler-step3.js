#!/usr/bin/env node
/**
 * Scheduler: Step 3 - Process One Episode
 * Transcribe + Embed + Cleanup with exponential backoff
 * 
 * Usage: node scripts/scheduler-step3.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DATA_DIR, TRANSCRIPTIONS_DIR, EMBEDDINGS_FILE } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const QUEUE_FILE = path.join(DATA_DIR, 'scheduler-queue.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-episodes.json');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');
const PERMANENT_FAIL_FILE = path.join(DATA_DIR, 'permanent-fail.json');

const MAX_RETRIES = 5;
const BACKOFF_MS = [1800000, 3600000, 7200000, 14400000, 28800000]; // 30m, 1h, 2h, 4h, 8h

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

function loadJSON(file, defaultVal = []) {
  if (!fs.existsSync(file)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { return defaultVal; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function runCommand(cmd, args, timeout = 300000) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: path.join(__dirname, '..') });
    let stderr = '';
    let timedOut = false;
    const timeoutId = setTimeout(() => { timedOut = true; proc.kill(); }, timeout);
    
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      clearTimeout(timeoutId);
      if (timedOut) reject(new Error('Timeout'));
      else if (code === 0) resolve();
      else reject(new Error(stderr.slice(-300)));
    });
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('=== PROCESS: Download → Transcribe → Embed ===');
  
  // Load queue
  const queue = loadJSON(QUEUE_FILE);
  if (queue.length === 0) {
    log('Queue empty, nothing to process');
    return;
  }
  
  // Get first episode
  const episode = queue[0];
  const { simplifiedId, externalId, title, audioUrl, inDlq } = episode;
  
  log(`Processing: ${title?.substring(0, 40)} (${simplifiedId})`);
  
  // Check DLQ retry count
  const dlq = loadJSON(DLQ_FILE);
  const dlqEntry = dlq.find(d => d.episode?.externalId === externalId);
  const retryCount = dlqEntry?.retryCount || 0;
  
  if (retryCount >= MAX_RETRIES) {
    log(`Max retries exceeded, moving to permanent fail`);
    const permanentFail = loadJSON(PERMANENT_FAIL_FILE);
    permanentFail.push({ episode, error: dlqEntry.error, failedAt: new Date().toISOString() });
    saveJSON(PERMANENT_FAIL_FILE, permanentFail);
    
    // Remove from queue and DLQ
    queue.shift();
    const newDlq = dlq.filter(d => d.episode?.externalId !== externalId);
    saveJSON(DLQ_FILE, newDlq);
    saveJSON(QUEUE_FILE, queue);
    
    log(`Moved to permanent fail`);
    return;
  }
  
  // Exponential backoff if retry
  if (inDlq && retryCount > 0) {
    const backoff = BACKOFF_MS[Math.min(retryCount - 1, BACKOFF_MS.length - 1)];
    log(`Backoff ${backoff}ms before retry ${retryCount + 1}`);
    await sleep(backoff);
  }
  
  // Process: download + transcribe + embed
  try {
    await runCommand('node', ['scripts/transcribe.js', '1']);
    
    // Mark as processed
    const processed = loadJSON(PROCESSED_FILE);
    if (!processed.includes(simplifiedId)) {
      processed.push(simplifiedId);
      saveJSON(PROCESSED_FILE, processed);
    }
    
    // Remove from queue
    queue.shift();
    saveJSON(QUEUE_FILE, queue);
    
    // Remove from DLQ if present
    if (dlqEntry) {
      const newDlq = dlq.filter(d => d.episode?.externalId !== externalId);
      saveJSON(DLQ_FILE, newDlq);
    }
    
    log(`Done: ${simplifiedId}`);
    
  } catch (err) {
    log(`Failed: ${err.message}`);
    
    // Add/update DLQ
    let newDlq = dlq.filter(d => d.episode?.externalId !== externalId);
    newDlq.push({
      episode,
      error: err.message,
      retryCount: retryCount + 1,
      failedAt: new Date().toISOString()
    });
    saveJSON(DLQ_FILE, newDlq);
    
    // Move to next in queue (don't remove failed)
    queue.push(queue.shift());
    saveJSON(QUEUE_FILE, queue);
    
    log(`Added to DLQ, retry ${retryCount + 1}`);
  }
  
  log('=== PROCESS COMPLETE ===');
}

main();
