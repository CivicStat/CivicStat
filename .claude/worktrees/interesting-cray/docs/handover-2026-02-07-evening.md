# CivicStat — Session Wrap-Up & Next Steps
**Date:** 7 February 2026 (evening)
**Commit:** `064e71b` (pushed to main)
**Status:** ✅ All systems operational, promise pipeline MVP complete

---

## What Got Done Today (Sessions 7+)

### ✅ Promise Pipeline MVP
- **VVD TK2023**: 15 promises extracted, seeded, matched → 70 promise-motion matches
- **GL-PvdA TK2023**: 15 promises extracted, seeded, matched → 220 promise-motion matches
- **Total**: 30 promises, 290 promise-motion matches (keyword-overlap-v1)
- Keyword matcher: `packages/etl/src/matching/promise-motion-matcher.ts`
- Seeds: `packages/etl/src/seeds/vvd-promises-tk2023.ts` + `glpvda-promises-tk2023.ts`

### ✅ Sponsor Data Complete
- 18,172 motion sponsors ingested from ZaakActor (Indiener + Medeindiener)
- Enables Initiative Alignment Score (IAS) — who proposes vs. who goes along

### ✅ Frontend Consolidated
- Merged `civicstat-web/` → `apps/web/` (canonical monorepo location)
- All pages live: landing, moties, motie detail, kamerleden, kamerlid detail, partijen, partij detail
- Search functionality working
- PostCSS ESM fix applied

### ✅ Full Data Ingest
- 12,485 motions | 12,444 votes (84.5% linked) | 14,078 vote records
- 30 election programs | 3,456 passages | 22,203 TF-IDF matches

### ✅ Git Clean
- All work committed and pushed (`064e71b`)
- `.gitignore` updated for `.turbo/` and `dist/`

---

## What's NOT Done Yet

### 🔴 Critical Path (blocks the Belofte → Stemgedrag feature)
1. **`/promises` API endpoint** — NestJS module started (`apps/api/src/promises/promises.service.ts` exists but incomplete). Needs controller, module, registration in `app.module.ts`, deploy to Fly.io.
2. **`/beloften` frontend page** — Design exists in `civicstat-promises.jsx`, not yet built in `apps/web/`

### 🟡 Next Priority
3. **PVV promise extraction** (coalition party — tests consistency scoring)
4. **Manual match quality review** — upgrade best keyword matches to EXPLICIT_MATCH
5. **Prediction engine** — `VotePrediction` + `PartyPrediction` schema, calculation engine
6. **Party scorecard** — MCS per theme (design in `civicstat-trust.jsx`)

### 🟢 Later
7. LLM-assisted extraction for remaining 12 parties
8. Semantic matching upgrade (pgvector embeddings)
9. Methodology/transparency page
10. Dark mode toggle

---

## Recommended Next Session Plan

### Option A: Complete the API → Frontend Pipeline (2-3 hrs)
```
1. Build /promises API endpoint (NestJS module, 1 hr)
   - GET /promises?party=VVD&year=2023&theme=DEFENSIE
   - Returns promises with matches, motion details, party vote direction
2. Deploy to Fly.io
3. Build /beloften page (reference: civicstat-promises.jsx, 2 hrs)
   - Theme-grouped promise cards
   - Linked motions with match type badges
   - Party vote direction indicators
4. Deploy to Vercel
→ Result: CivicStat's USP feature is live
```

### Option B: Deepen the Analytical Pipeline (2-3 hrs)
```
1. Extract PVV promises (15, TK2023)
2. Run matcher for PVV
3. Build prediction calculation engine (predict-vote.ts)
4. Run first predictions → first belofte-kloof numbers
5. Build /motions/:id/prediction endpoint
→ Result: Can show "predicted vs actual" dual bars on motion pages
```

### Option C: Scale Promise Extraction (1-2 hrs)
```
1. Use VVD + GL-PvdA as few-shot examples for LLM extraction
2. Extract promises for remaining coalition parties (PVV, NSC, BBB)
3. Run matchers for all
→ Result: All coalition parties have promise data
```

**My recommendation:** Option A first — it gets the core feature live and visible. Then Option B to add analytical depth.

---

## Quick Reference

```bash
# Start local dev
cd "/Users/koenbekkering/Documents/New project"
cd apps/api && npm run start:dev     # API on :4000
cd apps/web && npm run dev           # Frontend on :3000

# ETL commands
cd packages/etl
npx tsx src/index.ts seed-promises-vvd
npx tsx src/index.ts seed-promises-glpvda
npx tsx src/index.ts match-promises VVD 2023
npx tsx src/index.ts match-promises GL-PvdA 2023

# Deploy
cd apps/api && fly deploy --app civicstat-api
cd apps/web && npx vercel --prod

# Live URLs
https://civicstat-web.vercel.app
https://civicstat-api.fly.dev/health
```

---

## Current DB Snapshot

| Table | Count |
|-------|-------|
| motions | 12,485 |
| votes | 12,444 (84.5% linked) |
| vote_records | 14,078 |
| motion_sponsors | 18,172 |
| programs | 30 |
| program_passages | 3,456 |
| program_passage_matches | 22,203 |
| promises | 30 (15 VVD + 15 GL-PvdA) |
| promise_motion_matches | 290 |
