# CivicStat — Handover 9 February 2026 (Session 2)

**Previous handover:** `handover-2026-02-09-v2.md`
**Session focus:** P0 verification + P2.1-2.2 scorecard diagnostics

---

## P0 Status — ALL RESOLVED (except DNS)

| Task | Status | Evidence |
|------|--------|----------|
| **P0.1** Promise detail routing | ✅ **Fixed** | API `get()` already has promiseCode fallback (UUID check → findFirst by promiseCode). Live test: `curl civicstat-api.fly.dev/promises/BBB-2023-012` returns data. Frontend `/beloften/BBB-2023-012` renders correctly. |
| **P0.2** Party scorecards | ✅ **Already deployed** | API `GET /parties/:id/scorecard` and `GET /parties/scorecards` both work. Frontend `app/partijen/[id]/page.tsx` renders full "Belofteconsistentie" section. Party listing `app/partijen/page.tsx` shows MCS mini-bars. |
| **P0.3** civicstat.nl DNS | ❌ **Still broken** | Resolves to GoDaddy parking page (76.223.105.230). Needs manual GoDaddy config: A record → 76.76.21.21, or CNAME → cname.vercel-dns.com. Then add domain in Vercel project settings. |
| **P0.4** apps/web/ cleanup | ✅ **Done** | Directory no longer exists. |

---

## P2.1-2.2 Scorecard — Diagnosis Complete

### What's Already Working
- **API scoring service**: `apps/api/src/parties/parties-scorecard.service.ts` — full implementation with per-promise scoring, theme breakdown, and status classification
- **API controller**: `apps/api/src/parties/parties.controller.ts` — `GET /parties/scorecards` (all) and `GET /parties/:id/scorecard` (individual)
- **Frontend detail page**: `civicstat-web/app/partijen/[id]/page.tsx` — renders big MCS score, consistency bar, theme grid, individual promise list with status badges, and methodology disclosure
- **Frontend listing page**: `civicstat-web/app/partijen/page.tsx` — fetches `getAllScorecards()`, shows MCS % and mini consistency bar per party card

### Current Live Scores
```
SP           MCS=97  consistent=14  mixed=1   inconsistent=0   scored=15
GL-PvdA      MCS=97  consistent=14  mixed=1   inconsistent=0   scored=15
PvdD         MCS=93  consistent=14  mixed=0   inconsistent=1   scored=15
PVV          MCS=71  consistent=9   mixed=2   inconsistent=3   scored=14
BBB          MCS=70  consistent=9   mixed=3   inconsistent=3   scored=15
D66          MCS=67  consistent=8   mixed=4   inconsistent=3   scored=15
CU           MCS=61  consistent=7   mixed=3   inconsistent=4   scored=14
CDA          MCS=53  consistent=5   mixed=6   inconsistent=4   scored=15
VVD          MCS=33  consistent=2   mixed=6   inconsistent=7   scored=15
NSC          MCS=0   consistent=0   mixed=0   inconsistent=0   scored=0  ← BROKEN
```

### Three Issues Found (with Root Causes)

#### Issue 1: NSC Missing from Parties Table (CRITICAL)
**Root cause**: NSC (Nieuw Sociaal Contract, 20 seats, coalition party) does not exist in the `parties` database table. Running `curl civicstat-api.fly.dev/parties` returns 16 parties — no NSC.

The scorecard endpoint finds 15 NSC promises (via the `programs` table) but scores 0 because:
- No `vote_records` have `party_id_snapshot` matching NSC
- The raw vote data fallback (`rawData.Stemming[].ActorNaam`) can't match because the party ID is unknown

**Fix path**:
1. Check TK OData: `curl "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Fractie?$filter=contains(NaamNL,'Sociaal')"`
2. If found → run `npx tsx src/index.ts fracties` to ingest
3. If not → manually insert via Prisma
4. Then run `npx tsx src/index.ts match-promises NSC 2023`
5. Must also check that vote records get the correct `party_id_snapshot` for NSC MPs

#### Issue 2: VVD Score Suspiciously Low (33%)
**Root cause**: Match quality, not scoring formula. Opposition motions about the same topics (migration, housing, climate) get keyword-matched to VVD promises. VVD votes AGAINST these opposition-framed motions → registers as "inconsistent".

Example: VVD-2023-008 "Woningbouw versnellen met nationaal Bouwakkoord" has **1 aligned vs 14 opposed** — because 14 opposition housing motions were keyword-matched and VVD voted against all of them.

**Fix**: Add confidence weighting — multiply each vote by `match.confidence` (0-1) and skip matches below 0.3. This downweights weak keyword matches.

#### Issue 3: Abbreviation Lookup Returns 500
`GET /parties/VVD/scorecard` → 500 Internal Server Error
`GET /parties/22b3074b-04fc-457a-beb3-a9b6dc96dd0c/scorecard` → 200 OK

The `findParty()` method finds the party by abbreviation correctly, but the subsequent scoring query likely fails. Not blocking — frontend uses UUIDs. But should be fixed for API consistency.

---

## Claude Code Prompt File

A ready-to-execute prompt has been written to:
```
/Users/koenbekkering/Documents/New project/PROMPT-P2-scorecard-improvements.md
```

Contains step-by-step instructions for:
1. Fix NSC party data (ETL or manual insert)
2. Add confidence weighting to scoring algorithm
3. Debug abbreviation lookup 500 error
4. Redeploy API

---

## Updated Priority List

### 🔴 Still To Do
| # | Task | Effort | Notes |
|---|------|--------|-------|
| 0.3 | **Fix civicstat.nl DNS** | 15 min | Manual: GoDaddy → Vercel |
| 2.1 | **Fix NSC party data** | 1-2 hrs | ETL + vote linking |
| 2.1b | **Add confidence weighting** | 1 hr | Edit `parties-scorecard.service.ts` |
| 2.1c | **Fix abbreviation lookup** | 30 min | Debug 500 error |

### 🟡 Next After Scorecards
| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1.1 | Manual match quality review | 2 hrs | Review keyword matches |
| 2.3 | VotePrediction schema migration | 1 hr | From `promise-prediction-pipeline.md` |
| 2.4 | Build prediction engine | 3-4 hrs | `predict-vote.ts` |
| 2.5 | Dual vote bar on motion detail | 2 hrs | Predicted vs actual |
| 3.1 | Transparency page (`/transparantie`) | 3-4 hrs | Pipeline viz, methodology |
| 3.3 | Debounced auto-search | 30 min | UX improvement |

### 🟢 Later
| # | Task | Effort |
|---|------|--------|
| 4.1 | Semantic matching (pgvector) | 3-4 hrs |
| 4.2 | Consensus analysis (`/verbinding`) | 3-4 hrs |
| 4.3 | Incremental sync | 2-3 hrs |
| 4.4 | Scheduled ETL cron | 1-2 hrs |
| 4.5 | TK2025 promise extraction | 4-6 hrs |

---

## Key File Locations

| File | Purpose |
|------|---------|
| `apps/api/src/parties/parties-scorecard.service.ts` | **Scoring logic** — confidence weighting goes here |
| `apps/api/src/parties/parties.controller.ts` | API endpoints |
| `apps/api/src/promises/promises.service.ts` | Promise detail API (already has promiseCode fallback) |
| `civicstat-web/app/partijen/[id]/page.tsx` | Party detail with scorecard UI (complete) |
| `civicstat-web/app/partijen/page.tsx` | Party listing with MCS mini-bars (complete) |
| `civicstat-web/app/beloften/[id]/page.tsx` | Promise detail page (working) |
| `packages/etl/src/index.ts` | ETL entry point |
| `packages/db/prisma/schema.prisma` | Database schema |
| `PROMPT-P2-scorecard-improvements.md` | Claude Code prompt for scorecard fixes |

---

## Architecture (unchanged)

| Layer | Tech | URL | Source |
|-------|------|-----|--------|
| **Web** | Next.js 14 | civicstat-web.vercel.app | `civicstat-web/` (separate git repo) |
| **API** | NestJS | civicstat-api.fly.dev | `apps/api/` (monorepo) |
| **DB** | PostgreSQL + Prisma | Supabase (EU) | `packages/db/` (monorepo) |
| **ETL** | TypeScript | Run manually | `packages/etl/` (monorepo) |

**Monorepo**: `/Users/koenbekkering/Documents/New project/`
**Frontend** (separate repo): `/Users/koenbekkering/Documents/New project/civicstat-web/`
