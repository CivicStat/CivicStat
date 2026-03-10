# CivicStat — ROADMAP.md

*Single source of truth for all development priorities.*
*Last updated: 10 March 2026*
*Read this file at the start of every heartbeat. Delegate technical execution to CTO.*

---

## Mission

**"CivicStat makes promises visible — so voters can see whether parties do what they promise."**

---

## P0 — Pre-Election Critical (deadline: 18 maart 2026)

### P0.1 Fix DNS / civicstat.nl

- GoDaddy A record must point to Vercel
- Verify SSL certificate provisioning
- Effort: 15 min (needs GoDaddy access from Kobe)

### P0.2 Fix abbreviation lookup 500 error

- `GET /parties/VVD/scorecard` returns 500
- Blocks party scorecard pages for all parties accessed by abbreviation
- Effort: 30 min

### P0.3 Insert NSC party + seed promises

- NSC missing from parties table → 0% MCS, breaks scorecard for major coalition party
- Effort: 1 hour

### P0.4 Activate autonomous loop

- Run: `launchctl load ~/Library/LaunchAgents/com.civicstat.agent-loop.plist`
- Verify agent-loop.sh picks up TASKS.md correctly
- Effort: 15 min

### P0.5 Rotterdam + Utrecht (pre-election, parallel to Amsterdam/Den Haag)

- Do NOT wait until post-election — start immediately when Amsterdam + Den Haag data is verified stable
- Same approach as Amsterdam/Den Haag: NotuBiz ETL → promise extraction → semantic matching → scorecards
- Rotterdam: iBabs API access needed (request from Kobe)
- Utrecht: iBabs API access needed (request from Kobe)
- Fallback: Open Raadsinformatie API if iBabs blocked

### P0.6 Fill /nl/verkiezingen/2026 with real data

- Campaign promises 2026 are seeded for Amsterdam + Den Haag
- Verify election overview endpoint returns full data for both cities
- Deploy CampaignModule to Fly.io if not yet done

---

## P1 — Data Quality & Platform Stability

### P1.1 Confidence weighting in MCS calculation

- Currently all matches treated equally regardless of semantic similarity score
- Add confidence threshold (>0.7) to filter weak matches
- Weight matches by confidence in final MCS score
- Effort: 2-3 hours

### P1.2 Fix vote linkage gap (15-16% orphaned)

- 15-16% of votes have `motionId: null`
- Investigate Besluit → Zaak linkage failure
- Re-run vote ingestion with improved linking logic
- Effort: 2-3 hours

### P1.3 Run wetsvoorstellen ingestie

- Script exists: `npx tsx src/index.ts wetsvoorstellen`
- No wetsvoorstel data in DB yet
- Run with limit 500, verify weighted scoring applies (weight: 2.0)
- Effort: 30 min runtime

### P1.4 Motion sponsor data

- `MotionSponsor` table exists but ETL doesn't populate it
- Add ZaakActor fetch to motion ingestion
- Display sponsors on motion detail pages
- Effort: 3-4 hours

### P1.5 Seat counts from API instead of hardcoded

- `PARTY_SEATS` map in belofte-kloof is static TK2023 data
- Add `seats` field to Party schema, fetch from API
- Effort: 2 hours

### P1.6 Search debouncing

- `/zoeken` requires button click — add 300ms debounced auto-search
- Effort: 30 min

### P1.7 Transparency page real-time counts

- `/transparantie` may show stale hardcoded statistics
- Fetch real counts from API on page load
- Effort: 1 hour

---

## P2 — New Features

### P2.1 Kamerlid lidmaatschappen bij internationale organisaties

- Track membership of TK MPs in international think tanks, party groups, NGOs
- Sources: ParliamentaryInternational.org, IPU, Council of Europe PACE, OSCE PA
- Data model: `MpAffiliation { mpId, organizationName, organizationType, role, since, until }`
- Display on MP profile pages as "Internationale verbanden" section
- Priority organizations: WEF, Bilderberg, Atlantic Council, Club of Rome, IPU, PACE
- Effort: ETL (4h) + schema (1h) + frontend (2h)

### P2.2 Multi-language support (NL primary, EN secondary)

- Dutch is the default and primary language — all URLs stay `/nl/`
- Add English as alternative: `/en/` route prefix
- Use Next.js i18n routing with `next-intl` library
- Translation files: `civicstat-web/messages/nl.json` + `civicstat-web/messages/en.json`
- Priority pages to translate first: homepage, party overview, party detail, promise detail, about/methodology
- Language switcher in navigation header
- All MCS algorithm explanations must be translated accurately
- Do NOT translate party names, motion titles, or original promise texts
- Effort: Setup (3h) + core translations (8h) + frontend wiring (4h)

### P2.3 Incremental ETL sync (automated)

- `SyncState` table exists for cursor-based incremental ingestion
- Implement delta sync using `GewijzigdOp` timestamps for all entity types
- Schedule via launchd or GitHub Actions (daily at 03:00)
- Effort: 4-6 hours

### P2.4 Compare endpoint fix

- `GET /parties/scorecards/compare` times out (15 parties x 2 years)
- Add `Promise.all` parallelization or pre-computed cache
- Effort: 1-2 hours

### P2.5 Regeerakkoord matching

- 246 regeerakkoord promises have 0 matches (keyword matching too strict)
- Rerun semantic matching for regeerakkoord programs
- Effort: 1-2 hours runtime

---

## P3 — Post-Election (after 18 maart 2026)

### P3.1 Rotterdam + Utrecht (if not completed pre-election)

- Full municipal onboarding: ETL, promises, matching, scorecards, frontend pages

### P3.2 EU Parliament expansion

- European Parliament voting data via VoteWatch Europe API
- Dutch MEPs (currently ~26 seats)
- Promise extraction from EP election programs (2024)
- New parliament scope: `europees-parlement`

### P3.3 MP voting consistency score

- Individual MP MCS alongside party MCS
- "Fractiediscipline" metric: how often does MP vote with their party?
- Highlight MPs who consistently break with party line

### P3.4 Historical seat tracking

- Track seat count changes over time (splits, mergers, new parties)
- Required for accurate historical belofte-kloof calculation

### P3.5 Multi-country scaling

- Architecture review for Belgium, Germany, UK expansion
- Standardized parliament data model
- Partner/contributor onboarding documentation

### P3.6 Civic Labs Intel Platform

- Second product on same Mac Studio infrastructure
- HR services + sales intelligence
- Architecture decision: shared vs independent infrastructure
- Do not start until CivicStat is fully stable post-election

---

## Technical Debt

- Consolidate handover files into single `HANDOVER.md`, archive old versions to `docs/archive/`
- Update `docs/architecture.md` to reflect current stack
- Add `<Image />` optimization for PartyLogo + MemberPhoto components
- Fix `GET /parties/scorecards/compare` 502 timeout
- Verify belofte-kloof dual vote bar on production (test URL: `/moties/185037c3-1ddf-477e-9293-4e7bce3c4bdd`)
- Add loading states to all data-fetching pages

---

## Principles for Autonomous Agents

1. **Read this file first** on every heartbeat
2. **Political neutrality is non-negotiable** — never rank parties, never use red/green partisan colors
3. **Always verify before deploying** — run TypeScript compiler + API health check before any deploy
4. **Concurrency limits** for long ETL runs: max 5 concurrent, checkpoint every 20 items
5. **Database operations** — always use Transaction Pooler (port 6543) for IPv4 compatibility
6. **Cost management** — use OpenRouter/local Ollama for bulk tasks, Claude API for precision only
7. **Commit often** — every completed task gets a descriptive git commit before moving to next
8. **Report blockers immediately** — if a task needs Kobe's input (credentials, GoDaddy, iBabs access), escalate via Paperclip and move to next task

---

## Escalate to Board (Kobe) when:

- GoDaddy DNS access needed
- iBabs API credentials for Rotterdam/Utrecht needed
- Budget decisions > 100 EUR
- Any production database migration
- Deploy failures that can't be auto-resolved
