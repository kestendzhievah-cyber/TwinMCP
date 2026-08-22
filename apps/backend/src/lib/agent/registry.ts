import { randomUUID } from "node:crypto";

// In-process relay registry for local-agent MCP servers.
//
// A local agent (`ctx7 connect`) holds one long-lived SSE stream per server
// (GET /api/agent/link). When the MCP proxy needs to reach a local-agent MCP it
// pushes a JSON-RPC request down that stream and awaits the agent's matching
// POST /api/agent/respond, correlated by a random request id.
//
// NOTE: this state is PER-PROCESS. Prod runs a single standalone container (see
// PRODUCTION.md), so one Node process handles both the SSE link route and the
// proxy route and they share this memory. Scaling to multiple containers would
// need a shared bus (Redis pub/sub) or sticky routing — out of scope for v1.

export type RelayEvent =
  | { type: "request"; id: string; mcpSlug: string; body: string }
  | { type: "ping" };

export interface AgentConn {
  /** Push an SSE event to the connected agent. */
  send: (event: RelayEvent) => void;
  connectedAt: number;
}

export interface RelayResult {
  ok: boolean;
  body: string;
  contentType?: string;
}

interface Pending {
  resolve: (payload: RelayResult) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// A JSON-RPC call to a local tool returns promptly; cap it so a hung agent
// surfaces as an error instead of blocking the worker forever.
const REQUEST_TIMEOUT_MS = 30_000;

const conns = new Map<string, AgentConn>();
const pending = new Map<string, Pending>();

/** Registry key: an agent connection is scoped to one user + one server slug. */
export function connKey(userId: string, serverSlug: string): string {
  return `${userId}:${serverSlug}`;
}

export function registerAgent(key: string, conn: AgentConn): void {
  conns.set(key, conn);
}

/** Remove a connection only if it is still the current one (don't clobber a reconnect). */
export function unregisterAgent(key: string, conn: AgentConn): void {
  if (conns.get(key) === conn) conns.delete(key);
}

export function isAgentOnline(key: string): boolean {
  return conns.has(key);
}

/**
 * Relay a JSON-RPC request to the agent for `key` and await its response.
 * Rejects if no agent is connected or the agent doesn't answer in time.
 */
export function relayToAgent(key: string, mcpSlug: string, body: string): Promise<RelayResult> {
  const conn = conns.get(key);
  if (!conn) return Promise.reject(new Error("agent offline"));
  const id = randomUUID();
  return new Promise<RelayResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("agent request timed out"));
    }, REQUEST_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    try {
      conn.send({ type: "request", id, mcpSlug, body });
    } catch (err) {
      clearTimeout(timer);
      pending.delete(id);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

/** Called by POST /api/agent/respond when the agent returns a result. */
export function resolveAgentResponse(id: string, payload: RelayResult): boolean {
  const p = pending.get(id);
  if (!p) return false;
  clearTimeout(p.timer);
  pending.delete(id);
  p.resolve(payload);
  return true;
}
