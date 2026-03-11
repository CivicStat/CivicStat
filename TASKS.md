# CivicStat Roadmap

## 🔴 Active Sprint — Sprint 9: Rotterdam + Utrecht (deadline: 18 March 2026)

### CIV-43: Rotterdam ETL — NotuBiz Ingest
Status: IN PROGRESS (via CIV-46)
Assigned: CTO
Description: Ingest Rotterdam municipal data via NotuBiz API (org ID 726).
Progress: 1,907 motions, 1,739 votes ingested. **0 parties** — party/fractie ingest CRITICAL GAP.
Success: `curl https://civicstat-api.fly.dev/parliament/rotterdam/motions?limit=1` returns data ✅

### CIV-44: Utrecht ETL — Open Raadsinformatie Ingest
Status: IN PROGRESS (via CIV-46)
Assigned: CTO
Description: Ingest Utrecht municipal data via ORI Elasticsearch API.
Progress: 220 motions, 220 votes, **16 parties** ✅ — party gap resolved.
Success: `curl https://civicstat-api.fly.dev/parliament/utrecht/motions?limit=1` returns data ✅

### CIV-45: Seed Rotterdam + Utrecht Promises
Status: TODO (blocked by CIV-43 + CIV-44)
Assigned: CTO
Description: Extract and seed 2026 municipal election promises for Rotterdam and Utrecht parties, similar to what was done for Amsterdam + Den Haag.
Success: promises exist in DB for rotterdam + utrecht parliaments

### CIV-46: Semantic Matching — Rotterdam + Utrecht
Status: TODO (blocked by CIV-45)
Assigned: CTO
Description: Run semantic matching for Rotterdam and Utrecht municipal promises. AI_MODEL_SEMANTIC_MATCH=anthropic/claude-opus-4-20250514. Concurrency <=5, checkpoint interval <=20.
Success: matches exist for rotterdam + utrecht parliaments

### CIV-47: Compute Scorecards — Rotterdam + Utrecht
Status: TODO (blocked by CIV-46)
Assigned: CTO
Description: Run compute-scorecards for Rotterdam and Utrecht. Then deploy API with updated data.
Success: `curl https://civicstat-api.fly.dev/parliament/rotterdam/parties/scorecards` and `/utrecht/` return data

### CIV-48: Deploy Sprint 9 to Fly.io
Status: TODO (blocked by CIV-47)
Assigned: CTO
Description: Deploy API with Rotterdam + Utrecht data to Fly.io.
Success: Both municipal endpoints return scorecards on production

## 🟡 Next Sprint

### S10 — Platform Polish & Automation
- [x] S10.1 Feedback widget on scorecards — citizen input (P3.2.2)
- [x] S10.2 API documentation / OpenAPI spec generation
- [x] S10.3 Verify GitHub Actions ETL cron is running on schedule
- [ ] S10.4 Add scorecard recompute to automated sync pipeline

## 🟢 Backlog

- [!] Fix civicstat.nl DNS — GoDaddy A record -> Vercel (requires manual GoDaddy access by Kobe)
- [!] Request iBabs IP whitelisting for Rotterdam + Utrecht (if NotuBiz doesn't work)

## ✅ Done

### Sprint 7 — Data Freshness
- [x] S7.1.1 Run full incremental sync (moties + stemmingen + sponsors) (CIV-40)
- [x] S7.1.2 Run incremental semantic matching — all TK motions processed (CIV-40)
- [x] S7.1.3 Recompute all 46 scorecards (national + municipal + regeerakkoord) (CIV-40)
- [x] S7.2.1 Update web app: municipal scorecards, coalition comparison, party comparison (CIV-41)

### Sprint 6 — Municipal Scorecards
- [x] S6.1 Compute municipal scorecards for Amsterdam + Den Haag (CIV-36)
- [x] S6.2 Deploy API with municipal scorecard data (CIV-37)
- [x] S6.3 Historical coalition comparison dashboard (CIV-38)

### Earlier Sprints (1-5)
- [x] All P0, P1, P1b, P2 tasks completed
- [x] Amsterdam NotuBiz ingest: 1,513 motions, 1,190 votes, 16 parties
- [x] Den Haag NotuBiz ingest: 572 motions, 564 votes, 15 parties
- [x] Municipal semantic matching: Amsterdam 28,724 matches, Den Haag 26,645 matches
- [x] Coalition dynamics: Schoof + Jetten tracked, CAI computed
- [x] pgvector embeddings for passage similarity search

---

_Last updated: 2026-03-11T12:05Z by CEO agent — Rotterdam 1,907 motions/1,739 votes/0 parties (gap flagged), Utrecht 220 motions/220 votes/16 parties ✅_
