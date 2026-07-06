# ADR 0003 — Resume-on-demand runtime (no paid Upstash plan)

- **Status:** Accepted
- **Date:** 2026-06-27
- **Supersedes:** the keep-alive assumption in ADR 0001.

## Context

ADR 0001 provisioned each user's box with `keepAlive: true` so the MCP bridge
stays reachable. Verified against a real box, `keepAlive: true` **requires a paid
Upstash plan** (`BoxError: Keep-alive boxes require a paid plan`). To launch
without a paid plan — and to pay only for active usage rather than idle compute —
we use **non-keep-alive boxes + resume-on-demand**.

## Probed lifecycle facts (real box, `scripts/probe-resume.ts`)

- Non-keep-alive boxes **pause when idle**; `box.resume()` wakes them in **~0.4s**.
- On pause the box **releases its processes** (the supergateway bridge dies) **and
  its port exposure** (the public URL stops routing).
- **`initCommand` is NOT available** for non-keep-alive boxes — so there is no
  auto-restart on resume; the control plane must restart bridges itself.
- Re-calling `getPublicURL(port)` after resume returns the **same deterministic
  URL** (`<box>-<port>.preview.box.upstash.com`), so stored `endpoint_url` stays
  valid; the bearer token is refreshed defensively (it may rotate).

## Decision

- `provisionServer` creates boxes with **`keepAlive: false`**; it no longer calls
  `setInitCommand` (would throw). It still writes the `/workspace/home/init-mcps.sh`
  restart script that resume uses.
- New `resumeServer(serverId)` (lib/provisioning): `resume()` → wait ready →
  re-run the init script (relaunch all bridges) → re-`exposePort` each enabled MCP
  → re-persist its endpoint/token → mark the server `running`.
- The **proxy** forwards optimistically; on a connection error or gateway 5xx
  (box paused) it calls `resumeServer`, reloads the endpoint/token, and **retries
  for ~30s** while the bridge warms. If still down it returns 503
  "Server is waking up — retry in a few seconds."

## Consequences

- **No paid plan required.** Idle boxes cost nothing; you pay only for active
  compute.
- **Cold-start on the first request after an idle pause** (resume + bridge
  npx/uvx warm-up, tens of seconds). Steady-state (warm box) requests are direct
  relays with no overhead. The proxy holds the first request up to ~30s; a strict
  MCP client may need to retry once.
- Background box-health reconciliation (Épopée 8) still applies; a paused box is
  not "dead" — it just needs resume, which the proxy handles.
- To switch back to always-warm (Option A) later: set `keepAlive: true` in
  `createBox` (needs the paid plan); the resume path then rarely fires.
