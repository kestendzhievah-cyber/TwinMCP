import { randomUUID } from "node:crypto";
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

export interface BoxClient {
  createBox(opts: { runtime: McpRuntime; size: BoxSize; name?: string }): Promise<BoxHandle>;
  deleteBox(boxId: string): Promise<void>;
  exec(boxId: string, command: string): Promise<ExecResult>;
  execBackground(boxId: string, command: string, logFile?: string): Promise<ExecResult>;
  ping(boxId: string): Promise<boolean>;
  tail(boxId: string, file: string, lines?: number): Promise<string>;
}

// ---------------------------------------------------------------------------
// Stub client — used when UPSTASH_BOX_API_KEY is missing.
// Lets us run the platform end-to-end in dev/CI without paying for Upstash.
// ---------------------------------------------------------------------------
class StubBoxClient implements BoxClient {
  async createBox(opts: { runtime: McpRuntime; size: BoxSize; name?: string }): Promise<BoxHandle> {
    const id = `stub-${randomUUID().slice(0, 12)}`;
    console.warn(
      `[box stub] createBox runtime=${opts.runtime} size=${opts.size} → ${id} (no UPSTASH_BOX_API_KEY)`
    );
    return { id, endpointUrl: `https://${id}.stub.box.local` };
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
      out.push(
        `${ts} [stub] ${file.replace(/^.*mcp-?/, "")} heartbeat ${i}`
      );
    }
    return out.join("\n") + "\n";
  }
}

// ---------------------------------------------------------------------------
// Real client — uses @upstash/box SDK. Requires UPSTASH_BOX_API_KEY in env.
// The SDK is loaded lazily via runtime-constructed dynamic import so that
// typecheck and the stub mode do not require the package to be installed.
// ---------------------------------------------------------------------------
type UpstashBoxModule = {
  Box: {
    create(opts: Record<string, unknown>): Promise<{
      id: string;
      publicUrl?: string;
      endpointUrl?: string;
    }>;
    get(id: string): Promise<{
      delete(): Promise<void>;
      exec: {
        command(c: string): Promise<{
          status: "completed" | "failed";
          result?: string;
          exit_code?: number;
        }>;
      };
    }>;
  };
};

class UpstashBoxClient implements BoxClient {
  private sdk: UpstashBoxModule | null = null;

  private async getSdk(): Promise<UpstashBoxModule> {
    if (this.sdk) return this.sdk;
    // Construct the import call at runtime so TS does not require the module to resolve at typecheck.
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<UpstashBoxModule>;
    this.sdk = await dynamicImport("@upstash/box");
    return this.sdk;
  }

  async createBox(opts: { runtime: McpRuntime; size: BoxSize; name?: string }): Promise<BoxHandle> {
    const { Box } = await this.getSdk();
    const box = await Box.create({
      runtime: opts.runtime,
      size: opts.size,
      keepAlive: true,
      ...(opts.name ? { name: opts.name } : {}),
    });
    const endpoint = box.publicUrl ?? box.endpointUrl ?? null;
    return { id: box.id, endpointUrl: endpoint };
  }

  async deleteBox(boxId: string): Promise<void> {
    const { Box } = await this.getSdk();
    const box = await Box.get(boxId);
    await box.delete();
  }

  async exec(boxId: string, command: string): Promise<ExecResult> {
    const { Box } = await this.getSdk();
    const box = await Box.get(boxId);
    const run = await box.exec.command(command);
    return {
      status: run.status,
      result: run.result ?? "",
      exitCode: run.exit_code,
    };
  }

  async execBackground(boxId: string, command: string, logFile = "/tmp/mcp.log"): Promise<ExecResult> {
    return this.exec(boxId, `nohup sh -c '${command.replace(/'/g, "'\\''")}' > ${logFile} 2>&1 &`);
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
    // Quote the filename to defang anything weird; "tail" returns empty if file is missing
    const safe = file.replace(/'/g, "");
    const r = await this.exec(boxId, `tail -n ${Math.max(1, Math.min(lines, 5000))} '${safe}' 2>/dev/null || true`);
    return r.result ?? "";
  }
}

let _client: BoxClient | null = null;

export function getBoxClient(): BoxClient {
  if (_client) return _client;
  if (process.env.UPSTASH_BOX_API_KEY) {
    _client = new UpstashBoxClient();
  } else {
    _client = new StubBoxClient();
  }
  return _client;
}

export function isStubMode(): boolean {
  return !process.env.UPSTASH_BOX_API_KEY;
}
