# Architectuur

## Overzicht
- Frontend: Next.js (App Router) in `apps/web`
- Backend: NestJS in `apps/api`
- Database: PostgreSQL + pgvector, schema in `packages/db`
- ETL/ingest: `packages/etl`
- Shared types: `packages/shared`

## Principes
- Traceerbaarheid: elke datapoint heeft bronvermelding
- Auditability: raw ingest wordt bewaard in `raw_ingest`
- Neutraliteit: geen ranking of politieke aanbevelingen

## Observability (MVP)
- Structured logging in API en ETL
- Audit logs voor mutaties op consultaties
