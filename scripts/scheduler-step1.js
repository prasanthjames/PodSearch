#!/usr/bin/env node
/**
 * Scheduler: Step 1 - Fetch Episodes
 * Lightweight: just fetch new episodes
 * 
 * Usage: node scripts/scheduler-step1.js
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EPISODES_FILE, DATA_DIR } = require('./paths');

const LOG_FILE = path.join(DATA_DIR, 'scheduler.log');
const QUEUE_FILE = path.join(DATA_DIR, 'scheduler-queue.json');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`);
}

function runCommand(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: path.join(__dirname, '..') });
    let stderr = '';
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(stderr.slice(-200)));
    });
  });
}

async function main() {
  log('=== Scheduler Step 1: Fetch ===');
  
  try {
    await runCommand('node', ['scripts/fetch-episodes.js']);
    log('Fetch complete');
    
    // Check episodes file
    if (!fs.existsSync(EPISODES_FILE)) {
      log('No episodes file');
      return;
    }
    
    const episodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
    log(`Total episodes: ${episodes.length}`);
    
    log('Step 1 complete');
  } catch (err) {
    log(`Error: ${err.message}`);
  }
}

main();
