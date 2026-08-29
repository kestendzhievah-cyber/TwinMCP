// Verify the catalog's MCP packages and surface the exact versions to pin.
//
//   node scripts/verify-mcp-versions.mjs           # resolve latest versions (fast)
//   node scripts/verify-mcp-versions.mjs --smoke   # + boot the no-config servers and send `initialize`
//
// It parses seed-mcps.ts, pulls the npm/PyPI package out of each `startCmd`,
// and asks the registry for the current version. A missing package = a wrong
// name (that server would fail to install) — the loudest thing this catches.
// Nothing here touches the database.

import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(HERE, "seed-mcps.ts");
const SMOKE = process.argv.includes("--smoke");

// Servers with an empty configSchema — safe to actually boot in --smoke mode
// (the rest need a user key/token we don't have here).
const NO_CONFIG_SMOKE = new Set([
  "context7",
  "excel",
  "everything",
  "memory",
  "sequential-thinking",
  "fetch",
  "time",
  "calculator",
  "duckduckgo",
  "wikipedia",
  "markitdown",
]);

function parseEntries(src) {
  const re = /slug:\s*"([^"]+)"[\s\S]*?startCmd:\s*"([^"]+)"[\s\S]*?version:\s*"([^"]+)"/g;
  const out = [];
  let m;
  while ((m = re.exec(src))) out.push({ slug: m[1], startCmd: m[2], version: m[3] });
  return out;
}

function pkgFromStartCmd(cmd) {
  let m = cmd.match(/npx\s+-y\s+(@?[^\s@]+(?:\/[^\s@]+)?)(?:@([^\s]+))?/);
  if (m) return { registry: "npm", name: m[1], pinned: m[2] ?? null };
  m = cmd.match(/uvx\s+([A-Za-z0-9._-]+)/);
  if (m) return { registry: "pypi", name: m[1], pinned: null };
  return null; // e.g. twinmcp-docs-proxy (in-process) — nothing to resolve
}

async function latestNpm(name) {
  const url = "https://registry.npmjs.org/" + name.replace("/", "%2f");
  const r = await fetch(url, { headers: { accept: "application/vnd.npm.install-v1+json" } });
  if (r.status === 404) return { missing: true };
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { version: j["dist-tags"]?.latest };
}

async function latestPypi(name) {
  const r = await fetch("https://pypi.org/pypi/" + name + "/json");
  if (r.status === 404) return { missing: true };
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return { version: j.info?.version };
}

// Boot a server over stdio and send an MCP `initialize`; resolve OK on a valid
// JSON-RPC reply, else FAIL after a timeout. Best-effort (no config injected).
function smoke(startCmd) {
  return new Promise((resolve) => {
    const child = spawn(startCmd, { shell: true, stdio: ["pipe", "pipe", "ignore"] });
    let buf = "";
    let settled = false;
    const done = (ok, note) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        child.kill();
      } catch {}
      resolve({ ok, note });
    };
    const timer = setTimeout(() => done(false, "timeout (30s)"), 30_000);
    child.on("error", (e) => done(false, e.message));
    child.stdout.on("data", (d) => {
      buf += d.toString();
      for (const line of buf.split(/\r?\n/)) {
        if (
          line.includes('"result"') &&
          (line.includes("serverInfo") || line.includes("capabilities"))
        ) {
          done(true, "initialize OK");
        }
      }
    });
    child.stdin.write(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "verify", version: "1.0.0" },
        },
      }) + "\n"
    );
  });
}

const src = await readFile(SEED, "utf8");
const entries = parseEntries(src);
console.log(`\nParsed ${entries.length} catalog entries from seed-mcps.ts\n`);

const pins = [];
let missing = 0;

for (const e of entries) {
  const pkg = pkgFromStartCmd(e.startCmd);
  if (!pkg) {
    console.log(`  ·  ${e.slug.padEnd(20)} (no npm/uvx package — skipped)`);
    continue;
  }
  let latest;
  try {
    const res = pkg.registry === "npm" ? await latestNpm(pkg.name) : await latestPypi(pkg.name);
    if (res.missing) {
      missing++;
      console.log(
        `  ✗  ${e.slug.padEnd(20)} ${pkg.registry}:${pkg.name} — NOT FOUND (wrong package name!)`
      );
      continue;
    }
    latest = res.version;
  } catch (err) {
    console.log(
      `  ?  ${e.slug.padEnd(20)} ${pkg.registry}:${pkg.name} — lookup error: ${err.message}`
    );
    continue;
  }

  const pinnedNote =
    pkg.pinned && pkg.pinned !== "latest"
      ? pkg.pinned === latest
        ? `pinned @${pkg.pinned} (current)`
        : `pinned @${pkg.pinned} → latest is ${latest}`
      : `latest ${latest}`;
  console.log(`  ✓  ${e.slug.padEnd(20)} ${pkg.registry}:${pkg.name.padEnd(42)} ${pinnedNote}`);

  // Suggest a pinned startCmd for npm entries currently unpinned or on @latest.
  if (pkg.registry === "npm" && (!pkg.pinned || pkg.pinned === "latest")) {
    pins.push({
      slug: e.slug,
      startCmd: e.startCmd
        .replace(pkg.name + "@latest", pkg.name + "@" + latest)
        .replace(
          new RegExp("npx -y " + pkg.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?!@)"),
          "npx -y " + pkg.name + "@" + latest
        ),
      version: latest,
    });
  }
}

if (pins.length) {
  console.log(`\n── Suggested pins (npm) — paste into seed-mcps.ts ─────────────────────────\n`);
  for (const p of pins) {
    console.log(`  ${p.slug}:`);
    console.log(`    startCmd: "${p.startCmd}",`);
    console.log(`    version: "${p.version}",`);
  }
}

if (SMOKE) {
  console.log(`\n── Smoke test (boot + initialize) for no-config servers ──────────────────\n`);
  for (const e of entries) {
    if (!NO_CONFIG_SMOKE.has(e.slug)) continue;
    process.stdout.write(`  …  ${e.slug.padEnd(20)} `);
    const r = await smoke(e.startCmd);
    console.log(`${r.ok ? "✓ OK" : "✗ FAIL"}  (${r.note})`);
  }
}

console.log(
  `\nDone. ${missing ? `⚠ ${missing} package(s) NOT FOUND — fix those names first.` : "All packages resolved."}\n`
);
