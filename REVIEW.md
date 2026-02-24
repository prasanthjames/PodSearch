# Engineering & PM Review

## Engineer Hat Critique

### 1. Architecture Concerns

**Issue: Microservices Complexity**
The architecture shows 10+ microservices. For an MVP, this is overkill.
- **Risk:** Operational complexity, debugging difficulty, deployment overhead
- **Alternative:** Start with modular monolith, split when needed
- **Recommendation:** Combine Auth + User + Playlist into single service initially

**Issue: Python for Multiple Services**
Using Python for catalog, transcriber, summarizer, AND embedding is fine, but consider:
- **Cold start latency** for Lambda/Fargate
- **Cost:** Python doesn't scale as efficiently as Go/Rust
- **Alternative:** Consolidate Python services into one "AI Pipeline" service

**Issue: Missing Rate Limiting Strategy**
Apple Podcasts API has strict rate limits (~20 req/min).
- **Current plan doesn't address this**
- **Risk:** IP bans, data gaps
- **Fix:** Add API gateway rate limiting, implement exponential backoff

**Issue: No Circuit Breaker Pattern**
If any external API (OpenAI, Whisper, Apple) fails:
- **Risk:** Cascading failures
- **Fix:** Implement circuit breakers (Hystrix/Resilience4j)

---

### 2. Technology Choices

**✅ Good Choices:**
- Next.js for frontend (correct)
- PostgreSQL + Prisma (correct)
- Pinecone for vectors (correct for MVP)

**⚠️ Questionable:**

| Tool | Concern | Alternative |
|------|---------|-------------|
| RabbitMQ | Overkill for MVP | In-memory queue + Redis |
| Kong API Gateway | Operational overhead | AWS API Gateway / Next.js API routes |
| Go for multiple services | Language fragmentation | Node.js everywhere initially |
| Whisper API | Cost at scale | Self-hosted Whisper on GPU |

**💡 Specific Recommendations:**

1. **Skip Kong, use AWS API Gateway or Next.js API routes**
   - Saves $100-200/month
   - Less ops overhead

2. **Use Redis Streams instead of RabbitMQ**
   - Already have Redis for caching
   - Simpler to operate

3. **Consolidate to Node.js for MVP services**
   - Share code with frontend (TypeScript)
   - Reduce language context switching
   - Switch to Go later if performance needed

---

### 3. Missing Components

**Critical Missing:**

1. **Content Moderation**
   - Podcasts contain explicit content
   - Need to filter based on user preferences
   - Current: "explicit content flag" only (insufficient)

2. **Duplicate Detection**
   - Same episode on multiple platforms
   - Need audio fingerprinting (pHash)
   - Apple vs Spotify overlap

3. **Cost Tracking Dashboard**
   - OpenAI API will be biggest cost driver
   - Need real-time visibility
   - Budget alerts

4. **Webhook Handler**
   - Apple Podcasts doesn't have webhooks
   - RSS feeds don't have webhooks
   - Need polling + webhook handlers for user actions

5. **CDN Strategy**
   - Audio file delivery needs CDN
   - CloudFront: $0.02/GB
   - Alternative: Use podcast host's CDN

6. **Backup & Recovery**
   - Vector DB backup (Pinecone handles)
   - PostgreSQL backup (Supabase handles)
   - What about embeddings cache?

---

### 4. Cost Projections - REALITY CHECK

**Current Estimate: $650/month**

**What they forgot:**

| Item | Missing Cost | Monthly |
|------|--------------|---------|
| DeepGram (transcription) | ❌ Not included | $500-2000 |
| Monitoring (Datadog) | ❌ Not included | $100 |
| Email service (SendGrid) | ❌ Not included | $20 |
| Domain + SSL | ❌ Not included | $10 |
| CDN (CloudFront) | ❌ Not included | $50-200 |

**Realistic MVP Cost: $1,500-3,000/month**

**At 10K episodes/day processing:**
- Transcription: $600/day = $18,000/month
- This is UNSUSTAINABLE

**Critical Fix Needed:**
```python
# OPTION 1: Self-host Whisper
GPU instance (g4dn.xlarge): $500/month
Throughput: 100x faster than API
Break-even: 1.4M minutes/month

# OPTION 2: Lazy transcription
Transcribe only when:
- User saves topic that matches episode
- Episode gets >50 relevance score
- First 1000 users' recommendations only

# OPTION 3: Hybrid
Transcribe top 100 episodes/day fully
Rest get keyword extraction only
```

**Recommendation:** Start with OPTION 2 (lazy transcription)

---

### 5. Performance Bottlenecks

| Bottleneck | Impact | Solution |
|------------|--------|----------|
| Transcription queue | Blocks indexing | Async processing, user gets notification |
| Embedding generation | Slows search | Pre-compute, cache aggressively |
| API response time | Poor UX | Redis cache (1-hour TTL) |
| Vector search | Expensive | Use metadata filtering first |
| Audio streaming | Bandwidth | Use podcast host's CDN |

**Specific Concern:**
```
Embedding generation: 384 dims × 10K episodes = slow
Solution: Batch process at 2 AM, not real-time
```

---

### 6. Security Concerns

**Current: Minimal security mentioned**

1. **No Rate Limiting Details**
   - Redis-based rate limiting needed
   - 100 req/min/user is aggressive

2. **API Key Exposure**
   - OpenAI keys in backend
   - Use secrets manager (AWS Secrets Manager / HashiCorp Vault)

3. **No Input Validation**
   - Topic text injection attacks
   - Need Zod schemas for all inputs

4. **Missing CORS Configuration**
   - Critical for frontend-backend communication

5. **No Audit Logging**
   - Who searched what?
   - Compliance requirement

---

## PM Hat Critique

### 1. Timeline Realism - 8 Weeks

**Honest Assessment: UNLIKELY**

| Phase | Planned | Realistic |
|-------|---------|-----------|
| Phase 1 | 2 weeks | 2 weeks (if focused) |
| Phase 2 | 2 weeks | 3 weeks (Apple API complexity) |
| Phase 3 | 2 weeks | 4 weeks (AI pipeline is hard) |
| Phase 4 | 2 weeks | 2 weeks (always slips) |
| **Total** | **8 weeks** | **11-12 weeks** |

**Critical Path:**
- Week 3-4: Apple API + deduplication (always takes longer)
- Week 5-6: Transcription pipeline (biggest unknown)
- Week 7-8: Search relevance tuning (iterative)

**Recommendation:** Plan for 12 weeks, ship at 10 weeks

---

### 2. Scope Creep Risks

**MVP Scope is TOO BIG for 8 weeks:**

| Feature | MVP Essential? | Move to MVP2? |
|---------|---------------|---------------|
| User registration | ✅ Yes | - |
| OAuth (Google/Apple) | ❌ No | ✅ MVP2 |
| 10 topics | ✅ Yes | Start with 3 |
| Transcription | ❌ No | ✅ MVP2 |
| Summaries | ❌ No | ✅ MVP2 |
| Semantic search | ❌ No | ✅ MVP2 |
| Playlist refresh | ✅ Yes | - |
| Player | ✅ Minimal | - |

**MVP Should Be:**
1. User auth (email only)
2. 3 topics (Finance, Tech, True Crime)
3. Keyword search only
4. No transcription - use episode descriptions
5. Basic playlist

**Savings: 3-4 weeks**

---

### 3. Missing User Stories

**Not in requirements:**

| User Story | Priority | Reason |
|------------|----------|--------|
| "As a user, I want to skip episodes I've already listened to" | P0 | Basic UX |
| "As a user, I want to see how long an episode is before playing" | P0 | Decision making |
| "As a user, I want to share a playlist with a friend" | P2 | MVP2 |
| "As a user, I want to exclude specific podcasts" | P1 | Filter noise |
| "As a user, I want to adjust relevance vs recency" | P1 | Personalization |
| "As a user, I want to listen in background" | P0 | Mobile UX |
| "As a user, I want to download for offline" | P1 | MVP2 |

**Top 3 Additions for MVP:**
1. Skip listened episodes
2. Episode duration display
3. Background play (audio continues when app closed)

---

### 4. Competitive Analysis Missing

**What's different from existing solutions?**

| Competitor | Weakness | Our Advantage |
|------------|----------|--------------|
| Apple Podcasts | No personalization | Topic-based |
| Spotify | Algorithm-first | Human-like understanding |
| Listen Notes | Paywalled | Free tier |
| Overcast | Show-based | Episode-level |

**Missing from plan:**
- Differentiation strategy
- Why will users switch?
- What's the 10x better experience?

---

### 5. Go-to-Market Strategy

**Missing from roadmap:**

1. **User Acquisition**
   - How do we get first 1000 users?
   - Podcast community outreach?
   - Product Hunt launch?
   - Twitter/X announcement?

2. **Content Strategy**
   - Blog posts about topics discovered
   - "Best episodes about [topic]" lists
   - SEO for long-tail queries

3. **Partnerships**
   - Podcast apps (integrations)
   - Podcasters (promote to listeners)
   - Topic experts (curated lists)

---

## Summary: Top 10 Action Items

### Engineer (Technical)

1. ⭐ **Consolidate to modular monolith** (not microservices)
2. ⭐ **Start with keyword search only** (semantic search MVP2)
3. ⭐ **Implement lazy transcription** (transcribe on-demand)
4. ⭐ **Add Redis rate limiting + circuit breakers**
5. ⭐ **Set up self-hosted Whisper** (GPU instance Week 1)

### PM (Product)

1. ⭐ **Reduce MVP to 3 topics** (Finance, Tech, True Crime)
2. ⭐ **Remove OAuth from MVP** (email-only)
3. ⭐ **Add "skip listened" to requirements**
4. ⭐ **Plan for 12 weeks, not 8**
5. ⭐ **Define go-to-market strategy**

---

## Revised MVP Scope (Post-Review)

### MUST HAVE (Week 1-6)
- [ ] User registration + login
- [ ] 3 topic selection
- [ ] Apple Podcasts integration
- [ ] Episode catalog (10K episodes)
- [ ] Keyword search
- [ ] Basic playlist (relevance + date)
- [ ] Episode player (web)

### SHOULD HAVE (Week 7-8)
- [ ] Transcription (lazy)
- [ ] Summaries
- [ ] Email notifications
- [ ] Mobile web optimization

### COULD HAVE (MVP2)
- [ ] Semantic search
- [ ] OAuth
- [ ] iOS app
- [ ] 10 topics
- [ ] Social features

---

## Files Modified

| File | Changes |
|------|---------|
| ARCHITECTURE.md | Added circuit breaker, consolidated services |
| TOOLING.md | Added Redis Streams, removed RabbitMQ |
| ROADMAP.md | Added 12-week timeline, reduced scope |
| REQUIREMENTS.md | Added missing user stories |

---

**Review completed:** February 18, 2026
**Reviewer:** Engineering + PM perspectives
**Status:** Ready for iteration
