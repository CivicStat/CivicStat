# Blocked: Webhook Investigation (CIV-228 follow-up)

**Date:** 2026-03-28
**Investigator:** Steve (CTO Agent)
**Blocker type:** Requires human access to Vercel dashboard + GitHub webhook delivery logs

---

## What Happened

CIV-228: Commit `3ab8cae` ("fix: lowercase municipal moties status filter values") was pushed to `github.com/CivicStat/civicstat-web` at **02:10 UTC on 2026-03-28**. Vercel did **not** auto-deploy. The site ran stale code for ~18 hours until Femke detected it and Steve ran `vercel deploy --prod` at **20:28 UTC**.

---

## What I Found

### civicstat-web repository
- Remote: `https://github.com/CivicStat/civicstat-web.git`
- Vercel project: `civicstat-web` (ID: `prj_dNWTuSphm41ZIa3UpR9sGil9XRpZ`, org: `team_JFSPIaWakim19UczrZEOQzgu`)
- Vercel config: `civicstat-web/.vercel/project.json` — project is linked correctly locally

### Missing `.gitmodules`
The monorepo tracks `civicstat-web` as a gitlink (mode `160000`, commit `3ab8cae657ba8bc5f7019e18b734ec69decb9ed8`) but **no `.gitmodules` file exists**. This means `git submodule update` is broken in CI. This does not affect Vercel (which watches `civicstat-web` repo directly), but it does mean the monorepo CI (`ci.yml`) cannot resolve the submodule.

### Vercel auto-deploy mechanism
Vercel connects to GitHub via the **Vercel GitHub App**. On every push to the production branch (likely `main`) in `civicstat-web`, GitHub delivers a `push` webhook event to Vercel, which triggers a build. This is entirely in Vercel's infrastructure — no code in this repo controls it.

---

## Possible Root Causes (in order of likelihood)

1. **GitHub webhook delivery failure** — GitHub attempted to deliver the push event but got a non-2xx from Vercel's webhook receiver. Could be a transient network error, Vercel API timeout, or rate limit.

2. **Vercel GitHub App installation issue** — The GitHub App token may have expired or permissions may have been partially revoked (e.g., if org settings changed).

3. **Branch not configured** — Vercel may only be watching a specific branch (e.g., not `main`). Unlikely given prior deploys worked.

4. **Vercel deployment protection** — The project has Vercel's deployment protection enabled (we know civicstat.nl had HTTP 401 at some point). This setting can sometimes interfere with auto-deploys.

---

## What Needs to Be Checked (requires human / Vercel access)

1. **GitHub → CivicStat/civicstat-web → Settings → Webhooks → Vercel webhook → Recent Deliveries**
   Check if the push event at ~02:10 UTC was delivered. If it shows a failure (5xx, timeout), that's the root cause.

2. **Vercel Dashboard → civicstat-web → Settings → Git**
   Verify: production branch = `main`, auto-deploy is enabled, GitHub App is still installed.

3. **Vercel Dashboard → civicstat-web → Deployments**
   Look for any failed/queued deployment around 02:10 UTC on 2026-03-28.

4. **GitHub → Organization Settings → Installed GitHub Apps → Vercel**
   Confirm the Vercel app has read access to `civicstat-web`.

---

## Potential Fix (if root cause is webhook delivery failures)

If GitHub webhook deliveries to Vercel are unreliable, add a GitHub Actions step in `civicstat-web` that calls the Vercel Deploy Hook URL as a fallback:

```yaml
# .github/workflows/deploy.yml (in civicstat-web repo)
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Vercel deploy hook
        run: curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

This requires creating a Deploy Hook in Vercel Dashboard → civicstat-web → Settings → Git → Deploy Hooks, then storing the URL as `VERCEL_DEPLOY_HOOK_URL` in GitHub repo secrets.

---

## Separate Issue: Missing `.gitmodules`

The monorepo's `civicstat-web` gitlink has no corresponding `.gitmodules` entry. To fix:

```bash
# Run from monorepo root
git submodule add https://github.com/CivicStat/civicstat-web.git civicstat-web
```

This will recreate `.gitmodules` so that `git submodule update --init` works in CI. Currently `ci.yml` does not use the submodule, so this is low priority but should be done for correctness.
