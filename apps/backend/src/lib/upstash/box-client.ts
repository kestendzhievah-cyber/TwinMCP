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

/**
 * One box's lifetime usage counters as Upstash reports them (Box.list()).
 * The counters are OPTIONAL in the SDK types: a null field means Upstash did
 * not send it, and compute metering then falls back to a wall-clock estimate
 * (lib/wallet/compute-meter.ts). Counters are lost when the box is deleted,
 * so a snapshot must be taken before every deleteBox.
 */
export interface BoxUsage {
  id: string;
  name: string | null;
  size: BoxSize | null;
  status: string;
  keepAlive: boolean | null;
  /** Cumulative CPU time, nanoseconds. */
  totalCpuNs: number | null;
  /** Cumulative compute cost, USD, as Upstash bills it. */
  totalComputeCostUsd: number | null;
  lastActivityAt: Date | null;
  createdAt: Date | null;
}

export interface BoxClient {
  createBox(opts: {
    runtime: McpRuntime;
    size: BoxSize;
    name?: string;
    initCommand?: string;
    /** Keep the box alive (bridge stays reachable). Requires a paid Upstash plan. Default true. */
    keepAlive?: boolean;
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
  /** Current box status: creating|idle|running|paused|error|deleted. */
  getStatus(boxId: string): Promise<string>;
  /** Resume a paused (idle-lifecycle) box. */
  resume(boxId: string): Promise<void>;
  /**
   * Pause a box: compute is released, the disk is kept. Throws for a
   * keep-alive box (the SDK refuses to pause those).
   */
  pause(boxId: string): Promise<void>;
  /** Every box of the account with its usage counters (one API call). */
  list(): Promise<BoxUsage[]>;
  /** One box's usage counters; null when the account has no such box. */
  usage(boxId: string): Promise<BoxUsage | null>;
}

/**
 * An Upstash epoch number as a Date. The unit is not documented, so it is
 * inferred from the magnitude (seconds, milliseconds, microseconds or
 * nanoseconds). Missing, zero, negative or non-finite → null.
 */
export function epochToDate(n: unknown): Date | null {
  if (typeof n !== "number" || !Number.isFinite(n) || n <= 0) return null;
  let ms: number;
  if (n >= 1e17)
    ms = n / 1e6; // nanoseconds
  else if (n >= 1e14)
    ms = n / 1e3; // microseconds
  else if (n >= 1e11)
    ms = n; // milliseconds
  else ms = n * 1000; // seconds
  const d = new Date(Math.round(ms));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** A non-negative finite counter, or null when absent / malformed. */
function counter(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
}

const SIZES = new Set<string>(["small", "medium", "large"]);

/** Map the SDK's BoxData (fields optional) onto BoxUsage. Pure; exported for tests. */
export function toBoxUsage(d: {
  id: string;
  name?: string;
  size?: string;
  status?: string;
  keep_alive?: boolean;
  total_cpu_ns?: number;
  total_compute_cost_usd?: number;
  last_activity_at?: number;
  created_at?: number;
}): BoxUsage {
  return {
    id: d.id,
    name: d.name ?? null,
    size: d.size && SIZES.has(d.size) ? (d.size as BoxSize) : null,
    status: d.status ?? "unknown",
    keepAlive: typeof d.keep_alive === "boolean" ? d.keep_alive : null,
    totalCpuNs: counter(d.total_cpu_ns),
    totalComputeCostUsd: counter(d.total_compute_cost_usd),
    lastActivityAt: epochToDate(d.last_activity_at),
    createdAt: epochToDate(d.created_at),
  };
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
  async getStatus(): Promise<string> {
    return "running";
  }
  async resume(boxId: string): Promise<void> {
    console.warn(`[box stub] resume ${boxId}`);
  }
  async pause(boxId: string): Promise<void> {
    console.warn(`[box stub] pause ${boxId}`);
  }
  // No real boxes, so no usage: compute metering skips stub mode entirely.
  async list(): Promise<BoxUsage[]> {
    return [];
  }
  async usage(): Promise<BoxUsage | null> {
    return null;
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
  // A Box handle is a thin client (boxId + auth headers) — memoize it so
  // exec/status/expose/resume don't each pay an extra Box.get() network
  // round-trip. getStatus()/resume() still fetch fresh per call, so a cached
  // handle never serves stale state. Evicted on delete.
  private handles = new Map<string, Box>();

  private async getBox(boxId: string): Promise<Box> {
    let box = this.handles.get(boxId);
    if (!box) {
      box = await Box.get(boxId);
      this.handles.set(boxId, box);
    }
    return box;
  }

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
    keepAlive?: boolean;
  }): Promise<BoxHandle> {
    const box = await Box.create({
      runtime: toSdkRuntime(opts.runtime),
      size: opts.size,
      keepAlive: opts.keepAlive ?? true,
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.initCommand ? { initCommand: opts.initCommand } : {}),
    });
    await this.waitUntilReady(box);
    this.handles.set(box.id, box);
    // The box has no single public URL; per-MCP URLs are minted via exposePort.
    return { id: box.id, endpointUrl: null };
  }

  async deleteBox(boxId: string): Promise<void> {
    await Box.delete({ boxIds: boxId });
    this.handles.delete(boxId);
  }

  async exec(boxId: string, command: string): Promise<ExecResult> {
    const box = await this.getBox(boxId);
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
    const box = await this.getBox(boxId);
    await box.files.write({ path, content });
  }

  async exposePort(boxId: string, port: number): Promise<PublicEndpoint> {
    const box = await this.getBox(boxId);
    const pub = await box.getPublicURL(port, { bearerToken: true });
    return { url: pub.url, port: pub.port, token: pub.token ?? null };
  }

  async unexposePort(boxId: string, port: number): Promise<void> {
    const box = await this.getBox(boxId);
    await box.deletePublicURL(port);
  }

  async setInitCommand(boxId: string, command: string): Promise<void> {
    const box = await this.getBox(boxId);
    await box.setInitCommand(command);
  }

  async getStatus(boxId: string): Promise<string> {
    const box = await this.getBox(boxId);
    return (await box.getStatus()).status;
  }

  async resume(boxId: string): Promise<void> {
    const box = await this.getBox(boxId);
    await box.resume();
  }

  async pause(boxId: string): Promise<void> {
    const box = await this.getBox(boxId);
    await box.pause();
  }

  async list(): Promise<BoxUsage[]> {
    const rows = await Box.list();
    return rows.map(toBoxUsage);
  }

  // The SDK has no single-box usage call (Box.get returns a handle without the
  // counters), so this filters the account listing.
  async usage(boxId: string): Promise<BoxUsage | null> {
    const rows = await Box.list();
    const row = rows.find((r) => r.id === boxId);
    return row ? toBoxUsage(row) : null;
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
