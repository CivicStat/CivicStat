# CLAUDE.md — CivicStat Agent Instructions

## Project Overview

**CivicStat** is a Dutch political transparency platform (civicstat.nl) that tracks whether parties do what they promise. It matches election promises to parliamentary voting behavior and computes consistency scores.

**Mission:** "CivicStat makes promises visible — so voters can see whether parties do what they promise."

## Monorepo Structure

```
civicstat/                    # pnpm monorepo (Node ≥20, pnpm 9.12)
├── apps/
│   ├── api/                  # NestJS 10 REST API (Fly.io, AMS region, port 4000)
│   └── web/                  # Next.js 14 frontend (git submodule, Vercel)
├── packages/
│   ├── db/                   # Prisma 5.19 schema + migrations (PostgreSQL on Supabase)
│   ├── etl/                  # ETL pipeline: ingest, match, score, seed
│   └── shared/               # Shared TypeScript types/enums
├── docs/                     # Architecture, governance, data sources
└── TASKS.md                  # Prioritized task backlog
```

## Key Commands

```bash
# Development
pnpm install                          # Install all dependencies
pnpm dev                              # Run all apps in dev mode
pnpm build                            # Build all packages (Turbo)
pnpm typecheck                        # TypeScript validation across monorepo

# API
cd apps/api && pnpm dev               # NestJS dev server on :4000
fly deploy --remote-only              # Deploy API to Fly.io

# Database
cd packages/db
pnpm prisma:generate                  # Generate Prisma client
pnpm prisma:migrate                   # Run migrations
npx prisma migrate dev --name <name>  # Create new migration

# ETL (from packages/etl)
pnpm dev -- sync                      # Incremental sync (moties + stemmingen + sponsors)
pnpm dev -- all                       # Full pipeline (2025+)
pnpm dev -- fracties                  # Ingest parties
pnpm dev -- kamerleden                # Ingest MPs
pnpm dev -- moties [limit]            # Ingest motions
pnpm dev -- stemmingen                # Ingest votes
pnpm dev -- sponsors                  # Ingest motion sponsors
pnpm dev -- semantic-match [--party X --resume]  # LLM semantic matching
pnpm dev -- incremental-match         # Match new motions to promises
pnpm dev -- compute-scorecards        # Pre-compute MCS scores
pnpm dev -- seed-promises-json [--party X --year Y]  # Seed promises from JSON
```

## Architecture

### Data Pipeline
```
TK OData API / NotuBiz / iBabs
    → ETL Ingest (parties, MPs, motions, votes, sponsors)
    → Promise Extraction (manual + LLM-assisted from PDFs)
    → Semantic Matching (keyword pre-filter → Claude evaluation)
    → Vote Prediction (promise-signal aggregation)
    → Scorecard Computation (MCS = weighted alignment ratio)
    → REST API (NestJS) → Frontend (Next.js)
```

### Core Algorithm: Motion Consistency Score (MCS)
For each promise with an expected vote direction:
1. Find motion matches (confidence ≥ 0.3)
2. Weight = matchTypeWeight × confidence × motionTypeWeight
   - Match types: EXPLICIT_MATCH (1.0), IMPLICIT_MATCH (0.5), CONTRADICTS (1.0)
   - Motion types: Wetsvoorstel (2.0), Amendement (1.5), Motie (1.0)
3. If ≥3 motions with votes: ratio = aligned / (aligned + opposed)
   - consistent (≥70%), inconsistent (≤30%), mixed (30-70%)
4. MCS = weighted average of all ratios × 100

### Multi-Parliament Support
- National: Tweede Kamer (slug: `tweede-kamer`)
- Municipal: Amsterdam, Den Haag (via NotuBiz API)
- Scoped endpoints: `/parliament/:slug/motions`, `/parliament/:slug/parties`, etc.
- PartyBranch model links local parties to national parties

### Coalition Tracking
- Kabinet-Schoof: PVV, VVD, NSC, BBB (2024-07-02 to 2025-10-29)
- Kabinet-Jetten: D66, VVD, CDA (2026-02-23 ongoing)
- Coalition Alignment Index (CAI), Vrije Stemmen MCS, Coalitieverwatering

## Database (Prisma)

Key models: Parliament, Party, PartyBranch, Mp, Motion, MotionSponsor, Vote, VoteRecord, Program, ProgramPassage, Promise, PromiseMotionMatch, MotionProgramMatch, VotePrediction, PartyPrediction, PrecomputedScorecard, PipelineRun, SyncState

Key enums: VoteValue (FOR/AGAINST/ABSTAIN/ABSENT), PromiseTheme (18 themes), PromiseSpecificity (CONCRETE/DIRECTIONAL/VAGUE), PromiseMatchType (EXPLICIT_MATCH/IMPLICIT_MATCH/CONTRADICTS), ProgramType (VERKIEZINGSPROGRAMMA/REGEERAKKOORD)

## API Modules (NestJS)

13 modules: Health, Motions, Votes, Parties (+ Scorecards), Members, Promises, Admin, Stats, Langfuse, Insights, Parliament, Coalitions, Campaign

Key endpoints:
- `GET /parties/scorecards` — All party MCS scores
- `GET /parties/:id/scorecard` — Detailed party scorecard
- `GET /parties/:id/regeerakkoord` — Coalition agreement scorecard
- `GET /parties/:id/koersvastheid` — Cross-year consistency
- `GET /motions/:id/prediction` — Vote prediction
- `GET /parliament/:slug/election-overview` — Campaign data

## Conventions

### Code Style
- TypeScript strict mode, ES2022 target
- NestJS module pattern: Module → Controller → Service
- Prisma for all DB access (no raw SQL except perf-critical vote classification)
- Dutch domain terms preserved in data (Motie, Amendement, Wetsvoorstel, Stemming, etc.)
- English for code identifiers and comments

### Data Integrity
- All ingests are idempotent (upsert on unique keys)
- Incremental mode: 7-day lookback for late-arriving data
- Pre-cache entities in memory for batch operations (avoid N+1)
- Batch processing (50-500 items) to avoid Prisma napi string conversion bugs

### ETL Environment Variables
- `DATABASE_URL` — PostgreSQL connection (required)
- `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` — LLM access
- `AI_MODEL_SEMANTIC_MATCH` — Override semantic matching model
- `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY` — Observability (optional)

### Design Principles
- Neutral framing — no opinions, rankings, or editorializing
- Transparency — all algorithms documented, audit trails
- Dutch-language content, English code
- Monochrome vote bars, party colors only in small badges
- No emoji in UI or code
