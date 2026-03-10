# Claude Code Prompt: P2.1 — Scorecard Scoring Quality Improvements

## Current State (already working)
- ✅ API endpoints: `GET /parties/:id/scorecard` and `GET /parties/scorecards`
- ✅ Frontend party detail pages render "Belofteconsistentie" section with score, theme breakdown, and promise list
- ✅ Frontend party listing shows MCS mini-bar per party
- ✅ Scoring formula: `(consistent + mixed*0.5) / scored * 100`

## What Needs Fixing

### Issue 1: NSC Missing from Parties Table (CRITICAL)
NSC (Nieuw Sociaal Contract, 20 seats, coalition party) is NOT in the parties table. The scorecards endpoint returns NSC with `scoredPromises: 0` because vote data can't be linked.

**Steps:**
```bash
# 1. Check if NSC exists in TK OData
curl "https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/Fractie?\$filter=contains(NaamNL,'Sociaal')&\$select=Id,NaamNL,NaamEN,Afkorting,DatumActief,DatumInactief"

# 2. If found, run the parties ETL
cd packages/etl
npx tsx src/index.ts fracties

# 3. After NSC is in DB, generate promise matches
npx tsx src/index.ts match-promises NSC 2023

# 4. Redeploy API
cd ../../apps/api && fly deploy
```

If the ETL doesn't handle NSC, manually insert:
```typescript
// packages/etl/src/scripts/add-nsc.ts
import { prisma } from "@ntp/db";

async function main() {
  const nsc = await prisma.party.upsert({
    where: { tkId: "NSC-MANUAL" },
    update: {},
    create: {
      tkId: "NSC-MANUAL",
      name: "Nieuw Sociaal Contract",
      abbreviation: "NSC",
      colorNeutral: "#005CA9",
      startDate: new Date("2023-08-19"),
    },
  });
  console.log("NSC party:", nsc.id);

  // Link the existing NSC program to this party
  const program = await prisma.program.findFirst({
    where: { title: { contains: "Sociaal Contract", mode: "insensitive" } },
  });
  if (program) {
    await prisma.program.update({
      where: { id: program.id },
      data: { partyId: nsc.id },
    });
    console.log("Linked program:", program.id);
  }
}
main();
```

**But there's a bigger issue**: even if NSC is in the parties table, the vote records (`vote_records` table) need `party_id_snapshot` set to NSC's party ID for their MPs. And the raw vote data (`votes.raw_data -> Stemming`) needs to use "NSC" as `ActorNaam`. Check what name the TK API uses for NSC in Stemming data.

### Issue 2: Confidence Weighting for Match Quality
Currently all motion matches count equally. A match with 30% confidence counts the same as 85%. This inflates scores because many weak keyword matches exist.

**File**: `apps/api/src/parties/parties-scorecard.service.ts`

**Change the scoring loop** (around line 75-95):

```typescript
// BEFORE: unweighted
if (votedFor === expectedFor) aligned++;
else opposed++;

// AFTER: weighted by confidence + minimum threshold
for (const match of promise.motionMatches) {
  if (match.confidence < 0.3) continue; // Skip weak matches

  const weight = match.confidence;
  const vote = match.motion.votes?.[0];
  if (!vote) { noData++; continue; }

  // ... existing party vote direction check ...

  if (votedFor === expectedFor) {
    aligned++;
    weightedAligned += weight;
  } else {
    opposed++;
    weightedOpposed += weight;
  }
}

// Use weighted ratio for status
const totalWeighted = weightedAligned + weightedOpposed;
if (totalWeighted > 0) {
  const ratio = weightedAligned / totalWeighted;
  if (ratio >= 0.6) status = "consistent";
  else if (ratio <= 0.4) status = "inconsistent";
  else status = "mixed";
}
```

Also add `weightedAligned` and `weightedOpposed` to the `PromiseScore` interface for transparency.

### Issue 3: Abbreviation Lookup 500 Error
`GET /parties/VVD/scorecard` returns 500. Works with UUID. 

**Debug**: Run `fly logs --app civicstat-api` to see the actual error. The `findParty` method finds the party successfully, but the scoring query likely fails because of how `party.id` flows into the vote records query.

**Quick fix**: In `parties.controller.ts`, wrap the scorecard call:
```typescript
@Get(":id/scorecard")
async scorecard(@Param("id") id: string) {
  try {
    return await this.scorecardService.getScorecard(id);
  } catch (err) {
    if (err instanceof NotFoundException) throw err;
    throw new InternalServerErrorException("Scorecard computation failed");
  }
}
```

But actually find the root cause first — it's likely a Prisma query error in the scoring when `party.id` doesn't match any records in the `vote_records.party_id_snapshot` column.

---

## Execution Order

1. Fix NSC party data (ETL + match generation)
2. Add confidence weighting to scoring
3. Debug and fix abbreviation lookup error
4. Redeploy API: `cd apps/api && fly deploy`
5. Verify: `curl https://civicstat-api.fly.dev/parties/scorecards` should show improved scores

## Key Files
```
apps/api/src/parties/parties-scorecard.service.ts  ← Main scoring logic
apps/api/src/parties/parties.controller.ts         ← Endpoints
packages/etl/src/index.ts                          ← ETL commands
packages/db/prisma/schema.prisma                   ← Data model
```

## Deploy
```bash
# API deploy
cd apps/api && fly deploy

# Frontend auto-deploys (no changes needed — frontend already renders scorecards)
```
