# Serving the API on `api.twinmcp.fr` (isolated from the front-end)

The API can run on a **dedicated origin** — `https://api.twinmcp.fr` — separate
from the marketing/dashboard front-end, for isolation. Same codebase, same
container: a hostname-aware middleware decides what a request sees.

- On `api.twinmcp.fr`: **only the API** is served. Clean paths
  (`/v2/...`, `/mcp/...`, `/health`, `/openapi`) are mapped onto the existing
  `/api/*` routes; `/api/*` also works as-is; **any front-end path 404s**.
  Permissive CORS is attached (Bearer-token auth, no cookies).
- On `twinmcp.fr`: unchanged — the site, the dashboard, and `/api/*` keep
  working exactly as today (the dashboard calls its own API same-origin).

The whole thing is **inert until `NEXT_PUBLIC_API_URL` is set**. With it unset,
`isApiHost()` is always false, the middleware only runs the Supabase session
refresh as before, and the connect panel keeps showing same-origin
`…/api/mcp/…` URLs. Nothing changes until you activate it.

## What the code does

- `src/lib/api-host.ts` — `isApiHost(host)` (derived from `NEXT_PUBLIC_API_URL`)
  and the CORS headers.
- `src/middleware.ts` — branches on the host: API-only rewrite + CORS on the API
  origin, `updateSession` everywhere else.
- `src/lib/mcp/client-config.ts` — `proxyUrl()` emits `${NEXT_PUBLIC_API_URL}/mcp/<server>/<mcp>`
  when set (clean, no `/api`), else same-origin `…/api/mcp/…`.
- `Dockerfile` — `NEXT_PUBLIC_API_URL` is a build ARG (these vars are inlined
  into the client bundle **at build time**, so it must be set for the build, not
  just at runtime).

## Activation (all on your side — infra + a rebuild)

1. **DNS** — point `api.twinmcp.fr` at the same server as `twinmcp.fr`
   (A/AAAA to the same IP, or a CNAME to the same target).
2. **Dokploy / Traefik** — add the domain `api.twinmcp.fr` to the **same** app
   (the existing container, port 3000) and issue a Let's Encrypt certificate for
   it. No new service.
3. **Build arg** — set `NEXT_PUBLIC_API_URL=https://api.twinmcp.fr` as a **build
   argument** for the image (Dokploy → the app's Build Args), then **rebuild**.
   A runtime-only env var is not enough: `NEXT_PUBLIC_*` are baked in at build,
   so a plain restart won't pick it up.
4. Redeploy. Verify:
   - `https://api.twinmcp.fr/health` → the health JSON.
   - `https://api.twinmcp.fr/v2/...` and `https://api.twinmcp.fr/mcp/<s>/<m>` → API.
   - `https://api.twinmcp.fr/` or `/dashboard` → **404** (front-end not served).
   - the dashboard Connect panel now shows `https://api.twinmcp.fr/mcp/…` URLs.

## Rollback

Remove the `NEXT_PUBLIC_API_URL` build arg and rebuild — the API reverts to
same-origin `…/api/mcp/…` and the middleware stops host-branching. (The
`api.twinmcp.fr` domain/DNS can stay; without the env it simply serves the API
under `/api/*` like the main domain, or you can detach it.)

## Notes & possible follow-ups

- **Existing client configs keep working.** URLs already saved as
  `https://twinmcp.fr/api/mcp/…` still resolve on the main domain; only newly
  generated configs use the API origin.
- **Cookie-session endpoints stay on the main domain.** The API origin is for
  Bearer-token (`ctx7sk_`) access; endpoints that read the Supabase session
  cookie (dashboard-internal) are meant to be called same-origin from the site.
- **Webhooks / cron / agent** (`/api/webhooks/*`, `/api/cron/*`, `/api/agent/*`)
  remain reachable under `/api/*` on the API origin too. They carry their own
  auth (Stripe signature, `CRON_SECRET`, `ctx7sk_`). If you want the API origin
  to expose *only* the public surface, add a route allowlist in
  `handleApiHost()` — not done here to avoid changing current behavior.
- **The API subdomain serves no HTML**, so indexing risk is low; if you want to
  be explicit, add a `robots.txt` rule for the host later.
