#!/usr/bin/env node
/**
 * Scheduler: Step 2 - Build Queue
 * Identify episodes to process next
 * 
 * Usage: node scripts/scheduler-step2.js
 */

const fs = require('fs');
const path = require('path');
const { EPISODES_FILE, DATA_DIR, TRANSCRIPTIONS_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const QUEUE_FILE = path.join(DATA_DIR, 'scheduler-queue.json');
const PROCESSED_FILE = path.join(DATA_DIR, 'processed-episodes.json');
const DLQ_FILE = path.join(DATA_DIR, 'dlq.json');
const PERMANENT_FAIL_FILE = path.join(DATA_DIR, 'permanent-fail.json');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

function loadJSON(file, defaultVal = []) {
  if (!fs.existsSync(file)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch (e) { return defaultVal; }
}

function getTranscribedIds() {
  if (!fs.existsSync(TRANSCRIPTIONS_DIR)) return new Set();
  return new Set(fs.readdirSync(TRANSCRIPTIONS_DIR).filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', '')));
}

function main() {
  log('=== BUILD QUEUE: Identify episodes to process ===');
  
  const transcribed = getTranscribedIds();
  const processed = new Set(loadJSON(PROCESSED_FILE));
  const dlq = loadJSON(DLQ_FILE);
  const permanentFail = loadJSON(PERMANENT_FAIL_FILE);
  
  const permanentFailIds = new Set(permanentFail.map(p => p.episode?.externalId));
  const dlqIds = new Set(dlq.map(d => d.episode?.externalId));
  
  // Load episodes
  if (!fs.existsSync(EPISODES_FILE)) {
    log('No episodes file');
    return;
  }
  
  const allEpisodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  
  // Group by topic, sort by date
  const topics = {};
  for (const ep of allEpisodes) {
    const topic = ep.topic || 'unknown';
    if (!topics[topic]) topics[topic] = [];
    topics[topic].push(ep);
  }
  
  for (const topic in topics) {
    topics[topic].sort((a, b) => new Date(b.publishDate || 0) - new Date(a.publishDate || 0));
  }
  
  // Build queue: up to 3 per topic, newest first
  const queue = [];
  const maxPerTopic = 3;
  
  for (const topic in topics) {
    let count = 0;
    for (const ep of topics[topic]) {
      if (count >= maxPerTopic) break;
      
      const topicNum = topics[topic].indexOf(ep) + 1;
      const simpId = `${topic}_${String(topicNum).padStart(3, '0')}`;
      
      // Skip if already done
      if (processed.has(simpId) || transcribed.has(simpId)) continue;
      if (permanentFailIds.has(ep.externalId)) continue;
      
      queue.push({
        simplifiedId: simpId,
        externalId: ep.externalId,
        title: ep.title,
        topic,
        audioUrl: ep.audioUrl,
        inDlq: dlqIds.has(ep.externalId)
      });
      
      count++;
    }
  }
  
  // Save queue
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  
  log(`Queue built: ${queue.length} episodes to process`);
}

main();
