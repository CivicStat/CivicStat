# PROMPT 1: Fix PartyBadge import + Verbinding page performance

## Context
You're working on the CivicStat project — a Dutch parliamentary transparency platform.

**Monorepo:** `/Users/koenbekkering/Documents/New project/`  
**Frontend (separate repo):** `/Users/koenbekkering/Documents/New project/civicstat-web/`  
**API:** `apps/api/` deployed at `civicstat-api.fly.dev`

## Task 1: Remove unused PartyBadge import from Verbinding page

File: `civicstat-web/app/verbinding/page.tsx`

Line 3 imports `PartyBadge` but it's never used in the page. The `PairRow` component just renders party names as text. Either:
- Remove the unused import (clean option), OR
- Wire PartyBadge into the PairRow component so party names show with their colored dot (nicer option — do this)

To wire it in: in the `PairRow` function, replace the plain text party names with `<PartyBadge abbreviation={pair.a} />` and `<PartyBadge abbreviation={pair.b} />`. The PartyBadge component is at `civicstat-web/components/PartyBadge.tsx` and takes `abbreviation` as a required prop.

## Task 2: Build a server-side pre-computed consensus API endpoint

The `/verbinding` page currently fetches votes from the API in batches of 100 (capped at 1,000 total), but there are 6,601+ votes in the DB. This means only ~15% of data is used, making the consensus matrix inaccurate. Also fetching 1,000 records on page load is slow.

### Step A: Add a `/votes/consensus` endpoint to the NestJS API

File: `apps/api/src/votes/votes.controller.ts`  
File: `apps/api/src/votes/votes.service.ts`

Add a new endpoint `GET /votes/consensus` that:
1. Queries ALL votes from the database that have party-level vote data in their `rawData.Stemming` array
2. Computes pairwise party agreement percentages server-side
3. Returns a JSON response shaped like:
```json
{
  "parties": ["PVV", "GL-PvdA", "VVD", ...],
  "matrix": { "PVV": { "GL-PvdA": 42, "VVD": 78, ... }, ... },
  "topAgreement": [{ "a": "VVD", "b": "PVV", "pct": 85, "agree": 5100, "total": 6000 }, ...],
  "topDisagreement": [...],
  "totalVotes": 6601
}
```

The computation logic is already in `civicstat-web/app/verbinding/page.tsx` in the `computeConsensusMatrix` function — port it to the API service. The abbreviation normalization map should include:
```
"GroenLinks-PvdA" → "GL-PvdA"
"ChristenUnie" → "CU"
```

The tracked parties are: PVV, GL-PvdA, VVD, NSC, BBB, D66, CDA, SP, PvdD, CU, SGP, DENK, Volt, JA21, FVD

Cache this endpoint with `@Header('Cache-Control', 'public, max-age=3600')` since it's expensive and data doesn't change minute-to-minute.

The vote records are in the `vote` table with Prisma. Each vote has `rawData` (JSON) which contains a `Stemming` array with objects like `{ ActorNaam: "VVD", Soort: "Voor" }`.

### Step B: Update the Verbinding page to use the new endpoint

File: `civicstat-web/app/verbinding/page.tsx`

Replace the entire `fetchVotesForConsensus()` + `computeConsensusMatrix()` logic with a single fetch to `${API_URL}/votes/consensus`. This makes the page load instant and uses 100% of the vote data.

The page component becomes much simpler — just fetch the pre-computed data and pass it to the existing UI components.

### Step C: Redeploy the API

```bash
cd /Users/koenbekkering/Documents/New\ project
# Build and deploy API to Fly.io
cd apps/api
fly deploy --remote-only
```

### Step D: Commit and push frontend changes

```bash
cd /Users/koenbekkering/Documents/New\ project/civicstat-web
git add -A
git commit -m "feat: use pre-computed consensus endpoint, add PartyBadge to pair rows"
git push
```

### Verify
- `curl https://civicstat-api.fly.dev/votes/consensus | head -c 500` should return the consensus JSON
- Visit `https://civicstat-web.vercel.app/verbinding` to confirm the page loads fast with full data
