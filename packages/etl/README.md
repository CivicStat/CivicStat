# CIVICSTAT ETL

Data ingest scripts voor Tweede Kamer Open Data.

## 🚀 Quick Start

```bash
# In monorepo root
cd packages/etl

# Quick test (minimal data)
npm run ingest quick

# Full ingest pipeline (limited)
npm run ingest all
```

## 📦 Commands

### Individual Ingest

```bash
# Fracties (Partijen)
npm run ingest fracties

# Kamerleden (MPs + Fractie assignments)
npm run ingest kamerleden

# Moties (met limit)
npm run ingest moties 50

# Stemmingen + individuele stemmen
npm run ingest stemmingen 10
```

### Full Pipeline

```bash
# Quick test (10 moties, 5 stemmingen)
npm run ingest quick

# Standard (100 moties, 50 stemmingen)
npm run ingest all
```

## 🗂 Data Flow

1. **Fracties** → `parties` table
2. **Personen + FractieZetelPersoon** → `mps` table
3. **Besluiten** (Moties) → `motions` table
4. **Stemmingen + Stemmen** → `votes` + `vote_records` tables

All raw data saved to `raw_ingest` table for audit trail.

## 🔄 Incremental Sync (TODO)

SyncFeed API voor incremental updates:
```bash
npm run ingest sync
```

## 📊 Database Schema

See `packages/db/prisma/schema.prisma`

Key models:
- `Party` (Fractie)
- `Mp` (Kamerlid)
- `Motion` (Motie)
- `Vote` + `VoteRecord` (Stemming)
- `RawIngest` (Audit trail)

## 🔗 Tweede Kamer API

Base URL: `https://gegevensmagazijn.tweedekamer.nl/OData/v4/2.0/`

Entities used:
- `Fractie` (Parties)
- `Persoon` (MPs)
- `FractieZetelPersoon` (MP-Party assignments)
- `Besluit` (Motions)
- `Stemming` (Votes)
- `Stem` (Individual vote records)

## ⚠️ Notes

- Data vanaf 2008 (Parlis)
- Personen betrouwbaar vanaf 2012 (Sesam)
- Verslagen vanaf 2013 (Vlos)
- Always filters out `Verwijderd eq true` (deleted entities)
