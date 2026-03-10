# Architecture: Municipal Expansion
**Date:** 2026-02-17
**Status:** Draft — pending approval

---

## 1. Database Schema Changes

### New Models

#### `Parliament` — Root scope entity
```prisma
model Parliament {
  id           String   @id @default(uuid()) @db.Uuid
  slug         String   @unique                        // "tweede-kamer", "amsterdam", "rotterdam", etc.
  name         String                                  // "Tweede Kamer der Staten-Generaal"
  shortName    String   @map("short_name")             // "Tweede Kamer", "Gemeenteraad Amsterdam"
  level        ParliamentLevel                         // NATIONAL, MUNICIPAL, PROVINCIAL, EUROPEAN
  country      String   @default("NL")
  municipality String?                                 // null for TK, "amsterdam" for gemeenteraad
  seats        Int                                     // 150 for TK, 45 for Amsterdam, etc.
  active       Boolean  @default(true)

  // Data source config (JSON — varies by parliament)
  dataSourceConfig Json? @map("data_source_config")
  // e.g. { "type": "notubiz", "orgId": 281 }
  // e.g. { "type": "ibabs", "sitename": "rotterdamraad" }
  // e.g. { "type": "tweedekamer", "apiBaseUrl": "https://gegevensmagazijn.tweedekamer.nl" }

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  parties    Party[]
  mps        Mp[]
  motions    Motion[]
  votes      Vote[]
  programs   Program[]
  scorecards PrecomputedScorecard[]

  @@map("parliaments")
}

enum ParliamentLevel {
  NATIONAL
  MUNICIPAL
  PROVINCIAL
  EUROPEAN
}
```

#### `PartyBranch` — Municipal party ↔ national party mapping
```prisma
model PartyBranch {
  id              String  @id @default(uuid()) @db.Uuid
  partyId         String  @map("party_id") @db.Uuid         // Local party record
  nationalPartyId String? @map("national_party_id") @db.Uuid // TK party record (if applicable)
  parliamentId    String  @map("parliament_id") @db.Uuid
  localName       String? @map("local_name")                 // e.g. "GroenLinks Amsterdam"
  seats           Int?
  isCoalition     Boolean @default(false) @map("is_coalition")

  party         Party      @relation("LocalParty", fields: [partyId], references: [id])
  nationalParty Party?     @relation("NationalParty", fields: [nationalPartyId], references: [id])
  parliament    Parliament @relation(fields: [parliamentId], references: [id])

  createdAt DateTime @default(now()) @map("created_at")

  @@unique([partyId, parliamentId])
  @@map("party_branches")
}
```

### Modified Models (add `parliamentId` FK)

All existing core models get a `parliamentId` column:

```prisma
model Party {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid  // nullable for migration
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])

  localBranches    PartyBranch[] @relation("LocalParty")
  nationalBranches PartyBranch[] @relation("NationalParty")
}

model Mp {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])

  // For municipal: source IDs from NotuBiz/iBabs
  externalId   String? @map("external_id")  // e.g. NotuBiz person ID "151332"
  sourceSystem String? @map("source_system") // "notubiz" | "ibabs" | "tweedekamer"
}

model Motion {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])

  externalId   String? @map("external_id")  // NotuBiz module_item ID or iBabs EntryId
  sourceSystem String? @map("source_system")
}

model Vote {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])
}

model Program {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])
}

model PrecomputedScorecard {
  // ... existing fields ...
  parliamentId String? @map("parliament_id") @db.Uuid
  parliament   Parliament? @relation(fields: [parliamentId], references: [id])
}
```

### Migration Strategy

1. **Create `parliaments` table** with TK record pre-seeded
2. **Add nullable `parliament_id`** to all 6 tables (parties, mps, motions, votes, programs, scorecards)
3. **Backfill** all existing rows with TK parliament UUID
4. **Make non-nullable** (second migration after backfill succeeds)
5. **Add unique constraints** that include `parliament_id` where needed:
   - `Mp.tkId` → `@@unique([tkId, parliamentId])` (or keep tkId unique globally)
   - `Motion.tkId` → same pattern
6. **Create `party_branches` table**

### Unique ID Strategy

Municipal data uses different external ID systems:
- **NotuBiz:** numeric IDs (person: `151332`, motie item: `1129763`)
- **iBabs:** GUIDs or string IDs for entries, numeric for users
- **TK:** existing `tkId` strings

We add `externalId` + `sourceSystem` columns instead of overloading `tkId`. The `tkId` field stays for TK-specific backward compatibility.

---

## 2. API Scope-Prefixed Endpoints

### URL Pattern
```
/parliament/:slug/motions      → motions for a specific parliament
/parliament/:slug/parties      → parties in that parliament
/parliament/:slug/members      → MPs/raadsleden
/parliament/:slug/promises     → election promises
/parliament/:slug/scorecards   → consistency scores
/parliament/:slug/insights     → auto-discovered patterns
/parliament/:slug/predictions  → vote predictions
```

### Examples
```
GET /parliament/tweede-kamer/motions?limit=20
GET /parliament/amsterdam/motions?limit=20
GET /parliament/rotterdam/parties
GET /parliament/den-haag/members
```

### Backward Compatibility

Keep existing un-prefixed endpoints working (they default to `tweede-kamer`):
```
GET /motions → internally routes to /parliament/tweede-kamer/motions
```

### NestJS Implementation

```typescript
// apps/api/src/parliament/parliament.module.ts
@Module({
  controllers: [ParliamentController],
  providers: [ParliamentService],
})
export class ParliamentModule {}

// All existing modules get a parliament scope guard
// apps/api/src/motions/motions.controller.ts
@Controller('parliament/:slug/motions')
export class MotionsController {
  @Get()
  async list(@Param('slug') slug: string, @Query() query: MotionsQuery) {
    const parliament = await this.parliamentService.findBySlug(slug);
    return this.motionsService.findAll({ ...query, parliamentId: parliament.id });
  }
}

// Legacy route (backward compat)
@Controller('motions')
export class LegacyMotionsController {
  @Get()
  async list(@Query() query: MotionsQuery) {
    return this.motionsService.findAll({ ...query, parliamentSlug: 'tweede-kamer' });
  }
}
```

### Parliament List Endpoint
```
GET /parliaments → [{ slug, name, shortName, level, seats, active }]
```

---

## 3. Frontend Route Structure

### URL Pattern
```
/nl/tweede-kamer/...          → existing TK pages (unchanged URLs)
/nl/gemeenten/:city/...       → municipal pages

/nl/gemeenten/amsterdam/
/nl/gemeenten/amsterdam/moties
/nl/gemeenten/amsterdam/moties/:id
/nl/gemeenten/amsterdam/partijen
/nl/gemeenten/amsterdam/partijen/:id
/nl/gemeenten/amsterdam/raadsleden
/nl/gemeenten/amsterdam/raadsleden/:id
/nl/gemeenten/amsterdam/beloften
/nl/gemeenten/amsterdam/inzichten
/nl/gemeenten/amsterdam/verbinding
```

### Next.js App Router Structure
```
app/
  nl/
    tweede-kamer/           → existing (no changes needed)
      page.tsx              → TK dashboard
      moties/
      partijen/
      kamerleden/
      ...
    gemeenten/
      page.tsx              → city picker / municipal landing
      [city]/
        page.tsx            → city dashboard (reuses TK dashboard logic)
        layout.tsx          → city-scoped layout with breadcrumb + nav
        moties/
          page.tsx          → reuses MotiesPage with parliamentSlug
          [id]/
            page.tsx
        partijen/
          page.tsx
          [id]/
            page.tsx
        raadsleden/
          page.tsx
          [id]/
            page.tsx
        beloften/
          page.tsx
        inzichten/
          page.tsx
        verbinding/
          page.tsx
```

### Shared Components Strategy

Most page components can be made parliament-agnostic by passing `parliamentSlug`:

```typescript
// lib/api.ts — all fetch functions accept optional parliament scope
export async function getMotions(params?: MotionsQuery & { parliamentSlug?: string }) {
  const base = params?.parliamentSlug
    ? `/parliament/${params.parliamentSlug}/motions`
    : '/motions'; // defaults to TK
  // ...
}
```

### Terminology Mapping

| TK term | Municipal term | Component prop |
|---------|---------------|----------------|
| Kamerlid | Raadslid | `memberLabel` |
| Kamerleden | Raadsleden | `membersLabel` |
| Tweede Kamer | Gemeenteraad | `parliamentLabel` |
| Kamerstuk | Raadsstuk | `documentLabel` |
| Fractie | Fractie | (same) |

This is passed via React context or a `useParliament()` hook:

```typescript
const ParliamentContext = createContext<{
  slug: string;
  level: 'NATIONAL' | 'MUNICIPAL';
  labels: { member: string; members: string; parliament: string; document: string };
}>();
```

### Nav Updates

The top nav gets a scope selector (dropdown or tabs):
- "Tweede Kamer" (current)
- "Amsterdam" / "Rotterdam" / "Den Haag" / "Utrecht"

On municipal pages, the breadcrumb shows:
`CivicStat > Gemeenten > Amsterdam > Moties`

---

## 4. ETL Architecture

### NotuBiz Client (`packages/etl/src/municipal/notubiz-client.ts`)

```typescript
class NotubizClient {
  constructor(private orgId: number) {}

  async getEvents(dateFrom: Date, dateTo: Date): Promise<NotubizEvent[]>
  async getMeeting(meetingId: number): Promise<NotubizMeeting>
  async getModuleItem(itemId: number): Promise<NotubizModuleItem>
  async getDocument(docId: number): Promise<Buffer>  // PDF
}
```

### iBabs Client (`packages/etl/src/municipal/ibabs-client.ts`)

```typescript
class IBabsClient {
  constructor(private sitename: string) {}

  async getMeetingsByDateRange(start: Date, end: Date): Promise<IBabsMeeting[]>
  async getListEntryVotes(entryId: string): Promise<IBabsVote[]>
  async getUsers(): Promise<IBabsUser[]>
  async getListReportDataSet(listId: string, reportId: string, page: number): Promise<IBabsReport>
}
```

### Vote Text Parser (NotuBiz-specific)

For Amsterdam and Den Haag, vote results come as free text. Parser patterns:

```
"aangenomen"                                    → result: AANGENOMEN, method: UNANIMOUS
"verworpen"                                     → result: VERWORPEN, method: UNANIMOUS
"met de stemmen tegen van X, Y en Z aangenomen" → result: AANGENOMEN, against: [X, Y, Z]
"met algemene stemmen aangenomen"               → result: AANGENOMEN, method: UNANIMOUS
"zonder hoofdelijke stemming aangenomen"        → result: AANGENOMEN, method: NO_VOTE
```

From "Toelichting" field: extract party names, determine their vote direction, infer remaining parties voted the other way.

### Sync Flow

```
notubiz-sync.ts:
  1. Fetch events (meetings) for date range
  2. For each "Raad" meeting:
     a. Fetch full meeting with agenda items
     b. For each agenda item with module_items:
        - Fetch module item (motie/amendement)
        - Parse vote text from Toelichting/Uitslag
        - Upsert Motion, Vote (aggregate), create/update party-level VoteRecords
  3. Sync raadsleden from person references
  4. Sync fracties from party references
```

---

## 5. Timeline Alignment

| Week | Task | Dependencies |
|------|------|-------------|
| Feb 17-21 | Schema migration + Parliament table + backfill TK | None |
| Feb 17-21 | NotuBiz client + Amsterdam motie sync | Schema |
| Feb 24-28 | Vote text parser + Den Haag sync | NotuBiz client |
| Feb 24-28 | API scope-prefixed endpoints | Schema |
| Mar 3-7 | Frontend municipal routes + city dashboard | API endpoints |
| Mar 3-7 | Promise extraction (top parties per city) | Motie sync |
| Mar 10-14 | Semantic matching for municipal promises | Promises |
| Mar 10-14 | iBabs client (if access granted) for RTD/UTR | IP whitelisting |

---

## 6. Open Questions

1. **Individual vote records for NotuBiz cities:** Only party-level votes are available (parsed from text). Do we create VoteRecords per-party (one per fractie) or skip individual VoteRecords entirely?
   - **Recommendation:** Create one VoteRecord per raadslid, inferring vote from party. Mark `inferred: true` in metadata. This keeps the data model consistent.

2. **Program sourcing for 2026 elections:** Where do we get verkiezingsprogramma PDFs for municipal parties?
   - **Recommendation:** Manual collection from party websites. Most parties publish PDFs months before elections. Start scraping in February 2026.

3. **Historical depth:** How far back do we go for moties?
   - **Recommendation:** Current term (2022-2026) for MVP. Amsterdam has 10,000+ motie-matching documents since 2022.

4. **Unique identifiers:** NotuBiz uses numeric IDs. Should `tkId` be repurposed or use new `externalId` field?
   - **Recommendation:** New `externalId` + `sourceSystem` fields. Keep `tkId` as TK-specific.
