# TASKS.md — CivicStat Prioritized Backlog

Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## P0 — Critical (blocks production)

- [x] P0.1 Fix promise detail routing (promiseCode fallback)
- [x] P0.2 Party scorecards deployed (MCS on /parties endpoints)
- [!] P0.3 Fix civicstat.nl DNS — GoDaddy A record → Vercel, add domain in Vercel dashboard (requires manual GoDaddy dashboard access)
- [x] P0.4 apps/web cleanup

## P1 — High (scorecard accuracy)

_Source: PROMPT-P2-scorecard-improvements.md, handover-2026-02-09_

- [x] P1.1 Insert NSC party into parties table (tkId lookup from TK API, seats=20)
- [x] P1.2 Seed NSC TK2023 promises + run semantic matching
- [x] P1.3 Confidence weighting — filter matches below 0.3, weight by confidence in MCS calc
- [x] P1.4 Fix abbreviation lookup (GET /parties/VVD/scorecard returns 500) — verified working
- [x] P1.5 Add TK2025 promise extraction + seeding for all 15 parties

## P1b — High (Sprint 2 — data quality & scoring accuracy)

- [x] P1b.1 Fix vote linkage gap — 15-16% orphaned votes with motionId: null (CIV-10)
- [x] P1b.2 Run wetsvoorstellen ingest — weight 2.0 in MCS (CIV-11)
- [x] P1b.3 Populate MotionSponsor table via ETL (CIV-12)
- [x] P1b.4 Seat counts from API instead of hardcoded (CIV-13)
- [x] P1b.5 Search debouncing on /zoeken (CIV-13)
- [x] P1b.6 Transparency page real-time counts (CIV-13)

## P2 — Medium (feature completeness)

### P2.0 — Deploy
- [x] P2.0.1 Deploy API to Fly.io with Sprint 1 fixes (CIV-9)

### P2.1 — ETL Automation
_Source: PROMPT-etl-cron.md, PROMPT-three-fixes.md_

- [x] P2.1.1 Verify `sync` and `incremental` CLI commands work end-to-end
- [x] P2.1.2 Set up GitHub Actions hourly cron (.github/workflows/etl-sync.yml)
- [x] P2.1.3 Add DATABASE_URL + OPENROUTER_API_KEY secrets to GitHub repo

### P2.2 — Consensus / Verbinding Page
_Source: PROMPT-three-fixes.md, PROMPT-verbinding-fix.md_

- [x] P2.2.1 Build pre-computed consensus API endpoint (GET /votes/consensus)
- [x] P2.2.2 Wire PartyBadge into Verbinding page pair rows
- [x] P2.2.3 Simplify frontend to fetch consensus endpoint instead of client-side calc

### P2.3 — Transparency UI
_Source: PROMPT-quick-fixes-transparency.md_

- [x] P2.3.1 Wire footer links (Over, Methodologie, Open API, Governance)
- [x] P2.3.2 Nav cleanup — remove "Home", add Verbinding/Transparantie to mobile nav
- [x] P2.3.3 Build MethodologyPanel slide-out with accordion sections
- [x] P2.3.4 Build Term inline tooltip component + MethodologyLink button

### P2.4 — Semantic Matching Improvements
_Source: handover-2026-02-11.md_

- [x] P2.4.1 Complete semantic matching for all TK2023 parties (CIV-15)
- [x] P2.4.2 Set up pgvector embeddings for passage similarity search (CIV-25)
- [x] P2.4.3 Review and tune semantic match confidence thresholds (CIV-26)

### P2.5 — Regeerakkoord Scoring
_Source: recent commits, ETL scripts_

- [x] P2.5.1 Complete Kabinet-Jetten regeerakkoord promise extraction (CIV-16)
- [x] P2.5.2 Run semantic matching on regeerakkoord promises (CIV-16)
- [x] P2.5.3 Verify coalitieverwatering endpoint for Jetten coalition (CIV-18)

## P3 — Low (enhancements)

### P3.1 — Municipal Expansion
_Source: docs/architecture-municipal-expansion.md, docs/spike-municipal-data-sources.md_

- [x] P3.1.1 Complete Amsterdam NotuBiz ingest (motions + votes) (CIV-21)
- [x] P3.1.2 Complete Den Haag NotuBiz ingest (CIV-27)
- [x] P3.1.3 Seed 2026 municipal promises for Amsterdam + Den Haag (CIV-32)
- [x] P3.1.4 Run municipal semantic matching (CIV-33 — Amsterdam: 28,724 matches, Den Haag: 26,645 matches)
- [!] P3.1.5 Request iBabs IP whitelisting for Rotterdam + Utrecht (future)

### P3.2 — Coalition Dynamics
_Source: recent commits_

- [x] P3.2.1 MP-level deviation detection (rebels within party) (CIV-28)
- [ ] P3.2.2 Feedback widget on scorecards (citizen input)
- [x] P3.2.3 Historical coalition comparison dashboard (CIV-38)

### P3.3 — 2026 Campaign
_Source: recent commits, campaign module_

- [x] P3.3.1 Complete election-overview endpoint data population (CIV-20)
- [x] P3.3.2 Campaign landing pages per parliament (CIV-29)
- [x] P3.3.3 Party comparison tool for 2026 elections (CIV-34)

---

## Sprint 6 — Done

### S6.1 — Compute Municipal Scorecards
- [x] S6.1.1 Run compute-scorecards for Amsterdam parliament (CIV-36)
- [x] S6.1.2 Run compute-scorecards for Den Haag parliament (CIV-36)
- [x] S6.1.3 Deploy updated API with municipal scorecard data (CIV-37)

### S6.2 — Coalition Dynamics Enhancements
- [x] S6.2.1 Historical coalition comparison dashboard (CIV-38)

### S6.3 — Data Quality
- [x] S6.3.1 Incremental TK sync + recompute national scorecards (CIV-37)

---

## Sprint 7 — Done

### S7.1 — Data Freshness & Quality
- [x] S7.1.1 Run full incremental sync (moties + stemmingen + sponsors) (CIV-40)
- [x] S7.1.2 Run incremental semantic matching — all TK motions processed (CIV-40)
- [x] S7.1.3 Recompute all 46 scorecards (national + municipal + regeerakkoord) (CIV-40)

### S7.2 — Frontend Integration
- [x] S7.2.1 Update web app: municipal scorecards, coalition comparison, party comparison (CIV-41)

---

## Sprint 8 — Planned

### S8.1 — Platform Polish
- [ ] S8.1.1 Feedback widget on scorecards — citizen input (P3.2.2)
- [ ] S8.1.2 API documentation / OpenAPI spec generation

### S8.2 — Data Freshness Automation
- [ ] S8.2.1 Verify GitHub Actions ETL cron is running on schedule
- [ ] S8.2.2 Add scorecard recompute to automated sync pipeline

### S8.3 — Municipal Expansion
- [ ] S8.3.1 Request iBabs IP whitelisting for Rotterdam + Utrecht (P3.1.5)

### S8.4 — DNS & Production
- [ ] S8.4.1 Fix civicstat.nl DNS (P0.3 — requires manual GoDaddy access)

---

_Last updated: 2026-03-11 by CEO agent (Sprint 7 complete — all motions matched, 46 scorecards recomputed)_
