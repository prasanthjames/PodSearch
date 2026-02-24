# Roadmap

## Phase 1: Foundation (Weeks 1-2)

### Goals
- Set up project infrastructure
- Build core authentication
- Create basic UI framework

### Tasks

#### Week 1

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 1 | Initialize Next.js project | Dev | Repo created, CI/CD set up |
| 2 | Set up PostgreSQL + Prisma | Dev | Database schema, migrations |
| 3 | Implement Auth (email/password) | Dev | Register, login, logout |
| 4 | Build basic UI components | Dev | Header, footer, cards, forms |
| 5 | Set up API skeleton | Dev | Express/FastAPI server running |
| Weekend | Code review + tests | Team | PRs merged, 80% coverage |

#### Week 1 Progress (Feb 21)
- ✅ Created project structure
- ✅ Created Prisma schema (for later Supabase)
- ✅ Built episode fetcher (Apple Podcasts API)
- ✅ Collected 42 episodes across 3 topics (Finance, Personal Improvement, Mexico City)
- ⏳ Transcription: whisper.cpp installed (Mac issues - use OpenAI)
- ⏳ Embeddings: Need OpenAI API key

#### Week 2

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 6 | User profile CRUD | Dev | API endpoints, UI |
| 7 | Topic management UI | Dev | Add/remove topics |
| 8 | API gateway setup | Dev | Kong/NGINX routing |
| 9 | Redis caching layer | Dev | Session + API cache |
| 10 | Integration testing | Dev | E2E tests passing |
| Weekend | Deploy to staging | Dev | Staging environment live |

### Phase 1 Exit Criteria
- [ ] User registration works
- [ ] User can log in
- [ ] User can add/remove topics
- [ ] Basic UI is responsive
- [ ] CI/CD pipeline works
- [ ] Tests pass (80%+ coverage)

---

## Phase 2: Core Features (Weeks 3-4)

### Goals
- Build podcast catalog ingestion
- Create playlist generation
- Implement search

### Tasks

#### Week 3

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 11 | Apple Podcasts API integration | Dev | Episode data fetching |
| 12 | Deduplication pipeline | Dev | No duplicate episodes |
| 13 | Topic filtering logic | Dev | Filter by top 10 topics |
| 14 | Transcript storage | Dev | S3 + metadata in DB |
| 15 | Episode metadata schema | Dev | DB schema update |
| Weekend | Load test catalog | Dev | Handle 10K episodes |

#### Week 4

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 16 | Basic playlist endpoint | Dev | Returns episodes |
| 17 | Relevance scoring | Dev | Topic matching score |
| 18 | Date sorting | Dev | Recency weighting |
| 19 | Search API | Dev | Keyword search |
| 20 | Search UI | Dev | Search bar, results |
| Weekend | Beta testing | Team | Internal beta |

### Phase 2 Exit Criteria
- [ ] 10,000 episodes indexed
- [ ] Daily refresh works
- [ ] Playlist shows relevant episodes
- [ ] Search returns results
- [ ] Page load < 2 seconds

---

## Phase 3: AI Integration (Weeks 5-6)

### Goals
- Add transcription
- Generate summaries
- Implement semantic search

### Tasks

#### Week 5

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 21 | whisper.cpp integration | Dev | **Offline transcription pipeline** |
| 22 | Batch processing script | Dev | Process 1000 episodes (CPU) |
| 23 | Transcript storage | Dev | S3 + DB reference |
| 24 | Beta testing | Dev | 1000 transcripts generated |
| 25 | Search quality check | Team | Verify relevance with beta users |
| Weekend | Iterate on topics | Team | Refine topic matching |

#### Week 6 - MVP Launch Prep

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 26 | **Migrate to Faster Whisper** | Dev | GPU-accelerated pipeline |
| 27 | Re-transcribe catalog | Dev | Higher quality transcripts |
| 28 | Embedding generation | Dev | Vector creation |
| 29 | Vector DB integration | Dev | Pinecone connected |
| 30 | Semantic search | Dev | Hybrid search working |
| Weekend | **🚀 MVP Launch** | Team | **Public launch!** |

### Phase 3 Exit Criteria
- [ ] **Beta:** 1,000 episodes transcribed with whisper.cpp
- [ ] **MVP:** 5,000 episodes transcribed with Faster Whisper (GPU)
- [ ] Semantic search returns relevant results
- [ ] Vector DB queried < 100ms
- [ ] Transcription cost < $100/month (GPU instance)

---

## Phase 4: Polish & Launch (Weeks 7-8)

### Goals
- Performance optimization
- UI/UX improvements
- Public launch

### Tasks

#### Week 7

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 31 | Performance tuning | Dev | Page load < 1s |
| 32 | Mobile optimization | Dev | Responsive design |
| 33 | Accessibility audit | Dev | WCAG compliance |
| 34 | Load testing | Dev | 1000 concurrent users |
| 35 | Bug fixes | Dev | Critical issues resolved |
| Weekend | Security audit | Dev | Penetration test |

#### Week 8

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| 36 | Launch prep | Team | Marketing page |
| 37 | Documentation | Team | User guide, API docs |
| 38 | Monitoring setup | Dev | Alerting, dashboards |
| 39 | Soft launch | Team | Invite-only beta |
| 40 | Bug bash | Team | Fix issues |
| Weekend | Public launch | Team | 🚀 Launch day! |

### Phase 4 Exit Criteria
- [ ] Public launch
- [ ] 1,000 registered users in week 1
- [ ] DAU > 100
- [ ] No critical bugs
- [ ] Uptime > 99.9%

---

## MVP2: Mobile App (Weeks 9-12)

### Goals
- Cross-platform mobile experience (iOS + Android)
- Push notifications
- Offline support

### Technology: React Native

### Tasks

| Week | Focus | Deliverables |
|------|-------|--------------|
| 9 | Core app setup | React Native project, auth flow, API client |
| 10 | Playlist UI | Episode list, player controls, offline queue |
| 11 | Notifications | Push notification setup, new episode alerts |
| 12 | App Stores | Submit to TestFlight / Google Play |

---

## Timeline Overview

```
Phase 1: ████████░░░░░░░░░░░░░░  Foundation (2 weeks)
Phase 2: ░░░░░░░░░████████████████  Core Features (2 weeks)
Phase 3: ░░░░░░░░░░░░░░░░░░████████  AI Integration (2 weeks)
Phase 4: ░░░░░░░░░░░░░░░░░░░░░░████  Polish & Launch (2 weeks)
────────────────────────────────────────────
Total:  8 weeks to MVP launch 🚀
```

---

## Milestones

| Milestone | Date | Description |
|-----------|------|-------------|
| M1 | Week 2 | Staging environment live |
| M2 | Week 4 | 10K episodes indexed |
| M3 | Week 6 | Alpha launch (internal) |
| M4 | Week 8 | 🚀 MVP public launch |
| M5 | Week 12 | Mobile App Store submissions |

---

## Resource Allocation

### Team (Core)

| Role | FTE | Responsibilities |
|------|-----|------------------|
| Full-stack Developer | 1.0 | Frontend + Backend services |
| ML/AI Engineer | 0.5 | Transcription, embeddings, search |
| Designer | 0.25 | UI/UX, responsive design |
| DevOps | 0.25 | Infrastructure, CI/CD |

### Optional Additions (Scale)

| Role | When | Why |
|------|------|-----|
| iOS Developer | Week 9 | Native app development |
| Backend Engineer | Week 8 | Scale services |
| Data Engineer | Week 10 | Pipeline optimization |

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Apple API rate limits | High | Medium | Cache aggressively, use RSS feeds |
| Transcription costs | High | High | Self-host Whisper, batch processing |
| Search relevance | High | Medium | A/B testing, user feedback loop |
| User acquisition | Medium | High | Content marketing, podcast outreach |
| Infrastructure cost | Medium | Medium | Right-sizing, auto-scaling |

---

## Success Metrics

### Launch Metrics (Week 8)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Users registered | 1,000 | Database count |
| Daily Active Users | 100 | Analytics |
| Playlist completion | 30% | Episode played > 50% |
| Search CTR | 15% | Click-through rate |
| NPS Score | > 30 | User survey |

### Growth Metrics (Month 3)

| Metric | Target | Measurement |
|--------|--------|-------------|
| MAU | 5,000 | Monthly active users |
| DAU/MAU | 20% | Stickiness ratio |
| Episodes played | 50,000/month | Player analytics |
| Search queries | 100,000/month | API logs |

---

## Post-MVP Roadmap

### Month 3

- [ ] Spotify podcast integration
- [ ] Android app (React Native)
- [ ] Social features (share playlists)
- [ ] Podcast creator dashboard
- [ ] Advertising platform

### Month 6

- [ ] AI clip generation
- [ ] Community playlists
- [ ] Multi-language support
- [ ] Enterprise API
- [ ] Series B funding (if pursuing)

---

## Check-in Schedule

### Daily Standup (5 min)
- What I did yesterday
- What I'll do today
- Blockers

### Weekly Planning (Monday, 30 min)
- Review last week
- Plan this week
- Assign tasks

### **Daily Check-in: 6:00 PM** ⭐
- Progress update
- Blockers discussion
- Design decisions
- Iteration planning

### Bi-weekly Retrospective (Friday, 1 hour)
- What went well
- What could improve
- Action items

---

## Dependencies

| Dependency | Status | Owner | Notes |
|------------|--------|-------|-------|
| Apple Podcasts API | ✅ Ready | - | Free, rate limited |
| OpenAI API | ✅ Ready | - | Pay-per-use |
| PostgreSQL | ✅ Ready | - | Supabase |
| Vector DB | ✅ Ready | - | Pinecone |
| CDN | ✅ Ready | - | Vercel |

---

## Next Steps

1. ⭐ **Today:** Review this roadmap
2. ⭐ **Tomorrow 6 PM:** First check-in
3. ⭐ **Week 1:** Start Phase 1

**Let's build this! 🚀**
