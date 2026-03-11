# Blocked: P3.1.5 — Request iBabs IP Whitelisting for Rotterdam + Utrecht

## Status
BLOCKED — external action required (cannot be automated)

## Why This Task Is Blocked

This task requires manually contacting iBabs (a third-party municipal document API provider) to request IP whitelisting for the Fly.io production server. No code changes are needed at this stage — iBabs integration for Rotterdam and Utrecht is labelled "future" in TASKS.md.

## What Is Needed

1. **Fly.io outbound IP address(es)** — Fly.io uses shared anycast IPs by default; a dedicated IPv4 must be allocated for whitelisting:
   - Run: `fly ips allocate-v4 --shared` (or dedicated: `fly ips allocate-v4`)
   - Current API app: check with `fly ips list -a civicstat-api`

2. **iBabs contact** — Submit a whitelisting request to iBabs support:
   - Email: support@ibabs.eu (or via their customer portal)
   - Request: whitelist the Fly.io IP for Rotterdam (`rotterdam.ibabs.eu`) and Utrecht (`utrecht.ibabs.eu`) API endpoints
   - Reference: CivicStat municipal data integration (civicstat.nl)

3. **API credentials** — iBabs may require a service account or API key for Rotterdam/Utrecht municipalities. These must be obtained separately from each municipality's IT department or via iBabs directly.

## Prerequisites Before Coding

- [ ] Fly.io dedicated outbound IP allocated
- [ ] iBabs whitelisting confirmed for both municipalities
- [ ] iBabs API credentials obtained (Rotterdam + Utrecht)
- [ ] Store credentials as secrets: `fly secrets set IBABS_API_KEY_ROTTERDAM=... IBABS_API_KEY_UTRECHT=...`

## Related Tasks
- S8.3.1 — same requirement referenced in sprint backlog
- P3.1.x — broader municipal expansion sprint
- Existing iBabs integration: `packages/etl/src/ingest/` (check for existing NotuBiz/iBabs client)
