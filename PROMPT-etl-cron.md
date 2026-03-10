# PROMPT 2: Set up automated hourly ETL ingest via GitHub Actions

## Context
You're working on the CivicStat project — a Dutch parliamentary transparency platform.

**Monorepo:** `/Users/koenbekkering/Documents/New project/`  
**ETL package:** `packages/etl/` — run via `npx tsx src/index.ts <command>`  
**Database:** Supabase PostgreSQL (connection string in `.env` as `DATABASE_URL`)  
**API:** NestJS on Fly.io at `civicstat-api.fly.dev` (in `apps/api/`)  
**CI:** `.github/workflows/ci.yml` already exists

## Problem
Latest motions in the DB are from Feb 5, and there are no recent votes. The ETL is currently manual-only (`npx tsx src/index.ts all`). We need automated hourly ingest of new motions and votes from the Tweede Kamer OData API.

## Step 1: Add an `incremental` command to the ETL

File: `packages/etl/src/index.ts`

Add a new `sync` (or `incremental`) case that does a lightweight delta ingest:
```typescript
case 'sync':
case 'incremental':
  console.log('🔄 Running incremental sync...\n');
  // Only ingest motions and votes — fracties/kamerleden change rarely
  await ingestMoties();    // Already uses upsert, safe to re-run
  await ingestStemmingen(); // Already skips existing tkIds
  await ingestSponsors();   // Links sponsors to new motions
  console.log('\n✅ Incremental sync complete!');
  break;
```

The existing `ingestMoties()` uses upserts (safe to re-run) and `ingestStemmingen()` already pre-loads existing tkIds and skips them. So this is already incremental-safe — no changes needed to those functions.

## Step 2: Create the GitHub Actions workflow

File: `.github/workflows/etl-sync.yml`

```yaml
name: ETL Sync

on:
  schedule:
    # Run every hour at :15 past (avoid top-of-hour congestion)
    - cron: '15 * * * *'
  workflow_dispatch: # Allow manual trigger from GitHub UI

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

## Step 3: Add the DATABASE_URL secret to GitHub

This can't be done via CLI — tell the user:

> **Manual step required:** Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret. Add `DATABASE_URL` with your Supabase connection string (the same value as in your local `.env` file).

To find the current value:
```bash
grep DATABASE_URL /Users/koenbekkering/Documents/New\ project/.env
```

## Step 4: Test locally first

Before pushing, verify the sync command works:
```bash
cd /Users/koenbekkering/Documents/New\ project/packages/etl
npx tsx src/index.ts sync
```

This should:
- Fetch motions from 2023+ and upsert them (most will already exist, new ones since Feb 5 will be added)
- Fetch vote decisions and skip existing ones, only processing new votes
- Link sponsors to any new motions

## Step 5: Commit and push

```bash
cd /Users/koenbekkering/Documents/New\ project
git add packages/etl/src/index.ts .github/workflows/etl-sync.yml
git commit -m "feat: add incremental sync command + hourly GitHub Actions cron"
git push
```

## Step 6: Verify the workflow

After pushing, go to GitHub → Actions tab → "ETL Sync" workflow → click "Run workflow" to trigger a manual test run. Check the logs to confirm motions and votes are being ingested.

## Important notes
- The TK OData API is free and public, no API key needed
- The existing ingest functions handle pagination automatically (the `fetchAll` method follows `@odata.nextLink`)
- Moties filter: `Soort eq 'Motie' and GestartOp ge 2023-01-01` — covers current parliament
- Stemmingen filter: `StemmingsSoort ne null and GewijzigdOp ge 2023-01-01` — only actual votes
- Both functions use upsert/skip patterns so they're idempotent and safe to run repeatedly
