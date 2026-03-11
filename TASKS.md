# CivicStat Roadmap

## 🔴 Active Sprint — Sprint 9: Rotterdam + Utrecht (deadline: 18 March 2026)

### CIV-45: Seed Rotterdam + Utrecht Promises
Status: TODO — NEXT UP
Assigned: CTO
Description: Extract and seed 2026 municipal election promises for Rotterdam and Utrecht parties, similar to what was done for Amsterdam + Den Haag. Both cities now have parties (Rotterdam 18, Utrecht 16) and motions ingested.
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
- [x] S10.4 Add scorecard recompute to automated sync pipeline

## 🟠 Agent Hiring (pending board approval)

### CIV-52: Hire Vera (Data Quality Agent)
Status: IN REVIEW — approval `a2499847` pending
Assigned: CEO (Dan)
Agent ID (pending): `2cd088a8-995a-4d41-a469-a7ea154a5b16`

### CIV-48: Hire Lisa (Chief of Staff)
Status: IN REVIEW — approval `e3b4e303` pending
Assigned: CEO (Dan)
Agent ID (pending): `992b9a7f-66cd-4768-8db3-a86004f65294`

### CIV-50: Hire Femke (UI/UX Analyst)
Status: IN REVIEW — approval `bc113c51` pending
Assigned: CEO (Dan)
Agent ID (pending): `104736bb-af5b-453c-b11c-d873da0e8f82`

### CIV-51: Hire Maurice (Political Intelligence Analyst)
Status: IN REVIEW — approval `c16657e1` pending
Assigned: CEO (Dan)
Agent ID (pending): `7dc86a5a-cae5-44b8-9f86-ffa01b61b3a5`

## 🟢 Backlog

- [!] Fix civicstat.nl DNS — GoDaddy A record -> Vercel (requires manual GoDaddy access by Kobe)
- [!] Git push 19 commits to origin/main (fixes GitHub Actions ETL cron)

## ✅ Done

### Sprint 9 — Rotterdam + Utrecht ETL
- [x] CIV-43: Rotterdam ETL — 1,991 motions, 1,801 votes, 18 parties (via ORI/iBabs)
- [x] CIV-44: Utrecht ETL — 220 motions, 220 votes, 16 parties (via ORI)

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

_Last updated: 2026-03-11T12:59Z by CEO agent — CIV-43+44 DONE. Rotterdam: 1,991 motions/1,801 votes/18 parties. Utrecht: 220 motions/220 votes/16 parties. Next: promise seeding (CIV-45)._
