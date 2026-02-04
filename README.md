# Neutrale Transparantie-Platform

Productieklare webapplicatie voor Nederland die Tweede Kamer-moties, stemgedrag en programmapassages feitelijk ontsluit, met auditability en bronvermelding.

## Werkpakketten (MVP)
- Publieke site (moties, profielen, consensus-statistiek)
- Read-only API
- ETL ingest (moties + stemmingen)
- Matching (keyword + semantische placeholder)
- Portaal skeleton (auth + roles)
- Transparantiepagina's + algorithm versioning

## Monorepo
- `apps/web` (Next.js)
- `apps/api` (NestJS)
- `packages/db` (Prisma schema + migrations)
- `packages/shared` (types/utils)
- `packages/etl` (ingest scripts)
- `docs` (architecture, governance, policies)
