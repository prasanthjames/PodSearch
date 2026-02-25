#!/usr/bin/env node
/**
 * Master Trigger
 * Runs daily at 5 AM - fetches new episodes by topic
 * 
 * Usage: node scripts/master-trigger.js
 * Cron: 0 5 * * * (5 AM daily)
 */

const fs = require('fs');
const path = require('path');
const { EPISODES_FILE, DATA_DIR } = require('./paths');

// Load topics from fetch-episodes.js
function loadTopics() {
  const fetchContent = fs.readFileSync(path.join(__dirname, 'fetch-episodes.js'), 'utf-8');
  const match = fetchContent.match(/const TOPICS = \[[\s\S]*?\];/);
  if (match) {
    let topicsStr = match[0].replace('const TOPICS = ', '').replace(';', '');
    topicsStr = topicsStr.replace(/'/g, '"');
    return JSON.parse(topicsStr);
  }
  return ['finance', 'personal improvement'];
}

async function fetchEpisodesForTopic(topic) {
  // Import fetch logic
  const { searchApplePodcasts, fetchFeedEpisodes } = require('./fetch-episodes');
  
  console.log(`📡 Fetching episodes for: "${topic}"`);
  
  try {
    const results = await searchApplePodcasts(topic, 50);
    const newEpisodes = [];
    
    // Load existing episodes to check for duplicates
    let existingIds = new Set();
    if (fs.existsSync(EPISODES_FILE)) {
      const existing = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
      existingIds = new Set(existing.map(e => e.externalId));
    }
    
    for (const podcast of results.slice(0, 5)) {
      try {
        const episodes = await fetchFeedEpisodes(podcast.feedUrl, 3);
        
        for (const ep of episodes) {
          const key = `${podcast.collectionId}-${ep.guid}`;
          
          // Skip if already exists
          if (existingIds.has(key)) continue;
          
          newEpisodes.push({
            externalId: key,
            showExternalId: podcast.collectionId.toString(),
            showName: podcast.collectionName,
            showAuthor: podcast.artistName,
            showImageUrl: podcast.artworkUrl600 || podcast.artworkUrl100,
            title: ep.title,
            description: ep.description?.substring(0, 2000) || '',
            audioUrl: ep.enclosure?.url,
            imageUrl: ep.image || podcast.artworkUrl600,
            publishDate: new Date(ep.pubDate),
            duration: parseInt(ep.itunes?.duration) || null,
            topic: topic,
            status: 'queued'
          });
        }
      } catch (e) {
        console.log(`   ⚠️ Error fetching feed: ${e.message}`);
      }
    }
    
    console.log(`   Found ${newEpisodes.length} new episodes`);
    return newEpisodes;
  } catch (e) {
    console.error(`   ❌ Error: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('\n🎯 MASTER TRIGGER - Fetching new episodes\n');
  console.log(`⏰ Triggered at: ${new Date().toISOString()}\n`);
  
  const topics = loadTopics();
  console.log(`📋 Topics: ${topics.join(', ')}\n`);
  
  // Load existing episodes
  let allEpisodes = [];
  if (fs.existsSync(EPISODES_FILE)) {
    allEpisodes = JSON.parse(fs.readFileSync(EPISODES_FILE, 'utf-8'));
  }
  
  // Fetch for each topic
  for (const topic of topics) {
    const newEps = await fetchEpisodesForTopic(topic);
    allEpisodes.push(...newEps);
  }
  
  // Save updated episodes
  fs.writeFileSync(EPISODES_FILE, JSON.stringify(allEpisodes, null, 2));
  
  // Add to processing queue
  const queue = [];
  if (fs.existsSync(path.join(DATA_DIR, 'processing-queue.json'))) {
    const existing = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'processing-queue.json'), 'utf-8'));
    queue.push(...existing);
  }
  
  // Add new episodes to queue
  const existingIds = new Set(queue.map(e => e.externalId));
  for (const ep of allEpisodes) {
    if (ep.status === 'queued' && !existingIds.has(ep.externalId)) {
      queue.push({
        externalId: ep.externalId,
        topic: ep.topic,
        status: 'pending',
        addedAt: new Date().toISOString()
      });
    }
  }
  
  fs.writeFileSync(path.join(DATA_DIR, 'processing-queue.json'), JSON.stringify(queue, null, 2));
  
  console.log(`\n✅ Summary:`);
  console.log(`   Total episodes: ${allEpisodes.length}`);
  console.log(`   Queue size: ${queue.length}`);
  console.log(`\n💡 Next: Run process-queue.js to process episodes one by one\n`);
}

main().catch(console.error);
