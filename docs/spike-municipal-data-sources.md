# Data Source Spike: Municipal Expansion
**Date:** 2026-02-17
**Target Cities:** Amsterdam, Rotterdam, Den Haag, Utrecht

---

## Executive Summary

We investigated three data layers for each city:
1. **Open Raadsinformatie (ORI)** — ElasticSearch API at `api.openraadsinformatie.nl/v1/elastic/`
2. **NotuBiz API** — REST API at `api.notubiz.nl` (used by amsterdam/denhaag raadsinformatie.nl)
3. **iBabs SOAP API** — WSDL at `mijnbabs.nl/iBabsWCFService/Public.svc` (used by rotterdam/utrecht)

**Key finding:** Amsterdam and Den Haag have excellent data via NotuBiz API (moties, vote results, submitters, parties). Rotterdam and Utrecht use iBabs which requires IP whitelisting — but their data also flows into ORI (documents only, no structured votes). A hybrid approach is needed.

---

## Per-City Assessment

### Amsterdam — Confidence: HIGH ✅

| Aspect | Status | Source |
|--------|--------|--------|
| Moties | ✅ Structured (title, date, type, PDF) | NotuBiz modules API |
| Vote results | ⚠️ Free-text only ("aangenomen"/"verworpen" + "met stemmen tegen van X, Y") | NotuBiz `Uitslag` + `Toelichting` fields |
| Individual votes | ❌ Not structured per-raadslid | — |
| Raadsleden | ✅ Indiener(s) with person IDs + party IDs | NotuBiz `reference_model: person/party` |
| Partijen/Fracties | ✅ Fractie field with party references | NotuBiz |
| Historical depth | ✅ 10,000+ docs, 2.6M+ total in ORI ES | ORI + NotuBiz |
| Machine-readable | ✅ JSON API, no auth needed | NotuBiz |
| Rate limits | Unknown (no documented limits) | NotuBiz |

**NotuBiz org_id:** `281`
**ORI ES index:** `ori_amsterdam_*` (main + 7 stadsdelen)
**Moties module:** ID 6 (`/modules/6/moties`)

**Key data structure (NotuBiz module item):**
- `Titel`: "Motie 582 van het lid Van Pijpen inzake..."
- `Datum indiening`: datetime
- `Type`: "Motie" | "Amendement"
- `Indiener(s)`: array of `{person_id, name}`
- `Fractie`: array of `{party_id, name}`
- `Uitslag`: "aangenomen" | "verworpen" | "ingetrokken" | etc.
- `Toelichting`: free-text with vote breakdown (e.g., "met de stemmen tegen van VVD, DENK, JA21")
- `Hoofddocument`: PDF with full motie text
- `Gekoppeld evenement`: linked agenda item

**Vote parsing challenge:** Vote results are in free text in the `Toelichting` field. Pattern: "met de stemmen tegen van [party1], [party2] en [party3] aangenomen". We can parse this with regex/NLP to extract per-party votes. Not per-raadslid though.

---

### Den Haag — Confidence: HIGH ✅

| Aspect | Status | Source |
|--------|--------|--------|
| Moties | ✅ Structured (RIS-nummer, title, type, PDF) | NotuBiz modules API |
| Vote results | ✅ Uitslag field ("aangenomen"/"verworpen") | NotuBiz |
| Individual votes | ❌ Not structured per-raadslid | — |
| Raadsleden | ✅ Indiener with person IDs | NotuBiz |
| Partijen/Fracties | ✅ "Betrokken partijen" with party references | NotuBiz |
| Historical depth | ✅ 557K docs in ORI ES | ORI + NotuBiz |
| Machine-readable | ✅ JSON API, no auth needed | NotuBiz |
| Rate limits | Unknown | NotuBiz |

**NotuBiz org_id:** `318`
**ORI ES index:** `ori_den_haag_*`

**Unique fields vs Amsterdam:**
- `RIS-nummer`: Den Haag's internal document ID system
- `Beleidsveld`: policy area (e.g., "Ruimtelijke ordening")
- `Portefeuillehouder`: responsible alderman
- `Verwachte datum afdoening`: expected completion date
- `Betrokken dienst`: involved department (e.g., "DSO")

**Same moties structure as Amsterdam** — Titel, Type, Uitslag, Indiener, Betrokken partijen, Hoofddocument, Gekoppeld evenement.

---

### Rotterdam — Confidence: MEDIUM ⚠️

| Aspect | Status | Source |
|--------|--------|--------|
| Moties | ✅ 205 moties in ORI ES (name, date, description) | ORI ElasticSearch |
| Vote results | ❌ Not in ORI; requires iBabs | iBabs (IP-restricted) |
| Individual votes | ❌ Available via iBabs `GetListEntryVotes` but IP-restricted | iBabs SOAP API |
| Raadsleden | ❌ Not in ORI; requires iBabs `GetUsers` | iBabs |
| Partijen/Fracties | ❌ Not in ORI; requires iBabs | iBabs |
| Historical depth | ✅ 498K docs in ORI ES | ORI |
| Machine-readable | ⚠️ ORI = yes; iBabs = yes but needs IP whitelisting | Hybrid |
| Rate limits | iBabs: 1 req/sec recommended | iBabs |

**iBabs sitename:** `rotterdamraad` (CONFIRMED via ORI config + WSDL test)
**NotuBiz org_id:** `726` (website uses NotuBiz frontend, but events API returns empty)
**ORI ES index:** `ori_rotterdam_*`

**iBabs provides (once whitelisted):**
- `GetMeetingsByDateRange` → meetings with date/type/items
- `GetListEntryVotes` → individual votes per agenda item: `{EntryId, GroupName, UserId, UserName, Vote}`
- `GetListReportDataSet` → paginated reports (moties, amendementen)
- `GetUsers` / `GetUsersInformation` → raadsleden profiles
- `VoteResult`, `VotesInFavour`, `VotesAgainst` on ListEntry items

**ORI data structure (from iBabs scraper):**
- `name`: motie title
- `classification`: "Moties"
- `description`: agenda context
- `start_date` / `end_date`: meeting date
- `attachment`: linked PDF document ID

**Blocker:** iBabs API returns "IPaddress has no access to site RotterdamRaad!" — must request access via iBabs/gemeente Rotterdam.

---

### Utrecht — Confidence: LOW ⚠️

| Aspect | Status | Source |
|--------|--------|--------|
| Moties | ⚠️ Referenced in raadsbrieven (392 docs mentioning "motie") but no structured motie records | ORI ES |
| Vote results | ❌ Not available via ORI or public API | — |
| Individual votes | ❌ Available via iBabs but IP-restricted | iBabs |
| Raadsleden | ❌ Not in ORI; requires iBabs | iBabs |
| Partijen/Fracties | ✅ 15 Party records in ORI | ORI |
| Historical depth | ✅ 665K docs in ORI ES | ORI |
| Machine-readable | ⚠️ ORI = docs only; iBabs = IP-restricted | Hybrid |
| Rate limits | iBabs: 1 req/sec | iBabs |

**iBabs sitename:** `Utrecht` (CONFIRMED via ORI config)
**NotuBiz:** Website runs NotuBiz frontend (org_id unknown, possibly legacy), but API access unclear
**ORI ES index:** `ori_utrecht_*`

**Special notes:**
- ORI config for Utrecht EXCLUDES "moties" and "amendementen" from reports! The data exists in iBabs but ORI doesn't scrape it.
- `Raadsbesluit` (179 records) is the closest classification to structured decisions, but contains council decisions broadly, not moties specifically.
- U-reka (ureka.utrecht.nl) is a separate search interface but no public API documented.
- "Informatievoorziening verkiezingsprogramma's 2026" (2 records in ORI) — election programs for 2026 are being processed!

**Blocker:** Same as Rotterdam — iBabs IP whitelisting required. Additionally, motie data is explicitly excluded from ORI scraping for Utrecht.

---

## Data Source Architecture Summary

```
                    ┌──────────────┐
                    │  CivicStat   │
                    │   ETL/API    │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
     ┌────────▼──────┐ ┌──▼──────┐ ┌───▼──────────┐
     │   NotuBiz     │ │  iBabs  │ │     ORI      │
     │   REST API    │ │  SOAP   │ │ ElasticSearch │
     │  (no auth)    │ │(IP-gated)│ │  (no auth)   │
     └───────┬───────┘ └────┬────┘ └──────┬────────┘
             │              │             │
    ┌────────┼────┐    ┌────┼────┐        │
    │        │    │    │    │    │        │
  AMS    DEN HAAG │  RTD   UTR  │    All 4 cities
  (281)   (318)   │ (rdam  (Utr │    (documents +
                  │  raad)  echt)│     text only)
                  │        │    │
              RTD frontend  UTR frontend
              (NotuBiz UI   (NotuBiz UI
               + iBabs data) + iBabs data)
```

---

## Recommended Strategy

### Phase 1: Amsterdam + Den Haag (NotuBiz — immediate)
- **No blockers.** NotuBiz API is public, no auth needed.
- Write `packages/etl/src/municipal/notubiz-client.ts`
- Scrape: events → agenda items → module items (moties) → parse vote text
- Extract: raadsleden, fracties from person/party references
- **Vote parsing:** Regex + party name matching on `Toelichting` field to get per-party votes
- **Coverage:** Per-party votes (not per-raadslid)

### Phase 2: Rotterdam + Utrecht (iBabs — needs access request)
- **Blocker:** Must request IP whitelisting from iBabs
  - Contact: iBabs support / gemeente griffie
  - Alternative: Request via VNG Open Raadsinformatie program
- Write `packages/etl/src/municipal/ibabs-client.ts` (SOAP via zeep-equivalent for Node.js or direct XML)
- **Coverage:** Full per-raadslid votes via `GetListEntryVotes`

### Phase 3: Fallback via ORI ElasticSearch
- All 4 cities have document data in ORI
- Use for: motie text extraction, historical context, PDF document access
- **Not suitable for:** structured vote data, individual votes

---

## Immediate Action Items

1. **Start building NotuBiz ETL** for Amsterdam + Den Haag (no blockers)
2. **Request iBabs API access** for Rotterdam (`rotterdamraad`) and Utrecht (`Utrecht`)
   - Contact email: via gemeente griffie or iBabs support
   - Provide: static IP address (Fly.io or GitHub Actions runner)
3. **Design vote text parser** for NotuBiz `Toelichting` field
   - Pattern: "met de stemmen tegen van [parties] aangenomen"
   - Map party names → party IDs
4. **Evaluate SOAP client for Node.js** — `soap` npm package or raw XML
5. **Schema design** can start now — we know the data shape

---

## API Endpoints Cheat Sheet

### NotuBiz (Amsterdam, Den Haag)
```
GET api.notubiz.nl/organisations?format=json
GET api.notubiz.nl/events?format=json&organisation_id={id}&version=1.10.8&date_from={dt}&date_to={dt}
GET api.notubiz.nl/events/meetings/{id}?format=json&version=1.10.8
GET api.notubiz.nl/modules/0/items/{id}?format=json&version=1.10.8
GET api.notubiz.nl/document/{id}/1  (PDF download)
```

### iBabs SOAP (Rotterdam, Utrecht — IP-restricted)
```
WSDL: https://www.mijnbabs.nl/iBabsWCFService/Public.svc?singleWsdl
Port: BasicHttpsBinding_IPublic

Operations:
- GetMeetingsByDateRange(Sitename, StartDate, EndDate, MetaDataOnly)
- GetListEntryVotes(Sitename, EntryId) → [{GroupName, UserId, UserName, Vote}]
- GetUsers(Sitename) → raadsleden list
- GetListReportDataSet(Sitename, ListId, ReportId, PageNr, RecordsPerPage)
- GetMeetingtypes(Sitename)
```

### ORI ElasticSearch (all cities — documents only)
```
POST api.openraadsinformatie.nl/v1/elastic/ori_{city}*/_search
  Content-Type: application/json
  Body: { "query": {...}, "size": N, "sort": [...] }

Indices: ori_amsterdam_*, ori_rotterdam_*, ori_den_haag_*, ori_utrecht_*
```
