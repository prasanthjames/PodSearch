#!/usr/bin/env node
/**
 * Episode Fetcher
 * Fetches latest episodes from Apple Podcasts for given topics
 *
 * Usage: node scripts/fetch-episodes.js
 */

const fs = require('fs');
const path = require('path');
const { EPISODES_FILE, DATA_DIR } = require('./paths');

// Ensure data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

const TOPICS = [
  'finance',
  'personal improvement',
  'Kerala',
  'US News'
];

const EPISODES_PER_TOPIC = 10;

async function searchApplePodcasts(term, limit = 20) {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=podcast&limit=${limit}`;

  const response = await fetch(url);
  const data = await response.json();

  return data.results || [];
}

async function fetchEpisodes() {
  console.log('🎙️ Starting episode fetch...\n');

  const allEpisodes = new Map(); // deduplicate by externalId

  for (const topic of TOPICS) {
    console.log(`📡 Searching Apple Podcasts for: "${topic}"`);

    try {
      const results = await searchApplePodcasts(topic, 50);
      console.log(`   Found ${results.length} podcasts`);

      // For each podcast, get the latest episode
      for (const podcast of results.slice(0, 5)) { // top 5 podcasts per topic
        const feedUrl = podcast.feedUrl;

        try {
          const episodes = await fetchFeedEpisodes(feedUrl, 3); // latest 3 from each

          for (const ep of episodes) {
            const key = `${podcast.collectionId}-${ep.guid}`;
            if (!allEpisodes.has(key)) {
              allEpisodes.set(key, {
                externalId: `${podcast.collectionId}-${ep.guid}`,
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
                topic: topic
              });
            }
          }
        } catch (err) {
          console.log(`   ⚠️ Could not fetch feed: ${feedUrl.substring(0, 50)}...`);
        }
      }

      console.log(`   ✅ Collected ${allEpisodes.size} unique episodes so far\n`);

    } catch (err) {
      console.error(`   ❌ Error searching "${topic}":`, err.message);
    }
  }

  // Save to JSON for now (database integration later)
  const episodes = Array.from(allEpisodes.values());
  
  console.log(`\n📊 Total unique episodes: ${episodes.length}`);
  
  // Save to file
  fs.writeFileSync(EPISODES_FILE, JSON.stringify(episodes, null, 2));
  
  console.log(`💾 Saved to ${EPISODES_FILE}`);

  return episodes;
}

async function fetchFeedEpisodes(feedUrl, limit = 3) {
  // Simple RSS parser - just get latest episodes
  const response = await fetch(feedUrl);
  const xml = await response.text();

  // Simple XML parsing for RSS
  const episodes = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

  let count = 0;
  for (const match of itemMatches) {
    if (count >= limit) break;

    const item = match[1];

    const getTag = (tag) => {
      const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
      const m = item.match(regex);
      return m ? m[1].trim() : null;
    };

    const getAttr = (tag, attr) => {
      const regex = new RegExp(`<${tag}[^>]*${attr}=["']([^"']*)["'][^>]*>`);
      const m = item.match(regex);
      return m ? m[1] : null;
    };

    const title = getTag('title');
    const enclosure = getAttr('enclosure', 'url');

    if (title && enclosure) {
      episodes.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
        description: getTag('description')?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, ''),
        guid: getTag('guid') || title,
        pubDate: getTag('pubDate'),
        enclosure: { url: enclosure },
        itunes: { duration: getTag('itunes:duration') },
        image: getTag('itunes:image')?.match(/href="([^"]+)"/)?.[1]
      });
      count++;
    }
  }

  return episodes;
}

// Run if called directly
if (require.main === module) {
  fetchEpisodes()
    .then(() => console.log('\n✅ Done!'))
    .catch(err => console.error(err));
}

module.exports = { fetchEpisodes, searchApplePodcasts };
