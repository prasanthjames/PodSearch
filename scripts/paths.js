/**
 * Path Configuration
 * Centralized folder paths for Tell Me More
 */

const path = require('path');

// Base directory
const BASE_DIR = path.join(__dirname, '..');

// Data directories
const DATA_DIR = path.join(BASE_DIR, 'data');
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
const TRANSCRIPTIONS_DIR = path.join(DATA_DIR, 'transcriptions');

// Metadata directories
const METADATA_DIR = path.join(BASE_DIR, 'metadata');
const EMBEDDINGS_DIR = path.join(METADATA_DIR, 'embeddings');

// Files
const EPISODES_FILE = path.join(DATA_DIR, 'episodes.json');
const EMBEDDINGS_FILE = path.join(EMBEDDINGS_DIR, 'embeddings.json');

module.exports = {
  BASE_DIR,
  DATA_DIR,
  AUDIO_DIR,
  TRANSCRIPTIONS_DIR,
  METADATA_DIR,
  EMBEDDINGS_DIR,
  EPISODES_FILE,
  EMBEDDINGS_FILE
};
