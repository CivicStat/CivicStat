# PROMPT: CivicStat — Three fixes (run in order)

## Context
CivicStat project — Dutch parliamentary transparency platform.

**Monorepo:** `/Users/koenbekkering/Documents/New project/`  
**Frontend (separate git repo):** `/Users/koenbekkering/Documents/New project/civicstat-web/`  
**API:** `apps/api/` → deployed at `civicstat-api.fly.dev` via `fly deploy --remote-only`  
**ETL:** `packages/etl/` → run via `cd packages/etl && npx tsx src/index.ts <command>`  
**DB:** Supabase PostgreSQL, connection string in `.env` as `DATABASE_URL`

---

## Fix 1: PartyBadge in Verbinding pair rows

**File:** `civicstat-web/app/verbinding/page.tsx`

Line 3 imports `PartyBadge` from `../../components/PartyBadge` but it's never used. The `PairRow` component renders party names as plain text.

**Do this:** In the `PairRow` function, replace the two plain `<span>` elements showing `pair.a` and `pair.b` with `<PartyBadge abbreviation={pair.a} size="sm" />` and `<PartyBadge abbreviation={pair.b} size="sm" />`. The PartyBadge renders a colored dot + abbreviation text in a badge style. Adjust the container `w-[120px]` to `w-[180px]` or `min-w-fit` since badges are wider than plain text.

Commit: `fix: wire PartyBadge into verbinding pair rows`

---

## Fix 2: Pre-computed consensus API endpoint (Verbinding performance)

### Problem
The `/verbinding` page fetches votes from the API in batches of 100 (capped at 1,000), but there are 6,601+ votes in the DB. Only ~15% of data is used → inaccurate matrix + slow page load.

### Step A: Add `GET /votes/consensus` to the NestJS API

**Files to edit:**  
- `apps/api/src/votes/votes.service.ts` — add a `getConsensus()` method  
- `apps/api/src/votes/votes.controller.ts` — add the route

The service method should:
1. Query ALL votes from DB: `prisma.vote.findMany({ select: { rawData: true } })`
2. For each vote, extract `rawData.Stemming` array (each item has `ActorNaam` and `Soort`)
3. Normalize party names: `"GroenLinks-PvdA" → "GL-PvdA"`, `"ChristenUnie" → "CU"`
4. Track these parties: `["PVV", "GL-PvdA", "VVD", "NSC", "BBB", "D66", "CDA", "SP", "PvdD", "CU", "SGP", "DENK", "Volt", "JA21", "FVD"]`
5. For every pair of parties that both voted on the same motion, count agreements (both "Voor" or both "Tegen") vs total
6. Skip pairs with < 10 common votes
7. Return:
```json
{
  "parties": ["PVV", "GL-PvdA", ...],
  "matrix": { "PVV": { "GL-PvdA": 42, "VVD": 78, ... }, ... },
  "topAgreement": [{ "a": "VVD", "b": "PVV", "pct": 85, "agree": 5100, "total": 6000 }],
  "topDisagreement": [{ "a": "PVV", "b": "GL-PvdA", "pct": 28, "agree": 1680, "total": 6000 }],
  "totalVotes": 6601
}
```

The controller should add cache headers: `@Header('Cache-Control', 'public, max-age=3600')`.

**Reference implementation** — the exact computation logic is already in `civicstat-web/app/verbinding/page.tsx` in the `computeConsensusMatrix` function and the `ABBR_MAP` / `TRACKED_PARTIES` constants. Port this to the API service.

### Step B: Simplify the Verbinding page

**File:** `civicstat-web/app/verbinding/page.tsx`

Replace the entire `fetchVotesForConsensus()` function + `computeConsensusMatrix()` function + all their types with a single fetch:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://civicstat-api.fly.dev";

async function fetchConsensus() {
  const res = await fetch(`${API_URL}/votes/consensus`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error("Failed to fetch consensus data");
  return res.json();
}
```

Update `VerbindingPage` to use this. The returned data already has `parties`, `matrix`, `topAgreement`, `topDisagreement`, `totalVotes` — pass them straight to the UI components.

### Step C: Deploy

```bash
# Deploy API first
cd /Users/koenbekkering/Documents/New\ project/apps/api
fly deploy --remote-only

# Verify endpoint works
curl -s "https://civicstat-api.fly.dev/votes/consensus" | head -c 500

# Commit and push frontend
cd /Users/koenbekkering/Documents/New\ project/civicstat-web
git add -A
git commit -m "feat: use pre-computed consensus endpoint for /verbinding performance"
git push
```

---

## Fix 3: Automated hourly ETL sync + catch up missing data

### Problem
Latest motions are from Feb 5, latest votes from Feb 4. The Tweede Kamer has been voting since then but ETL is manual-only.

### Step A: Add `sync` command to ETL

**File:** `packages/etl/src/index.ts`

Add a new case in the switch statement:
```typescript
case 'sync':
case 'incremental':
  console.log('🔄 Running incremental sync...\n');
  await ingestMoties();      // upserts — safe to re-run
  await ingestStemmingen();  // skips existing tkIds
  await ingestSponsors();    // links sponsors to new motions
  console.log('\n✅ Incremental sync complete!');
  break;
```

The existing functions already handle idempotency:
- `ingestMoties()` uses Prisma upsert on `tkId`
- `ingestStemmingen()` pre-loads existing tkIds and skips them
- Both fetch from 2023 onwards (covers current parliament)

### Step B: Run it now to catch up

```bash
cd /Users/koenbekkering/Documents/New\ project/packages/etl
npx tsx src/index.ts sync
```

This will fetch all motions and votes from the TK API and ingest any new ones since Feb 5. Should take 2-5 minutes.

### Step C: Create GitHub Actions cron workflow

**File:** `.github/workflows/etl-sync.yml`

```yaml
name: ETL Sync

on:
  schedule:
    - cron: '15 * * * *'  # Every hour at :15
  workflow_dispatch:        # Manual trigger from GitHub UI

jobs:
  sync:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      
      - name: Enable corepack
        run: corepack enable
      
      - name: Install dependencies
        run: pnpm install --filter @ntp/etl --filter @ntp/db
      
      - name: Generate Prisma client
        run: cd packages/db && npx prisma generate
      
      - name: Run incremental sync
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: cd packages/etl && npx tsx src/index.ts sync
      
      - name: Summary
        if: always()
        run: echo "ETL sync completed at $(date -u)"
```

### Step D: Add GitHub secret (MANUAL — tell user)

Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret:
- **Name:** `DATABASE_URL`  
- **Value:** (your Supabase connection string from `.env`)

### Step E: Commit and push

```bash
cd /Users/koenbekkering/Documents/New\ project
git add packages/etl/src/index.ts .github/workflows/etl-sync.yml
git commit -m "feat: add incremental sync command + hourly GitHub Actions cron"
git push
```

### Step F: Test the workflow

Go to GitHub → Actions → "ETL Sync" → "Run workflow" button to trigger manually and verify logs.

---

## Execution order
1. Fix 2 first (API endpoint) — deploy API
2. Fix 1 + Fix 2 frontend changes together — commit + push civicstat-web
3. Fix 3 — run sync locally to catch up, then set up cron
4. Manual step: add DATABASE_URL to GitHub Secrets
