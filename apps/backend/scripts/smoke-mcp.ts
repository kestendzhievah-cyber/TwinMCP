/**
 * End-to-end MCP smoke test — the launch gate for the core feature.
 *
 * Exercises the real deployed chain against a running instance:
 *   create server -> install `filesystem` -> wait for `running` (real box) ->
 *   initialize + tools/list + tools/call through the authenticated proxy.
 *
 * Usage (against prod or a preview):
 *   SMOKE_BASE_URL=https://twinmcp.fr SMOKE_API_KEY=ctx7sk_... \
 *     pnpm --filter @twinmcp/backend smoke:mcp
 *
 * Requires a ctx7sk_ API key on an account with a free server slot (the script
 * creates one server and deletes it at the end). Exit code 0 = pass, 1 = fail.
 */

const BASE = (process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const KEY = process.env.SMOKE_API_KEY ?? "";
const MCP_SLUG = "filesystem";
const PROVISION_TIMEOUT_MS = 180_000;
const POLL_MS = 4_000;

if (!KEY.startsWith("ctx7sk_")) {
  console.error("SMOKE_API_KEY must be a ctx7sk_ key. Set SMOKE_API_KEY and SMOKE_BASE_URL.");
  process.exit(1);
}

const authJson = { authorization: `Bearer ${KEY}`, "content-type": "application/json" };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRpc(
  text: string
): { result?: Record<string, unknown>; error?: { message?: string } } | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const dataLine = trimmed.split(/\r?\n/).find((l) => l.startsWith("data:"));
  const payload = dataLine ? dataLine.slice("data:".length).trim() : trimmed;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function rpc(serverSlug: string, method: string, params: unknown, id = 1) {
  const res = await fetch(`${BASE}/api/mcp/${serverSlug}/${MCP_SLUG}`, {
    method: "POST",
    headers: { ...authJson, accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  return { status: res.status, parsed: parseRpc(text), text };
}

function step(msg: string) {
  console.log(`\n▶ ${msg}`);
}

async function main() {
  console.log(`Smoke test against ${BASE}`);
  let serverId: string | null = null;

  try {
    step("Resolve `filesystem` in the catalog");
    const catRes = await fetch(`${BASE}/api/v2/mcp-servers?q=filesystem&official=true`, {
      headers: authJson,
    });
    if (!catRes.ok) throw new Error(`catalog GET ${catRes.status}: ${await catRes.text()}`);
    const cat = (await catRes.json()) as { items: { id: string; slug: string }[] };
    const fs = cat.items.find((m) => m.slug === MCP_SLUG);
    if (!fs) throw new Error("`filesystem` not in catalog — run `pnpm seed:mcps`");
    console.log(`  ✓ ${MCP_SLUG} = ${fs.id}`);

    step("Create a server");
    const createRes = await fetch(`${BASE}/api/v2/servers`, {
      method: "POST",
      headers: authJson,
      body: JSON.stringify({ name: "smoke-test" }),
    });
    if (!createRes.ok) {
      throw new Error(
        `create server ${createRes.status}: ${await createRes.text()} ` +
          "(Free plan allows 1 server — free the slot first)"
      );
    }
    const server = (await createRes.json()) as { id: string; slug: string };
    serverId = server.id;
    console.log(`  ✓ server ${server.slug} (${server.id})`);

    step("Install `filesystem`");
    const installRes = await fetch(`${BASE}/api/v2/servers/${server.id}/mcps`, {
      method: "POST",
      headers: authJson,
      body: JSON.stringify({ mcpServerId: fs.id, config: { FILESYSTEM_PATH: "/workspace/home" } }),
    });
    if (!installRes.ok) throw new Error(`install ${installRes.status}: ${await installRes.text()}`);
    console.log("  ✓ install enqueued");

    step("Wait for the box to reach `running` (real provisioning)");
    const deadline = Date.now() + PROVISION_TIMEOUT_MS;
    let status = "provisioning";
    for (;;) {
      const h = await fetch(`${BASE}/api/v2/servers/${server.id}/health`, { headers: authJson });
      if (h.ok) {
        status = ((await h.json()) as { status: string }).status;
        process.stdout.write(`  status: ${status}\r`);
        if (status === "running") break;
        if (status === "error") throw new Error("server entered `error` during provisioning");
      }
      if (Date.now() > deadline)
        throw new Error(`timeout: still '${status}' after ${PROVISION_TIMEOUT_MS}ms`);
      await sleep(POLL_MS);
    }
    console.log("\n  ✓ running");

    step("initialize");
    const init = await rpc(server.slug, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "1.0.0" },
    });
    if (!(init.parsed?.result?.serverInfo || init.parsed?.result?.capabilities)) {
      throw new Error(`initialize failed (HTTP ${init.status}): ${init.text.slice(0, 300)}`);
    }
    console.log(
      `  ✓ ${JSON.stringify(init.parsed!.result!.serverInfo ?? init.parsed!.result!.capabilities)}`
    );

    step("tools/list");
    const list = await rpc(server.slug, "tools/list", {}, 2);
    const tools = (list.parsed?.result?.tools as { name: string }[] | undefined) ?? [];
    if (tools.length === 0) throw new Error(`no tools returned: ${list.text.slice(0, 300)}`);
    console.log(`  ✓ ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

    step("tools/call (list_allowed_directories)");
    const call = await rpc(
      server.slug,
      "tools/call",
      { name: "list_allowed_directories", arguments: {} },
      3
    );
    if (call.parsed?.error) throw new Error(`tools/call error: ${call.parsed.error.message}`);
    if (!call.parsed?.result) throw new Error(`tools/call no result: ${call.text.slice(0, 300)}`);
    console.log(`  ✓ ${JSON.stringify(call.parsed.result).slice(0, 200)}`);

    console.log("\n✅ SMOKE PASSED — the core MCP chain works end-to-end.");
  } catch (err) {
    console.error(`\n❌ SMOKE FAILED: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  } finally {
    if (serverId) {
      step("Cleanup: delete the test server");
      await fetch(`${BASE}/api/v2/servers/${serverId}`, {
        method: "DELETE",
        headers: authJson,
      }).catch(() => {});
      console.log("  ✓ deleted");
    }
  }
}

void main();
