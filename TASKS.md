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

## P2 — Medium (feature completeness)

### P2.1 — ETL Automation
_Source: PROMPT-etl-cron.md, PROMPT-three-fixes.md_

- [ ] P2.1.1 Verify `sync` and `incremental` CLI commands work end-to-end
- [ ] P2.1.2 Set up GitHub Actions hourly cron (.github/workflows/etl-sync.yml)
- [ ] P2.1.3 Add DATABASE_URL + OPENROUTER_API_KEY secrets to GitHub repo

### P2.2 — Consensus / Verbinding Page
_Source: PROMPT-three-fixes.md, PROMPT-verbinding-fix.md_

- [ ] P2.2.1 Build pre-computed consensus API endpoint (GET /votes/consensus)
- [ ] P2.2.2 Wire PartyBadge into Verbinding page pair rows
- [ ] P2.2.3 Simplify frontend to fetch consensus endpoint instead of client-side calc

### P2.3 — Transparency UI
_Source: PROMPT-quick-fixes-transparency.md_

- [ ] P2.3.1 Wire footer links (Over, Methodologie, Open API, Governance)
- [ ] P2.3.2 Nav cleanup — remove "Home", add Verbinding/Transparantie to mobile nav
- [ ] P2.3.3 Build MethodologyPanel slide-out with accordion sections
- [ ] P2.3.4 Build Term inline tooltip component + MethodologyLink button

### P2.4 — Semantic Matching Improvements
_Source: handover-2026-02-11.md_

- [ ] P2.4.1 Complete semantic matching for all TK2023 parties
- [ ] P2.4.2 Set up pgvector embeddings for passage similarity search
- [ ] P2.4.3 Review and tune semantic match confidence thresholds

### P2.5 — Regeerakkoord Scoring
_Source: recent commits, ETL scripts_

- [ ] P2.5.1 Complete Kabinet-Jetten regeerakkoord promise extraction
- [ ] P2.5.2 Run semantic matching on regeerakkoord promises
- [ ] P2.5.3 Verify coalitieverwatering endpoint for Jetten coalition

## P3 — Low (enhancements)

### P3.1 — Municipal Expansion
_Source: docs/architecture-municipal-expansion.md, docs/spike-municipal-data-sources.md_

- [ ] P3.1.1 Complete Amsterdam NotuBiz ingest (motions + votes)
- [ ] P3.1.2 Complete Den Haag NotuBiz ingest
- [ ] P3.1.3 Seed 2026 municipal promises for Amsterdam + Den Haag
- [ ] P3.1.4 Run municipal semantic matching
- [ ] P3.1.5 Request iBabs IP whitelisting for Rotterdam + Utrecht (future)

### P3.2 — Coalition Dynamics
_Source: recent commits_

- [ ] P3.2.1 MP-level deviation detection (rebels within party)
- [ ] P3.2.2 Feedback widget on scorecards (citizen input)
- [ ] P3.2.3 Historical coalition comparison dashboard

### P3.3 — 2026 Campaign
_Source: recent commits, campaign module_

- [ ] P3.3.1 Complete election-overview endpoint data population
- [ ] P3.3.2 Campaign landing pages per parliament
- [ ] P3.3.3 Party comparison tool for 2026 elections

---

_Last updated: 2026-03-10 by CEO agent (Sprint 1 execution)_
