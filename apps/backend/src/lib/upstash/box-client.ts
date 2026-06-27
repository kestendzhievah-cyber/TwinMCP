import { randomUUID } from "node:crypto";
import { Box, type Runtime } from "@upstash/box";
import type { BoxSize, McpRuntime } from "@/db/schema/platform";

export interface BoxHandle {
  id: string;
  endpointUrl: string | null;
}

export interface ExecResult {
  status: "completed" | "failed";
  result: string;
  exitCode?: number;
}

/** A port exposed to a public, bearer-protected URL. `token` is null when unauthenticated. */
export interface PublicEndpoint {
  url: string;
  port: number;
  token: string | null;
}

export interface BoxClient {
  createBox(opts: {
    runtime: McpRuntime;
    size: BoxSize;
    name?: string;
    initCommand?: string;
  }): Promise<BoxHandle>;
  deleteBox(boxId: string): Promise<void>;
  exec(boxId: string, command: string): Promise<ExecResult>;
  execBackground(boxId: string, command: string, logFile?: string): Promise<ExecResult>;
  ping(boxId: string): Promise<boolean>;
  tail(boxId: string, file: string, lines?: number): Promise<string>;
  /** Write a file into the box (avoids shell-quoting launcher scripts). */
  writeFile(boxId: string, path: string, content: string): Promise<void>;
  /** Expose an in-box port to a public, bearer-protected URL. */
  exposePort(boxId: string, port: number): Promise<PublicEndpoint>;
  /** Tear down a previously exposed public URL. */
  unexposePort(boxId: string, port: number): Promise<void>;
  /** Set the startup script replayed when a keep-alive box resumes. */
  setInitCommand(boxId: string, command: string): Promise<void>;
}

/** Map our DB runtime enum onto the SDK's runtime set (no `-alpine`, `go`→`golang`). */
function toSdkRuntime(runtime: McpRuntime): Runtime {
  switch (runtime) {
    case "python":
    case "python-alpine":
      return "python";
    case "go":
    case "golang-alpine":
      return "golang";
    case "ruby":
      return "ruby";
    case "rust":
      return "rust";
    case "node":
    case "node-alpine":
    default:
      return "node";
  }
}

// ---------------------------------------------------------------------------
// Stub client — dev/CI only. Never used in production (see getBoxClient).
// Lets us run the platform end-to-end without paying for / configuring Upstash.
// ---------------------------------------------------------------------------
class StubBoxClient implements BoxClient {
  async createBox(opts: { runtime: McpRuntime; size: BoxSize; name?: string }): Promise<BoxHandle> {
    const id = `stub-${randomUUID().slice(0, 12)}`;
    console.warn(
      `[box stub] createBox runtime=${opts.runtime} size=${opts.size} → ${id} (no UPSTASH_BOX_API_KEY)`
    );
    return { id, endpointUrl: null };
  }
  async deleteBox(boxId: string): Promise<void> {
    console.warn(`[box stub] deleteBox ${boxId}`);
  }
  async exec(boxId: string, command: string): Promise<ExecResult> {
    console.warn(`[box stub] exec ${boxId}: ${command}`);
    return { status: "completed", result: "[stubbed]\n", exitCode: 0 };
  }
  async execBackground(boxId: string, command: string): Promise<ExecResult> {
    console.warn(`[box stub] execBackground ${boxId}: ${command}`);
    return { status: "completed", result: "[stubbed-bg]\n", exitCode: 0 };
  }
  async ping(): Promise<boolean> {
    return true;
  }
  async tail(_boxId: string, file: string, lines = 100): Promise<string> {
    const out: string[] = [];
    const now = Date.now();
    for (let i = Math.min(lines, 8); i > 0; i--) {
      const ts = new Date(now - i * 1500).toISOString();
      out.push(`${ts} [stub] ${file.replace(/^.*mcp-?/, "")} heartbeat ${i}`);
    }
    return out.join("\n") + "\n";
  }
  async writeFile(boxId: string, path: string, _content: string): Promise<void> {
    console.warn(`[box stub] writeFile ${boxId}: ${path}`);
  }
  async exposePort(boxId: string, port: number): Promise<PublicEndpoint> {
    console.warn(`[box stub] exposePort ${boxId}:${port}`);
    return { url: `https://${boxId}-${port}.stub.box.local`, port, token: "stub-token" };
  }
  async unexposePort(boxId: string, port: number): Promise<void> {
    console.warn(`[box stub] unexposePort ${boxId}:${port}`);
  }
  async setInitCommand(boxId: string, _command: string): Promise<void> {
    console.warn(`[box stub] setInitCommand ${boxId}`);
  }
}

// ---------------------------------------------------------------------------
// Real client — @upstash/box SDK. Requires UPSTASH_BOX_API_KEY in env.
// Boxes are created keep-alive so the user's MCP bridges stay reachable.
// ---------------------------------------------------------------------------
const READY_STATES = new Set(["idle", "running"]);
const READY_TIMEOUT_MS = 120_000;
const READY_POLL_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class UpstashBoxClient implements BoxClient {
  private async waitUntilReady(box: Box): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    // First check is immediate; create() may already return a ready box.
    for (;;) {
      let status: string;
      try {
        status = (await box.getStatus()).status;
      } catch {
        status = "creating";
      }
      if (READY_STATES.has(status)) return;
      if (status === "error" || status === "deleted") {
        throw new Error(`box ${box.id} entered terminal status '${status}' while provisioning`);
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `box ${box.id} not ready after ${READY_TIMEOUT_MS}ms (last status '${status}')`
        );
      }
      await sleep(READY_POLL_MS);
    }
  }

  async createBox(opts: {
    runtime: McpRuntime;
    size: BoxSize;
    name?: string;
    initCommand?: string;
  }): Promise<BoxHandle> {
    const box = await Box.create({
      runtime: toSdkRuntime(opts.runtime),
      size: opts.size,
      keepAlive: true,
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.initCommand ? { initCommand: opts.initCommand } : {}),
    });
    await this.waitUntilReady(box);
    // The box has no single public URL; per-MCP URLs are minted via exposePort.
    return { id: box.id, endpointUrl: null };
  }

  async deleteBox(boxId: string): Promise<void> {
    await Box.delete({ boxIds: boxId });
  }

  async exec(boxId: string, command: string): Promise<ExecResult> {
    const box = await Box.get(boxId);
    const run = await box.exec.command(command);
    // "detached" = a backgrounded process launched successfully.
    const ok = run.status === "completed" || run.status === "detached";
    return {
      status: ok ? "completed" : "failed",
      result: run.result ?? "",
      exitCode: run.exitCode ?? undefined,
    };
  }

  async execBackground(
    boxId: string,
    command: string,
    logFile = "/tmp/mcp.log"
  ): Promise<ExecResult> {
    const escaped = command.replace(/'/g, "'\\''");
    return this.exec(boxId, `nohup sh -c '${escaped}' > ${logFile} 2>&1 &`);
  }

  async ping(boxId: string): Promise<boolean> {
    try {
      const r = await this.exec(boxId, "true");
      return r.status === "completed";
    } catch {
      return false;
    }
  }

  async tail(boxId: string, file: string, lines = 100): Promise<string> {
    const safe = file.replace(/'/g, "");
    const r = await this.exec(
      boxId,
      `tail -n ${Math.max(1, Math.min(lines, 5000))} '${safe}' 2>/dev/null || true`
    );
    return r.result ?? "";
  }

  async writeFile(boxId: string, path: string, content: string): Promise<void> {
    const box = await Box.get(boxId);
    await box.files.write({ path, content });
  }

  async exposePort(boxId: string, port: number): Promise<PublicEndpoint> {
    const box = await Box.get(boxId);
    const pub = await box.getPublicURL(port, { bearerToken: true });
    return { url: pub.url, port: pub.port, token: pub.token ?? null };
  }

  async unexposePort(boxId: string, port: number): Promise<void> {
    const box = await Box.get(boxId);
    await box.deletePublicURL(port);
  }

  async setInitCommand(boxId: string, command: string): Promise<void> {
    const box = await Box.get(boxId);
    await box.setInitCommand(command);
  }
}

let _client: BoxClient | null = null;

export function getBoxClient(): BoxClient {
  if (_client) return _client;
  if (process.env.UPSTASH_BOX_API_KEY) {
    _client = new UpstashBoxClient();
  } else if (process.env.NODE_ENV === "production") {
    // Anti-stub guard: never serve fake runtimes in production.
    throw new Error(
      "UPSTASH_BOX_API_KEY is required in production — refusing to provision MCP runtimes in stub mode."
    );
  } else {
    console.warn("[box] UPSTASH_BOX_API_KEY missing — using StubBoxClient (dev/CI only).");
    _client = new StubBoxClient();
  }
  return _client;
}

export function isStubMode(): boolean {
  return !process.env.UPSTASH_BOX_API_KEY;
}
