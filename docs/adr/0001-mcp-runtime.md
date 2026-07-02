# ADR 0001 — MCP runtime: real Upstash Box + in-box stdio→HTTP bridge

- **Status:** Accepted
- **Date:** 2026-06-16
- **Context epic:** Épopée 1 (`docs/PROMPT-LANCEMENT.md`) — rendre le runtime MCP réel.
- **Decision owner:** plateforme TwinMCP

## Contexte

La fonctionnalité cœur de TwinMCP — chaque utilisateur provisionne un serveur MCP
auquel un client LLM standard se connecte via le protocole MCP — n'était pas
fonctionnelle de bout en bout :

- `@upstash/box` n'était ni installé ni déclaré ; sans `UPSTASH_BOX_API_KEY`,
  `getBoxClient()` retombait **silencieusement** sur `StubBoxClient`
  (`https://<id>.stub.box.local`, `exec → "[stubbed]"`, `ping → true`).
- Le chemin « réel » (`UpstashBoxClient`) était écrit contre une **API devinée**
  (`Box.create`, `box.exec.command`, `box.delete`, `run.exit_code`) qui aurait
  jeté à l'exécution.
- Les MCP du catalogue sont des serveurs **stdio** (`mcp-server-filesystem`,
  `mcp-server-github`, …) lancés en arrière-plan, **sans aucun pont stdio→HTTP** :
  rien ne permettait à un client distant de les joindre.

## Faits vérifiés sur le SDK `@upstash/box@0.5.1`

Source : `node_modules/@upstash/box/dist/{client,types}.d.ts` (lus, pas devinés).

- **Runtimes** réels : `node | python | golang | ruby | rust` (aucune variante
  `-alpine`). Notre box tourne toujours en `node` ; les MCP sont des process
  enfants. Le mapping `McpRuntime` (DB) → `Runtime` (SDK) est fait dans le client.
- **Tailles** : `small` (2 vCPU / 4 GB), `medium` (4 / 8), `large` (8 / 16) —
  alignées sur `boxSizes`.
- **Création** : `Box.create(config?: BoxConfig)` — `{ name, runtime, size,
  keepAlive, initCommand, env, networkPolicy, … }`. On crée en **`keepAlive: true`**
  (le serveur doit rester joignable) et on attend `getStatus()` ∈ `{idle,running}`.
- **Exécution** : `box.exec.command(cmd) → Run` avec `.result: string`,
  `.exitCode: number|null`, `.status: "running"|"completed"|"failed"|"cancelled"|"detached"`.
  (L'ancien code lisait `run.exit_code` — faux.)
- **URL publique par port (LE maillon manquant)** :
  `box.getPublicURL(port, { bearerToken: true }) → { url, port, token }`,
  `box.listPublicURLs()`, `box.deletePublicURL(port)`. L'URL exposée est
  **protégée par un bearer token** que seul le control plane détient.
- **Fichiers** : `box.files.write({ path, content })` — on écrit les scripts de
  lancement sans souffrir du quoting shell.
- **Cycle de vie** : `box.pause()/resume()`, `setInitCommand()` (rejoué au resume,
  pour redémarrer les ponts), `Box.delete({ boxIds })`.
- **Réseau** : sortant en `allow-all` par défaut (np/npx joignables) ; les IP
  privées sont toujours bloquées. Aucune restriction d'entrée sur les URLs
  publiques exposées.

## Décision

**Option A — Upstash Box réel**, avec un **pont stdio→HTTP dans la Box**, une
**URL publique par MCP installé**.

1. Installer `@upstash/box` (déclaré dans `apps/backend/package.json`).
2. Réécrire `UpstashBoxClient` contre l'API réelle ci-dessus + l'étendre
   (`writeFile`, `exposePort`, `unexposePort`, `setInitCommand`).
3. Pour chaque MCP installé (sauf `twinmcp-docs`, servi par le control plane) :
   - `installCmd` via `exec` (échec → propagé) ;
   - un **pont `supergateway`** enveloppe le stdio du MCP et l'expose en
     **Streamable HTTP** (`--outputTransport streamableHttp --streamableHttpPath /mcp`)
     sur un **port déterministe** (`bridge_port`, à partir de 8080), lancé en
     arrière-plan via un script écrit dans la box ;
   - `getPublicURL(port, { bearerToken: true })` → on **chiffre** le token
     (AES-256-GCM, même mécanisme que les configs) et on stocke
     `endpoint_url` + `bridge_port` + token chiffré **par `user_servers`**
     (migration `0005`) ;
   - **healthcheck MCP réel** : un `initialize` qui répond (pas un `ping → true`).
4. Le serveur passe `running` **uniquement** quand la box est prête **et** que
   tous les MCP non-docs activés ont répondu à `initialize`. Tout échec
   d'install/lancement/healthcheck → `status = "error"` (jamais avalé).
5. Le **proxy** `/api/mcp/<serverSlug>/<mcpSlug>` authentifie l'utilisateur
   (clé `ctx7sk_`), résout la ligne `user_servers`, déchiffre le token de la box
   et **forwarde** vers `endpoint_url` avec `Authorization: Bearer <boxToken>`.
   (Le token de la box n'est jamais exposé au client.)
6. **Garde-fou anti-stub** : en `NODE_ENV=production` sans `UPSTASH_BOX_API_KEY`,
   `getBoxClient()` **jette** ; `check-env` exige la clé.
7. **Durabilité** : `keepAlive: true` + `setInitCommand` relancent les ponts au
   resume ; `start`/`restart` ré-enqueue `provision-server` qui réinstalle tous
   les MCP activés.

## Modèle d'URL

**Une URL par MCP** : `{origin}/api/mcp/<serverSlug>/<mcpSlug>` (proxy control
plane, auth `ctx7sk_`). Pas d'agrégateur multi-MCP en v1 (cf. Épopée 2.3). Un
client connecté voit **les outils de ce MCP** via `tools/list`.

## Alternatives écartées

- **Option B — runtimes sur le VPS** (`host_type='external_url'`) : viable et
  moins chère, mais ré-implémente l'isolation/cycle de vie/quotas que Box fournit
  déjà ; gardée en repli si le coût Box devient bloquant (l'enum `external_url`
  reste en base).
- **Transport par `exec` (sans port public)** : un `exec` par requête JSON-RPC —
  lent, pas de SSE, fragile. Écarté puisque `getPublicURL` existe réellement.

## Conséquences / à vérifier en conditions réelles

- Nécessite un `UPSTASH_BOX_API_KEY` réel pour la **vérification end-to-end**
  (le smoke test `initialize`+`tools/list`+`tools/call` de la DoD). Le code
  typecheck et est logiquement complet, mais ces 4 points se valident sur un
  compte Box réel :
  - les **flags exacts de `supergateway`** (centralisés dans `mcp-bridge.ts`,
    triviaux à ajuster) ;
  - le **comportement de `Box.create`** (prêt immédiat vs polling — on poll
    `getStatus`) ;
  - la **latence de `getPublicURL`** et le délai de disponibilité du pont ;
  - le **nombre d'URLs publiques** autorisées par box (v1 : quelques MCP/box).
- Coût : compute Box facturé au CPU-heure tant que la box est `keepAlive`.
  La réconciliation des box mortes/orphelines est traitée en Épopée 8.

## Vérification en conditions réelles (2026-06-27)

Prouvé de bout en bout contre une vraie Box (`apps/backend/scripts/probe-box.ts`,
diagnostic toolchain `probe-tools.ts`). Résultats et corrections appliquées :

- ✅ `createBox → supergateway → getPublicURL → MCP initialize` fonctionne.
  `getPublicURL(port,{bearerToken:true})` renvoie une vraie URL
  `https://<box>-<port>.preview.box.upstash.com` + token — **le risque n°1
  (exposition de port) est levé**.
- **keep-alive = plan Upstash PAYANT** (moyen de paiement requis). La prod utilise
  `keepAlive:true` (le pont doit rester joignable) → prérequis business.
  `createBox` a un param `keepAlive` (défaut true ; le probe free-tier met false).
- Box **non-root** (`boxuser`), home writable `/workspace/home` ; `/workspace`
  racine **non-inscriptible**. → scripts/PID/init dans `/workspace/home`.
- `npm install -g` **échoue** (non-root) → MCP lancés via **`npx -y <pkg>@ver`**
  (installCmd = no-op). Le launcher exporte `PATH=$HOME/.local/bin:$PATH`.
- Toolchain box : node 25, npm/npx, **python3 3.11**, curl/wget ; **pas** de
  pip/uv/pipx/**docker**/go préinstallés. **`uv` se bootstrappe** via le curl
  installer → les **MCP Python tournent via `uvx`** (le `fetch` officiel est
  prouvé). Conséquence catalogue : Node (npx) + Python (uvx) OK ; **github
  (Go/Docker) impossible** sans docker dans la box.
- Healthcheck par défaut porté à ~90s (le 1er `npx`/`uvx` télécharge à froid).
