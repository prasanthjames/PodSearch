#!/usr/bin/env node
/**
 * Scheduler Orchestrator
 * Runs scheduler steps incrementally across heartbeats
 * 
 * Step 1: Fetch episodes (lightweight)
 * Step 2: Build queue (lightweight)
 * Step 3: Process 1 episode (heavy)
 * 
 * Usage: node scripts/scheduler-orchestrator.js
 * 
 * Cron: Every 30 min -> runs appropriate step
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { DATA_DIR } = require('./paths');

const STATE_FILE = path.join(DATA_DIR, 'scheduler-state.json');
const QUEUE_FILE = path.join(DATA_DIR, 'scheduler-queue.json');

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { lastStep: 0, lastRun: null };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  } catch (e) {
    return { lastStep: 0, lastRun: null };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function runStep(script) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [script], { cwd: path.join(__dirname, '..') });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.slice(-200)));
    });
  });
}

async function main() {
  const state = loadState();
  const now = new Date();
  
  console.log(`Scheduler Orchestrator - ${now.toISOString()}`);
  console.log(`Last step: ${state.lastStep}, Last run: ${state.lastRun}`);
  
  // Determine next step
  // Step 1: Every hour at :00 - fetch
  // Step 2: :05 - build queue  
  // Step 3: :10, :40 - process episode (can run multiple times)
  
  const minute = now.getMinutes();
  
  let nextStep = 0;
  let stepName = '';
  
  if (minute === 0) {
    nextStep = 1;
    stepName = 'Step 1: Fetch';
  } else if (minute === 5) {
    nextStep = 2;
    stepName = 'Step 2: Build Queue';
  } else if (minute === 10 || minute === 40) {
    nextStep = 3;
    stepName = 'Step 3: Process Episode';
  } else {
    // Check if queue has items, process anyway
    const queue = fs.existsSync(QUEUE_FILE) ? JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8')) : [];
    if (queue.length > 0) {
      nextStep = 3;
      stepName = 'Step 3: Process Episode';
    } else {
      console.log('Nothing to do');
      return;
    }
  }
  
  console.log(`Running: ${stepName}`);
  
  try {
    const script = path.join(__dirname, `scheduler-step${nextStep}.js`);
    await runStep(script);
    
    saveState({ lastStep: nextStep, lastRun: now.toISOString() });
    console.log(`${stepName} complete`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

main();
