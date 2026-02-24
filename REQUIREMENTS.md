# Requirements Document

## 1. User Management

### 1.1 Authentication
- **REQ-001:** User registration with email/password
- **REQ-002:** User login with secure session management
- **REQ-003:** Password reset flow
- **REQ-004:** OAuth integration (Google, Apple) - MVP2

### 1.2 User Profile
- **REQ-005:** Save topic preferences per user
- **REQ-006:** Topic preference CRUD operations
- **REQ-007:** Export user data (GDPR compliance)
- **REQ-008:** Account deletion with data removal

---

## 2. Topic Management

### 2.1 Topic Input
- **REQ-010:** Plain text topic input (e.g., "bad bunny", "cryptocurrency", "NBA")
- **REQ-011:** Topic suggestions/autocomplete
- **REQ-012:** Topic popularity/trending display
- **REQ-013:** Synonym handling (e.g., "crypto" → "cryptocurrency")

### 2.2 Topic Processing
- **REQ-015:** Semantic topic extraction from plain text
- **REQ-016:** Topic clustering (related topics)
- **REQ-017:** Disambiguation (e.g., "apple" the fruit vs Apple the company)
- **REQ-018:** Multi-language support - MVP2

---

## 3. Podcast Catalog

### 3.1 Data Sources
- **REQ-020:** Apple Podcasts API integration
- **REQ-021:** Spotify Podcasts API - MVP2
- **REQ-022:** RSS feed ingestion for missing podcasts
- **REQ-023:** Daily catalog refresh (new episodes)

### 3.2 Episode Metadata
- **REQ-025:** Episode title, description, publish date
- **REQ-026:** Show/creator information
- **REQ-027:** Episode duration, explicit content flag
- **REQ-028:** Episode URL (audio + webpage)

### 3.3 Initial Topic Coverage
| Topic | Min Episodes | Data Source |
|-------|-------------|------------|
| Politics | 1000/day | Apple Podcasts |
| Finance | 500/day | Apple Podcasts |
| Health | 400/day | Apple Podcasts |
| Music | 300/day | Apple Podcasts |
| True Crime | 400/day | Apple Podcasts |
| Technology | 400/day | Apple Podcasts |
| Sports | 500/day | Apple Podcasts |
| Comedy | 300/day | Apple Podcasts |
| Science | 300/day | Apple Podcasts |
| Business | 400/day | Apple Podcasts |

---

## 4. Content Analysis

### 4.1 Episode Processing Pipeline
```
Episode Published → Fetch Metadata → Fetch Audio → Transcribe → Summarize → Embed → Index
```

### 4.2 Transcription
- **REQ-040:** Automatic speech recognition (ASR)
- **REQ-041:** Timestamp alignment
- **REQ-042:** Speaker diarization (MVP2)
- **REQ-043:** Language detection

### 4.3 Summarization
- **REQ-045:** Generate 3-sentence summary per episode
- **REQ-046:** Extract key topics/entities
- **REQ-047:** Sentiment analysis (MVP2)
- **REQ-048:** Store summaries for fast retrieval

### 4.4 Embedding Generation
- **REQ-050:** Semantic embedding for episode content
- **REQ-051:** Topic relevance scoring
- **REQ-052:** Vector storage in database

---

## 5. Playlist Generation

### 5.1 Recommendation Engine
- **REQ-060:** Topic-to-episode relevance scoring
- **REQ-061:** Personalization based on user history
- **REQ-062:** Diversity control (avoid same show repetition)
- **REQ-063:** Freshness decay (newer episodes weighted higher)

### 5.2 Playlist Features
- **REQ-065:** Daily refresh schedule
- **REQ-066:** Sort by relevance score × date recency
- **REQ-067:** Pagination (infinite scroll)
- **REQ-068:** Save/bookmark episodes
- **REQ-069:** Listen progress tracking

### 5.3 Search & Discovery
- **REQ-070:** Semantic search across catalog
- **REQ-071:** "Related episodes" recommendations
- **REQ-072:** Trending topics display
- **REQ-073:** Topic exploration browser

---

## 6. Semantic Search Requirements

### 6.1 Core Capabilities
- **REQ-080:** Vector similarity search
- **REQ-081:** Hybrid search (keywords + semantic)
- **REQ-082:** Cross-language search (MVP2)
- **REQ-083:** Real-time index updates

### 6.2 Example Queries
| Query | Expected Results |
|-------|-----------------|
| "bad bunny" | Songs, interviews, NFL halftime mentions, political views |
| "crypto crash" | Bitcoin, Ethereum, DeFi, regulatory news |
| "NBA playoffs" | Game recaps, player interviews, trade rumors |

### 6.3 Performance Targets
- Search latency: < 200ms
- Index update latency: < 5 minutes
- Search relevance (NDCG@10): > 0.7

---

## 7. Technical Non-Functional Requirements

### 7.1 Scalability
- **REQ-090:** Support 10,000 daily active users
- **REQ-091:** Process 10,000 new episodes/day
- **REQ-092:** 99.9% uptime SLA

### 7.2 Performance
- **REQ-095:** Page load < 2 seconds
- **REQ-096:** API response < 500ms
- **REQ-097:** Search results < 200ms

### 7.3 Security
- **REQ-100:** HTTPS everywhere
- **REQ-101:** Encrypted user data
- **REQ-102:** Rate limiting on APIs
- **REQ-103:** GDPR, CCPA compliance

---

## 8. Future Requirements (Post-MVP)

- **FR-001:** iOS native app
- **FR-002:** Android app
- **FR-003:** Chromecast/Smart speaker integration
- **FR-004:** Podcast recommendations from friends
- **FR-005:** Podcast hosting platform integration
- **FR-006:** AI episode clips generation
- **FR-007:** Community playlists
- **FR-008:** Podcast ad marketplace
