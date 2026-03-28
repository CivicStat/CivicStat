# CivicStat Roadmap

## 🔴 Active Sprint — NL Foundation First (Board Directives CIV-157 + CIV-164)

### CIV-164: [BOARD DIRECTIVE] Team: hervat werk op de roadmap
Status: IN PROGRESS — Ronde 2 (UI/UX polish) started.
Assigned: CEO (Dan) — coordinating
Priority: CRITICAL
Description: Board directive to reactivate all agents. Three rounds: (1) MCS methodology waterdicht ✓, (2) UI/UX polish, (3) NL uitbreiding.
Success: Ronde 2 complete → status report to Board.

### CIV-157: [BOARD DIRECTIVE] NL foundation first — België/internationaal GEPAUZEERD
Status: DONE — NL foundation complete. Closed in Paperclip.
Assigned: CEO (Dan)
Priority: CRITICAL
Description: All international expansion paused. NL foundation first.

## 🟡 Next Sprint — Ronde 2: UI/UX Polish + Ronde 3: NL Expansion

### CIV-156: Zuid-Holland + Vlaams Parlement — promises + matching + scorecards
Status: ON HOLD — Board directive CIV-157 (international expansion paused)
Assigned: CTO (Steve)
Priority: MEDIUM

## 🟢 Backlog
- [!] Fix civicstat.nl DNS — GoDaddy A record -> Vercel (requires manual GoDaddy access by Kobe)

## 🟠 Agent Roster (all hired and approved)

- **Vera** (Data Quality): `2cd088a8` — idle, awaiting Dagster setup
- **Lisa** (Chief of Staff): `992b9a7f` — active, running hourly heartbeats
- **Femke** (UI/UX Analyst): `104736bb` — idle, awaiting Ronde 2 tasks
- **Maurice** (Political Intelligence): `7dc86a5a` — activated, instructions path set

## ✅ Done

### CIV-228: Vercel auto-deploy webhook — manual redeploy — DONE
- [x] Completed at 2026-03-28T20:28Z by Steve
- [x] Manual `vercel deploy --prod` — 47/47 pages built
- [x] All 4 municipal moties outcome filters working live
- [x] 18min detection-to-fix (Femke→Lisa→Dan→Steve chain)
- [!] Webhook investigation still pending (non-urgent)

### CIV-170: [BOARD CONFIG] Heartbeat schedules + rapportageketen — DONE
- [x] Completed at 2026-03-28T13:00Z by Steve
- [x] Maurice: 3-day heartbeat. Vera: daily. Femke: 6h.
- [x] Reporting chain: Femke → Lisa, Maurice → Dan, Vera → Steve

### CIV-227: Apply ensemble confidence threshold 0.5 → 0.6 — DONE
- [x] Completed at 2026-03-28T02:53Z by Steve
- [x] Updated parties-scorecard.service.ts:333 (0.5 → 0.6)
- [x] 73 party + 7 regeerakkoord + 782 member scorecards recomputed
- [x] Build successful, deployed

### CIV-226: Municipal moties filter case mismatch — DONE
- [x] Completed at 2026-03-28T02:11Z by Steve (commit 3ab8cae)
- [x] Fixed case mismatch: filter now sends lowercase status values
- [x] Submodule updated (78552b5), both repos pushed

### CIV-224: Calibration — ensemble judge agreement + threshold tuning — DONE
- [x] Completed at 2026-03-27T23:30Z by Steve
- [x] 93% match_type agreement (Claude vs Qwen), 91% intention_label agreement
- [x] 57,462 judgements across 27 ensemble runs, thresholds tuned
- [x] Ronde 1 CIV-164 milestone: MCS methodology validated

### CIV-186: [GOAL] MCS Judgement Engine — DONE
- [x] Phase 1 complete: CIV-195 (build) → CIV-196 (wire) → CIV-198 (scale) → CIV-224 (calibrate)
- [x] 57,462 judgements, 93% model agreement, Claude-only mode operational
- [x] Phase 2 (GPT-4o) deferred — 2/3 models sufficient

### CIV-220: Semantic match coverage 89.06% — DONE
- [x] Completed at 2026-03-27T22:27Z by Steve
- [x] Coverage: 89.06% (16,164/18,149). 1,985 remaining are structurally unmatchable (0 candidate motions).
- [x] EK: 9,233 new matches (8h 17m). ZH: 9,054 new matches (8h 35m). DH: already complete.
- [x] 782 member scorecards recomputed (EK + ZH)
- [x] Target revised: 89% is ceiling given available motions

### CIV-223: Anthropic credits exhausted (2nd time) — DONE
- [x] Resolved: all processes completed before full exhaustion
- [x] Lisa closed at 23:22Z — no longer needed

### CIV-198: Ensemble Judge Phase 3 — DONE
- [x] Completed at 2026-03-27T22:09Z
- [x] 4,277/4,820 TK promises judged (88.7%), 543 skipped (no motion matches — correct)
- [x] 57,462 ensemble judgements stored with per-model reasoning audit trail
- [x] Major milestone: MCS Judgement Engine Phase 1 complete

### CIV-222: Anthropic credits top-up — DONE
- [x] Kobe topped up Anthropic credits (2026-03-27T12:00Z)
- [x] CIV-198 and CIV-220 unblocked

### CIV-221: Vercel auto-deploy fix — DONE
- [x] Completed by Steve at 2026-03-27
- [x] Formatie callout now live on all municipality dashboards
- [x] Utrecht informatie phase visible to users

### CIV-197: Maurice launchd guard — ISO-week check — DONE
- [x] Completed by Steve at 2026-03-26
- [x] Created wrapper script agents/maurice/run-weekly.sh with ISO-week guard
- [x] Checks .agent-logs/maurice-last-run-week.txt against current %G-W%V
- [x] Updated nl.civicstat.maurice.plist to call wrapper, reloaded launchd

### CIV-202: Sociaal Akkoord Tracker — DONE
- [x] Completed by Steve at 2026-03-26
- [x] Endpoint: GET /parliament/:slug/sociaal-akkoord
- [x] 1,780 social-theme motions, 13 with broad cross-party consensus (5+ parties)
- [x] 4 themes: ZORG (5), SOCIAAL (5), ONDERWIJS (4), WONEN (2)
- [x] Average consensus breadth: 8-9.4 parties per motion
- [x] Deployed to Fly.io and verified live

### CIV-203: NSC Partijautopsie deep-dive — DONE
- [x] Completed by Steve at 2026-03-26
- [x] Endpoint: GET /parliament/:slug/parties/:id/autopsie?year=2023&coalition=schoof
- [x] Returns: scorecard, MCS trend, theme breakdown, top inconsistent/consistent promises, CAI, polling
- [x] NSC pilot: MCS=50, worst themes ECONOMIE (41%), ZORG (25%), BESTUUR (22%), CAI=82% under Schoof
- [x] Deployed to Fly.io and verified live

### CIV-204: Constructieve Oppositie Monitor — DONE
- [x] Completed by Steve at 2026-03-26
- [x] New endpoint: GET /parliament/tweede-kamer/constructieve-oppositie
- [x] 12 opposition parties tracked, 86 votes analyzed
- [x] CU most constructive (CAI=74), followed by GL-PvdA (63), Volt (62)
- [x] Initiative breakdown: 9 coalition, 73 opposition, 4 unknown
- [x] Deployed to Fly.io and verified live

### CIV-205: Homepage "80 Partijen" misleading stat — DONE
- [x] Confirmed already fixed by CIV-217 (homepage now uses getScopedStats("tweede-kamer"))
- [x] Live API: /parliament/tweede-kamer/stats returns 16 parties, 150 members (correct)

### CIV-199: Homepage "443 Kamerleden" stale count — DONE
- [x] Same root cause as CIV-205 — fixed by CIV-217 scoped stats
- [x] Homepage now shows 150 members (TK-scoped)

### CIV-200: Municipality dashboards formatie tracker link — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Added formatie callout to /nl/gemeenten/[city] pages — shows phase badge, leader, participant count, link to /nl/formatie/{city}
- [x] Fetches formation data in parallel with existing data. Commit 6eee2c3, submodule updated (3c6fb38)

### CIV-219: Old /nl/gemeente/ URLs redirect — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Added 301 permanent redirects in next.config.mjs for /nl/gemeente → /nl/gemeenten
- [x] Covers index, :city, and :city/:path* patterns
- [x] Commit d224186 in civicstat-web, submodule updated (a18514a)

### CIV-201: Emoji in Nav and ScopeSwitcher — DONE
- [x] Completed by Steve at 2026-03-25
- [x] ScopeSwitcher.tsx: replaced flag/building emoji with NL/GR/EU/EK text labels
- [x] Nav.tsx: removed emoji prefixes from mobile menu links
- [x] app/page.tsx: removed EU flag from "Binnenkort" section
- [x] MotionMatchList.tsx (2 files): replaced warning emoji with "LQ" text label

### CIV-213: Municipal moties pages missing party/theme filters — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Created MotiesFilters.tsx with vote outcome pills, text search, "Met stemuitslag" toggle, sort toggle
- [x] Updated page.tsx with searchParams support, client-side vote sort, pagination preserves filter state
- [x] Extended getScopedMotions() with soort and hasVotes params
- [x] Build passes, deployed to Vercel. Note: EK moties page has same gap (follow-up)

### CIV-211: Consensus matrix '-1' sentinel fix — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Fixed ConsensusMatrix.tsx: display, color, click guard, tooltip, cursor for insufficient-data cells
- [x] No longer shows '-1' — replaced with proper empty/insufficient state

### CIV-206: Rotterdam/Utrecht raadsleden backfill — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Added `syncORIMembers()` to ori-sync.ts — fetches Person/Membership/Organization from ORI
- [x] Rotterdam and Utrecht now have real raadsleden (not party placeholders)

### CIV-207: Semantic match coverage audit — DONE
- [x] Completed by Steve at 2026-03-25
- [x] TK at 99.6%, Amsterdam 99.1%, Rotterdam 99.6%. Gap was in EK (79.1%) and Den Haag (88.9%) due to fewer motions
- [x] No matching backlog — all promises processed by semantic matcher

### CIV-209: TK overview page cross-parliament stats — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Replaced `getPromiseStats()` with `getScopedPromiseStats("tweede-kamer")`
- [x] Now shows 6,917 promises / 17 partijen / 163K matches (TK only)

### CIV-218: EK motie detail pages — contradictory vote data + empty summaries — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Backfilled 127 EK votes from VoteRecords
- [x] Fixed vote aggregation for non-hoofdelijke stemmingen

### CIV-210: Fix Ollama integratie in ensemble-judge — DONE
- [x] Completed by Steve at 2026-03-25T08:02Z
- [x] dotenv installed and imported in etl index.ts
- [x] 2/3 models active: Ollama/qwen2.5:32b + Claude-sonnet. GPT-4o disabled (OpenRouter budget)
- [x] Test: 5 promises, 64 judgements, 38% unanimous, 54% majority
- [x] Unblocks CIV-198 (full ensemble run) and CIV-186 cascade

### CIV-217: [BOARD] Fix party/member count inconsistencies — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Homepage/TK now uses scoped `/parliament/tweede-kamer/stats` instead of global `/stats`
- [x] Party count filters `seats > 0` — shows 16 active parties, 150 MPs
- [x] Verified: `curl /parliament/tweede-kamer/stats` returns correct counts

### CIV-168: Methodologie-audit CIV-143 t/m CIV-149 — DONE
- [x] Completed by Steve at 2026-03-25
- [x] All 7 methodology issues audited: code, live endpoint, correctheid
- [x] CIV-143 (Koersvastheid), CIV-144-149 all verified live

### CIV-208: Dagster sidecar health check — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Made Dagster health check conditional on DAGSTER_URL env var
- [x] Health endpoint now returns "not_configured" when Dagster not deployed

### CIV-212: Eerste Kamer party detail pages 404 — DONE
- [x] Completed by Steve at 2026-03-25
- [x] Created 3 missing EK detail pages: partijen/[id], senatoren/[id], moties/[id]

### CIV-216: Reassign blocked tasks to Steve — DONE
- [x] Completed by Dan at 2026-03-25

### CIV-196: Ensemble Judge Phase 2 — DONE
- [x] Completed by Steve
- [x] `?ensemble=true` on scorecard endpoints uses ensemble verdicts from MatchJudgement table
- [x] `/compare/ensemble` and `/compare/ensemble/:party` deployed
- [x] BBB: semantic=59, ensemble=68 (delta +9)
- [x] 2/3 models operational (Ollama + Claude). GPT-4o needs OPENAI_API_KEY.

### CIV-195: Ensemble Judge Phase 1 — DONE
- [x] Completed by Steve at 2026-03-23T22:19Z
- [x] MatchJudgement Prisma model with full audit trail
- [x] ensemble-judge.ts: 3 model adapters (Ollama qwen2.5:32b, Claude, GPT-4o)
- [x] Parallel calls, conflict resolution (unanimous/majority/no_agreement), HITL routing
- [x] CLI: `pnpm dev -- ensemble-judge --parliament tweede-kamer --limit 10`
- [x] Verified: 37 judgements, 17 verdicts, majority 14, unanimous 3
- [x] Shadow mode: existing semantic-matcher untouched

### CIV-173: Stad-Land MCS Divergentie — DONE
- [x] Completed by Steve at 2026-03-23T15:37Z
- [x] National vs municipal MCS comparison for same parties across parliaments
- [x] /compare/overview live: Utrecht avg 90.3 (highest), Rotterdam 57.3 (lowest)
- [x] Verified in production

### CIV-172: Partijautopsie — reusable party autopsy endpoint — DONE
- [x] Completed by Steve at 2026-03-23T15:16Z
- [x] `GET /parties/:id/autopsy?year=` — MCS, broken promises, theme breakdown, MP departures, coalition history
- [x] Works for any party. NSC verified: 0 seats, full autopsy data.
- [x] Deployed to production

### CIV-174: Buitenlandbeleid belofte-tracking — DONE
- [x] Completed by Steve at 2026-03-23T15:19Z
- [x] `GET /insights/thema-audit` — gap analysis across 10 policy domains
- [x] `GET /insights/defensie-tracker` — defense/foreign affairs motion tracking
- [x] ECONOMIE biggest gap (0.21 ratio), BUITENLAND 0.43, DEFENSIE 0.74
- [x] Verified in production

### CIV-172: Partijautopsie-pagina — DONE
- [x] Completed by Steve at 2026-03-23T14:35Z
- [x] `GET /parties/:id/autopsy?year=` endpoint deployed
- [x] Reusable template: belofteBalans, oorzakenanalyse, coalitiegeschiedenis, stemgedrag
- [x] NSC autopsy verified in production

### CIV-175: Poll-MCS Correlation View — DONE
- [x] Completed by Steve at 2026-03-23T14:14Z
- [x] `GET /parliament/:slug/poll-mcs-correlation` endpoint deployed
- [x] Spearman rank correlation: -0.114 (zwak/neutraal). Dutch narrative included.
- [x] Verified in production

### CIV-179: UX: Insights page emoji removal — DONE
- [x] Completed by Steve at 2026-03-23T13:15Z
- [x] Emoji removed from insights page section headers per design system

### CIV-176: Broken-Promise Spotlight — DONE
- [x] Completed by Steve at 2026-03-23T13:25Z
- [x] Enhanced `GET /insights/belofte-van-de-week` with `?keywords=` parameter for news boosting
- [x] Evidence array added to response
- [x] Verified in production: returning ChristenUnie broken promise for week 13

### CIV-177: Minderheidskabinet Support Tracker — DONE
- [x] Completed by Steve at 2026-03-23T13:12Z
- [x] New `GET /coalitions/:slug/coalitiesteun` endpoint deployed
- [x] Opposition parties classified: structureel (>=70%), regelmatig (50-70%), incidenteel (<50%)
- [x] Verified in production: CU at 74% structureel support for Kabinet-Jetten

### CIV-161: Broken NB-PLACEHOLDER images on Kamerleden list — FIXED
- [x] Completed by Steve at 2026-03-23T12:16Z
- [x] Fallback avatar for municipal/provincial MPs with NB- prefixed IDs

### CIV-162: Duplicate party entries in Kamerleden list — FIXED
- [x] Completed by Steve at 2026-03-23T12:21Z
- [x] Name normalization added to ETL upsertParty for Rotterdam NotuBiz variants

### CIV-163: Zero-motions MPs — labeled and sorted to bottom
- [x] Completed by Steve at 2026-03-23T12:22Z
- [x] "Nog geen stemmingen geregistreerd" label, sorted to bottom of list

### CIV-169: Homepage EK "coming soon" → active parliament — FIXED
- [x] Completed by Steve at 2026-03-23T12:04Z
- [x] EK promoted to full nav card in homepage grid
- [x] "Binnenkort" row now only shows Europees Parlement + 250+ gemeenten

### CIV-178: /formatie navigation link returns 404 — FIXED
- [x] Completed by Steve
- [x] Added permanent redirects: /formatie → /nl/formatie, /formatie/:slug → /nl/formatie/:slug

### CIV-160: Kamerleden list mixes faction entries with individual MPs — FIXED
- [x] Completed by Steve
- [x] Added "(fractie)" filter to members.service.ts list(), getRebels(), getPartyRebels()
- [x] Deployed to Fly.io

### CIV-185: Eerste Kamer — seed promises + semantic matching + scorecards — DONE
- [x] Completed by Steve at 2026-03-23T11:09Z
- [x] 2,828 promises seeded across 13 EK parties (from TK2025 programs)
- [x] 10,678 semantic matches (611 explicit, 9,513 implicit, 554 contradicts)
- [x] 22 scorecards computed (13 party + 9 member). matchRate 79%.
- [x] EK now fully operational: 19 parties, 75 senators, 162 motions, 2,828 promises

### CIV-181: Eerste Kamer sub-pages returning 404 — FIXED
- [x] Completed by Steve at 2026-03-23T06:08Z
- [x] Created 3 missing EK pages: /nl/eerste-kamer/partijen, /senatoren, /moties
- [x] Using scoped API endpoints with real data (19 parties, 75 senators, 162 motions)

### CIV-183: Re-run parliament-scoped semantic matching for ZH, DH, UT — DONE
- [x] Completed by Steve at 2026-03-23T06:01Z
- [x] --resume confirmed all promises already processed. Coverage gaps are structural (low motion counts):
- [x] ZH: 56% (2,705 promises vs 969 motions), DH: 85% (2,619 vs 572), UT: 76% (264 vs 236)
- [x] 574 member scorecards recomputed

### CIV-184: Flemish Parliament motions in TK moties list — FIXED
- [x] Completed by Steve at 2026-03-23T07:02Z (commit 9e609f9)
- [x] All unscoped API endpoints now default to tweede-kamer parliament_id
- [x] /motions: 25,286 → 16,203 (correct). /members: 443 → 150 (correct). /parties scoped.
- [x] Also resolves CIV-166 (Belgian/municipal party entries in TK)

### CIV-166: Belgian/municipal party entries in TK — FIXED
- [x] Resolved by CIV-184 fix (commit 9e609f9)
- [x] Zero Belgian/Flemish entries. Zero municipal entries. Verified in production.

### CIV-182: [CRITICAL] Cross-parliament match contamination — FIXED
- [x] Completed by Steve at 2026-03-23T05:04Z
- [x] Found 32,411 contaminated matches (11.76% of 275,663 total). Worst: ZH→TK 16,085 matches
- [x] Root cause: semantic-matcher.ts findCandidateMotions() used CLI --parliament flag, not promise's parliament
- [x] All contaminated matches purged, scorecards recomputed, parliament scope filter added
- [x] Post-cleanup: TK 98%, AMS 100%, ROT 100%, DH 85%, UT 76%, ZH 56%

### CIV-180: Ronde 2 — P0 UI/UX bugs (raadsleden 404s, custom 404, theme-state)
- [x] Completed by Steve (status: done in Paperclip)

### CIV-167: DQA daily cycle — Vera spot-check complete
- [x] Completed by Vera at 2026-03-23T02:53Z
- [x] 10 random TK matches sampled. Findings: 60% null intentionLabel, 1 cross-parliament match (CRITICAL), 1 bad match (waterkeringen→kernenergie), 1 suspect confidence
- [x] Filed CIV-182 (cross-parliament contamination) and CIV-171

### CIV-152: Semantic match coverage — ALL NL TARGETS EXCEEDED
- [x] Completed by Steve at 2026-03-22T21:33Z
- [x] Final live (07:15Z): TK 98% (112), DH 98% (54), UT 99% (2), AMS/ROT/VP 100%, ZH 95% (142)
- [x] Matching ran autonomously — coverage continued climbing after Steve closed ticket

### CIV-158: coalitionStatus missing from election-overview
- [x] Completed by Steve at 2026-03-21T18:11Z

### CIV-159: Scope belofte-van-de-week to NL parliaments only
- [x] Completed by Steve at 2026-03-21T18:12Z

### Expansion Sprint — COMPLETE then PAUSED by Board (2026-03-21)
- [x] CIV-153: Zuid-Holland PS ETL (Steve, 11:52Z)
- [x] CIV-154: Vlaams Parlement ETL (Steve, 14:00Z)
- [x] CIV-155: Data freshness verified across 7 parliaments (Steve, 12:11Z)
- [!] CIV-156: PAUSED per Board directive CIV-157

### UI/UX Polish + Research Sprint — COMPLETE (2026-03-21)
- [x] CIV-129: Changelog page (Steve, 08:19Z)
- [x] CIV-131: UI/UX Polish Round (Steve, 07:11Z)
- [x] CIV-141: Data freshness dashboard (Steve, 02:26Z)
- [x] CIV-118: Provinciale Staten research (Steve, 09:11Z)
- [x] CIV-119: Belgium expansion research (Steve, 10:09Z)

### CIV-139: Methodology Audit Sprint — COMPLETE (2026-03-21)
- [x] CIV-141: Data freshness dashboard (Steve, 02:26Z)
- [x] CIV-143: Koersvastheid formula revision (Steve, 2026-03-20T21:08Z)
- [x] CIV-144: Neutral language/framing (Steve, 2026-03-20T21:30Z)
- [x] CIV-145: O-MCS opposition-corrected scoring (Steve, 2026-03-20T22:39Z)
- [x] CIV-146: Intention classifier (Steve, 2026-03-20T21:30Z)
- [x] CIV-147: Coalitieverwatering cosine similarity (Steve, 02:49Z)
- [x] CIV-148: Threshold refinement (Steve, 04:14Z)
- [x] CIV-149: Winnende kant → Coalitie-alignment/Motiesucces (Steve, 05:06Z)
- [x] CIV-150: Methodology changelog page (Steve, 03:56Z)
- [x] CIV-151: DQA spot-check cycle (Steve, 06:04Z)
- [x] Board directive fulfilled. Sprint closed by CEO at 2026-03-21T06:59Z

### CIV-143: Koersvastheidformule herziening — richting-gecorrigeerde stabiliteitsscore
- [x] Completed by Steve at ~2026-03-20T21:08Z
- [x] New formula: avg + delta/2 (improving) or avg + delta (declining), clamped 0-100
- [x] Edge cases fixed: MCS(20,20) → 20 (was 80), MCS(40→75) → 75 (was 65)
- [x] Endpoint LIVE: /parties/:slug/koersvastheid with theme deltas
- [x] Verified DONE by CEO at 2026-03-20T23:46Z

### CIV-146: Intentie-classifier voor matchtype
- [x] Completed by Steve at ~2026-03-20T21:30Z
- [x] Schema migration: intention_label (PRO/CONTRA/NEUTRAL), intention_rationale, review_status fields
- [x] 12,890 existing matches with confidence 0.3-0.5 marked PENDING_REVIEW
- [x] Enhanced Claude prompt with explicit intention classification
- [x] Verified DONE by CEO at 2026-03-21T00:47Z

### CIV-145: Oppositie-gecorrigeerde MCS (O-MCS)
- [x] Completed by Steve at ~2026-03-20T22:39Z
- [x] coalitionStatus label (coalitie/oppositie) on all scorecard responses
- [x] O-MCS endpoint: /parties/:id/o-mcs — excludes coalition-whipped votes
- [x] PVV verified: standardMCS=64, O-MCS=31, 5444 whipped votes excluded
- [x] Verified DONE by CEO at 2026-03-21T00:47Z

### CIV-144: Taalgebruik en framing — neutralere methodologische claims
- [x] Completed by Steve at ~2026-03-20T21:30Z
- [x] Tagline → "Gebaseerd op openbare bronnen. Reproduceerbaar. Transparant over methodologische keuzes."
- [x] "Inconsistent" → "Niet in lijn" across all pages
- [x] Methodology disclaimer added to all party pages. Typecheck passes.
- [x] Verified DONE by CEO at 2026-03-20T23:46Z

### CIV-140: Cross-parliament comparison — vergelijk gemeenten onderling
- [x] Completed by Steve at ~2026-03-20T20:30Z
- [x] Endpoint: /compare/parties?party=X — same party MCS across all parliaments
- [x] Endpoint: /compare/overview — per-parliament averages with most/least consistent parties
- [x] Verified: GroenLinks Utrecht MCS 89, TK 84. Utrecht avg MCS 90.3 (highest). DENK Utrecht 100 (most consistent).
- [x] Verified DONE by CEO at 2026-03-20T20:40Z

### CIV-89: EU legislative calendar + party congress monitoring
- [x] Completed by Steve at ~2026-03-20T18:45Z
- [x] Endpoint: /insights/eu-calendar — EU legislation with Dutch theme mapping + relevance scoring
- [x] Live data: Innovation Fund report mapped to KLIMAAT theme
- [x] Verified DONE by CEO at 2026-03-20T18:49Z

### CIV-88: Dagster health monitoring — /dagster/health endpoint
- [x] Completed by Steve at ~2026-03-20T18:03Z
- [x] Health endpoint now includes `dagster` status (ok/down) with URL and error details
- [x] Verified: /health returns `{"dagster":{"status":"down"}}` — expected (Dagster runs on Mac Studio, not Fly.io)
- [x] Verified DONE by CEO at 2026-03-20T18:40Z

### CIV-138: MP ranking performance — /members/ranking 502 fix
- [x] Completed by Steve at ~2026-03-20T15:50Z
- [x] /parliament/tweede-kamer/members/ranking now returns 200 (141 members, pre-computed)
- [x] Top member: el Abassi (DENK) MCS 86, 168 scored promises, 2615 votes analyzed
- [x] Verified DONE by CEO at 2026-03-20T16:38Z

### CIV-137: MP-level MCS — individuele raadsleden/kamerleden consistency scores
- [x] Completed by Steve at ~2026-03-20T15:20Z
- [x] Endpoint: /parliament/:slug/members/:id/mcs — individual member MCS with theme breakdown
- [x] Verified: Aartsen (VVD) personal MCS 25, 153 scored promises, 12 themes
- [x] Note: /members/ranking endpoint 502s on TK (150 members) — performance fix tracked as CIV-138
- [x] Verified DONE by CEO at 2026-03-20T15:35Z

### CIV-136: MCS Weekrapport — automated weekly summary digest
- [x] Completed by Steve at ~2026-03-20T12:50Z
- [x] Endpoint: /weekrapport — cross-parliament weekly digest (Week 12, 2026)
- [x] Endpoint: /parliament/:slug/weekrapport — per-parliament digest
- [x] Amsterdam: Partij voor de Dieren top MCS (80), 189 scored promises
- [x] Verified DONE by CEO at 2026-03-20T13:33Z

### CIV-134: Partijstatus Risicomonitor — partijen die ophouden te bestaan
- [x] Completed by Steve at ~2026-03-20T12:00Z
- [x] Endpoint: /parliament/:slug/party-status — party lifecycle tracking (active, at-risk, merged, dissolved)
- [x] Rotterdam: 18 parties tracked, all ACTIEF with seat/MP counts
- [x] Verified DONE by CEO at 2026-03-20T12:30Z

### CIV-132: Peilingen-MCS Divergentiemeter
- [x] Completed by Steve at ~2026-03-20T12:15Z
- [x] Endpoint: /parliament/:slug/peilingen-mcs — polling vs MCS divergence analysis
- [x] Tweede Kamer: 17 parties. Key findings: D66/JA21/GL-PvdA rewarded for promise-keeping; VVD/PVV/BBB punished
- [x] Municipal: correctly reports "Geen peilingdata beschikbaar" (polling is national-level)
- [x] Verified DONE by CEO at 2026-03-20T12:30Z

### CIV-135: Post-gemeenteraadsverkiezingen uitslag-analyse
- [x] Completed by Steve at ~2026-03-20T10:20Z
- [x] Endpoint: /parliament/:slug/uitslag-analyse — election outcome vs MCS analysis
- [x] Amsterdam: strong negative correlation (rho=-0.64) — lower MCS parties won more seats
- [x] Verified DONE by CEO at 2026-03-20T10:27Z

### CIV-133: Scorecard Snapshot Archiver — weekly historical MCS snapshots
- [x] Completed by Steve at ~2026-03-20T10:00Z (API v119)
- [x] Endpoint: /parliament/:slug/scorecards/history — monthly snapshot data
- [x] Rotterdam verified: D66 MCS 47, monthly snapshots with party-level breakdown
- [x] Verified DONE by CEO at 2026-03-20T10:27Z

### CIV-128: Formatie Live Updates — automated coalition formation news scraping
- [x] Completed by Steve at 2026-03-20T08:38Z
- [x] Municipal news scraping for formation developments
- [x] Auto-update Formation model via admin endpoints
- [x] Dagster hourly schedule configured
- [x] Verified DONE by CEO at 2026-03-20T08:40Z

### CIV-126: Formatie Tracker — coalition formation monitoring dashboard
- [x] Completed by Steve at 2026-03-19T22:41Z
- [x] Prisma models: Formation, FormationRound, FormationParticipant with FormatiePhase enum
- [x] 6 endpoints: /parliament/:slug/formatie, /formatie/kansen, admin POST/PATCH
- [x] Rotterdam: VERKENNING phase with 4 participating parties seeded
- [x] Amsterdam, Utrecht, Den Haag: VERKENNING initialized
- [x] CIV-125 compatibility overlay integrated into kansen endpoint
- [x] Verified DONE by CEO at 2026-03-20T00:16Z

### CIV-127: Formatie Dashboard — real-time coalition formation pages for all municipalities
- [x] Completed by Steve at 2026-03-20T06:52Z
- [x] Web submodule: commit 0c166cd — /nl/formatie overview + /nl/formatie/[slug] detail pages
- [x] Monorepo: commit 12edef6
- [x] Verified DONE by CEO at 2026-03-20T07:24Z

### CIV-125: Coalitiewijzer — municipal coalition compatibility analysis
- [x] Completed by Steve at 2026-03-19T21:26Z
- [x] Pairwise alignment matrix for all 6 parliaments (rotterdam 18 parties, amsterdam 14, den-haag, utrecht, tweede-kamer 15, eerste-kamer 19)
- [x] Coalition simulator: /parliament/:slug/coalition-simulator?parties=X,Y,Z — averagePairwiseAlignment + theme breakdown
- [x] Rotterdam GroenLinks-PvdA-D66: 80% average pairwise alignment (1276-1389 agreed votes)
- [x] Verified DONE by CEO at 2026-03-19T22:13Z

### CIV-117: Developer portal — public API v2 with auth, rate limiting and /nl/developer page
- [x] Completed by Steve at 2026-03-19T20:28Z
- [x] GET /v2/docs serves Swagger UI — LIVE (200)
- [x] API key auth: 401 without key, 200 with X-API-Key header
- [x] Rate limiting: 429 after 100 req/min threshold
- [x] 7 public + 7 authenticated v2 endpoints operational
- [x] Verified DONE by CEO at 2026-03-19T21:09Z

### CIV-122: Belofte van de Week — weekly editorial insight
- [x] Completed by Steve at 2026-03-19T18:35Z
- [x] Algorithm: queries votes + promise-motion matches, scores by newsworthiness (match type, confidence, recency)
- [x] GET /insights/belofte-van-de-week returns Week 12 finding: PVV (Den Haag) — parkeerbeleid promise broken
- [x] Also included in GET /insights aggregate as belofteVanDeWeek
- [x] Verified DONE by CEO at 2026-03-19T19:04Z

### CIV-124: Election night — seed gemeenteraad 2026 results for all 4 municipalities
- [x] Completed by Steve — verified DONE in Paperclip (status: done)
- [x] All 4 municipalities: resultsAvailable=true with seat data
- [x] Amsterdam 44 seats (winner: GroenLinks 10), Den Haag 45 seats (winner: Hart voor Den Haag 17), Rotterdam 45 seats (winner: GroenLinks 11), Utrecht 39 seats (winner: GroenLinks 14)
- [x] Verified DONE by CEO at 2026-03-19T18:02Z via curl /gemeenteraad/uitslag-2026

### CIV-115: Full-text search via Weaviate
- [x] Completed by Steve at 2026-03-19T15:15Z
- [x] GET /search?q=klimaat returns grouped results (promises, motions, parties, MPs)
- [x] Weaviate hybrid search operational — first production use of CIV-81
- [x] Verified DONE by CEO at 2026-03-19T17:02Z

### CIV-116: Dynamic OG social cards — per-party, per-MP and per-insight shareable images
- [x] Completed by Steve at 2026-03-19T15:00Z
- [x] Server-side OG image generation for party/MP/insight pages
- [x] Verified DONE in Paperclip

### CIV-114: Belofte tracker — filter all promises by topic, party and status across parliament
- [x] Completed by Steve — marked done in Paperclip
- [x] GET /promises?theme=X&party=Y&status=Z — all filters working
- [x] GET /promises/topics — 18 topics with kept/broken/pending counts LIVE
- [x] Topics timeout + status filter issues from initial deploy now fixed
- [x] Verified DONE by CEO at 2026-03-18T14:48Z

### CIV-113: MCS trend chart — party score evolution over time and across parliaments
- [x] Completed by Steve — marked done in Paperclip, web submodule updated (commit 7f4510d)
- [x] Frontend MCS trend chart using existing historicalMcs/vooruitblikMcs scorecard data

### CIV-120: Thematische MCS — per-theme promise consistency breakdown per party
- [x] Completed by Steve at 2026-03-17T15:09Z
- [x] Endpoint: GET /parties/:id/scorecard/by-theme?year=N — LIVE
- [x] Per-theme MCS with scoredPromises, consistent/inconsistent/mixed counts
- [x] Verified: PVV overall 47, Onderwijs 70, Veiligheid 63, Klimaat 53

### CIV-111: Open data layer — downloadable datasets + press kit
- [x] Completed by Steve — marked done in Paperclip
- [x] Downloadable datasets, public API docs, press kit at /nl/pers

### CIV-121: Post-verkiezingen scorecard — wat krijgen kiezers per gemeente?
- [x] Completed by Steve at 2026-03-17T12:34Z
- [x] 3 endpoints LIVE: /parliament/:slug/uitslag-2026, /gemeenteraad/uitslag-2026, /admin/election-results/:slug
- [x] Rotterdam 15 parties, Utrecht 16 parties, Amsterdam + Den Haag all with MCS
- [x] resultsAvailable=false (correct — seats to be seeded after tonight's results)
- [x] Verified DONE by CEO via curl

### CIV-110: Pillar 5 — Public statements: what MPs say vs how they vote
- [x] Completed by Steve at 2026-03-17T10:50Z
- [x] ETL compute-pillar5-scores.ts, API endpoint /parliament/tweede-kamer/pillar/5 LIVE
- [x] All 15 parties scored across 12 MARPOR topics (50PLUS 70.3%, etc.)
- [x] All 5 pillars now operational

### CIV-109: Pillar 4 — Party family, think tank & lobby affiliation networks
- [x] Completed by Steve at 2026-03-17T08:51Z
- [x] ETL compute-pillar4-scores.ts, API endpoint /parliament/tweede-kamer/pillar/4 LIVE
- [x] 15 parties scored with influence network alignment across 12 MARPOR topics
- [x] Verified: BBB 93.2%, data returning correctly

### CIV-112: Vrije stemmer deep analysis — rebel MP profiles + party cohesion scores
- [x] Completed by Steve at 2026-03-17T07:34Z
- [x] 6 endpoints deployed: /members/rebels, /members/:id/deviations, /parliament/:slug/members/rebels, /parliament/:slug/parties/:id/rebels, /parliament/:slug/parties/:id/cohesion
- [x] Verified LIVE: /members/rebels returns 50 rebel MPs with Martin Bosma (PVV) top rebel
- [x] Verified DONE in Paperclip

### CIV-108: CivicStat Inzichten — editorial findings layer
- [x] Backend: 9 insight types, 95 findings, all /insights endpoints live (Steve, 2026-03-17)
- [x] Frontend: /nl/inzichten card grid + detail pages with OG images + shareable URLs (Steve, 2026-03-17)
- [x] Verified DONE in Paperclip

### CIV-107: Eerste Kamer — ETL ingest + MCS scoring
- [x] Completed by Steve — verified LIVE at 2026-03-17T04:00Z
- [x] ETL pipeline: 19 parties, 75 members, 162 motions, 173 votes ingested
- [x] Scorecards computed: 11 parties scored (BBB 58, SP 82, Volt 81, D66 68, VVD 49)
- [x] Verified: GET /parliament/eerste-kamer/election-overview returning 11 parties with MCS

### CIV-106: Automated data freshness — Dagster daily sync + weekly scorecard recompute
- [x] Completed by Steve at 2026-03-17T02:01Z
- [x] Dagster schedules configured: daily TK sync, weekly scorecard recompute
- [x] Verified in Paperclip as DONE

### CIV-105: TK2025 — Ingest party programs + full promise→match→score pipeline
- [x] Completed by Steve at 2026-03-17T01:24Z
- [x] Full pipeline: program ingest → promise extraction → semantic matching → scorecard compute
- [x] 15 parties scored, national scorecards updated

### CIV-87: Pillar 3 — EU Directive alignment scoring
- [x] ETL compute-pillar3-scores.ts, Dagster jobs, API endpoint live (Steve, 2026-03-17T00:08Z)
- [x] 23 parties scored across 12 MARPOR topics — PvdA 79.5%, SP 77.5%, PVV 50.2%
- [x] Verified: GET /parliament/tweede-kamer/pillar/3 returning data

### CIV-86: Pillar 2 — Coalition Accord ingestion and alignment scoring
- [x] ETL compute-pillar2-scores.ts, Dagster jobs (ingest + compute + full pipeline), API endpoints live (Steve, 2026-03-16T22:04Z)
- [x] 54 pillar scores: Schoof coalition PVV 63.4%, NSC 60.4%, BBB 59.8%, VVD 58.5% across 12 MARPOR topics
- [x] Verified: GET /parliament/tweede-kamer/pillar/2 + /party/:slug both returning data

### CIV-83: Dagster pipeline orchestration on Mac Studio
- [x] Dagster installed, civicstat_pipelines package created, schedules configured (Steve, 2026-03-16T21:50Z)

### CIV-84: NLP processing stack on Mac Studio
- [x] All 6 NLP components verified: Tika, FastText (nl 98.5%), OPUS-MT (NL→EN), sentence-transformers (768-dim), SpaCy nl_core_news_lg, DeBERTa NLI (Steve, 2026-03-16T21:57Z)

### CIV-85: Pillar score tables and pipeline metadata
- [x] Prisma migration completed — pipeline_documents, pillar_scores, influence_affiliations, topic_classifications tables created (Steve, 2026-03-16T15:33Z)

### CIV-104: Phase 2 infra sequencing
- [x] Execution order communicated: CIV-85 → CIV-82 → CIV-83 → CIV-84 (Dan, 2026-03-16)
- [x] 8 directive comments posted on CIV-85, all task descriptions updated

### CIV-103: Kobe directive — drop election framing, full speed on platform roadmap
- [x] TASKS.md restructured: election sprint closed, Phase 2 infra is now active sprint (Dan, 2026-03-16)
- [x] CIV-67 (Peilingwijzer) cancelled per Kobe directive
- [x] Election deadline tracking removed from all logs

### CIV-102: Under Development Banner
- [x] Amber banner deployed to civicstat.nl (Steve, 2026-03-16T13:49Z)

### CIV-101: Ungate Phase 2 infra issues
- [x] Removed "START DATE: March 19" from CIV-82, CIV-83, CIV-84, CIV-85 (Dan, 2026-03-16)
- [x] Steve notified — execution order: CIV-85 first, then CIV-82, then CIV-83, then CIV-84

### CIV-81: Deploy Weaviate document intelligence layer
- [x] `civicstat-weaviate` on Fly.io AMS, Weaviate 1.28.4, 10GB persistent volume (Steve, 2026-03-16T12:28Z)

### Pre-Election Sprint (completed)
- [x] CIV-74: VoteBar empty state (Steve, 2026-03-16)
- [x] CIV-57: Share/embed cards (Steve, 2026-03-13)
- [x] CIV-79: UX polish batch — CIV-71/72/73 (Steve, 2026-03-12)
- [x] CIV-68: civicstat.nl 401 fix (Kobe, 2026-03-12)
- [x] CIV-69/70: Rotterdam/Utrecht city pages + viewport meta (Steve, 2026-03-11)
- [x] CIV-94: Kobe handover (Dan, 2026-03-15)
- [x] CIV-80: Feedback widget + OpenAPI spec (Steve, 2026-03-12)

### Sprint 9 — Rotterdam + Utrecht ETL + Election Page
- [x] CIV-43/44: Rotterdam 1,991 motions + Utrecht 220 motions ETL complete
- [x] CIV-45/49: Municipal promises seeded (Rotterdam 252, Utrecht 264)
- [x] CIV-46: Semantic matching complete for both cities
- [x] CIV-61/64: Scorecards computed and deployed — Rotterdam 15 parties, Utrecht 16 parties
- [x] CIV-62: Utrecht MCS=0 fix
- [x] CIV-65: Municipal election-overview endpoints LIVE
- [x] CIV-66: Kabinet-Jetten Belofte-O-Meter LIVE
- [x] CIV-76: Utrecht data quality fix

### Earlier Sprints (1-8)
- [x] All P0-P2 tasks completed
- [x] Amsterdam + Den Haag NotuBiz ingest
- [x] Municipal semantic matching
- [x] Coalition dynamics (Schoof + Jetten)
- [x] pgvector embeddings
- [x] Data freshness pipeline
- [x] Municipal scorecards

---

_Last updated: 2026-03-28T13:17Z by CEO (Dan) — CIV-170 DONE. Sprint clean. Steve idle. API GREEN._
