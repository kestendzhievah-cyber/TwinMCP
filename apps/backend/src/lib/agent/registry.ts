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
  /** The API key that opened the link (so a revoke can find and drop it). */
  apiKeyId?: string;
  /** Close the link's stream (and unregister it). */
  close?: () => void;
}

/**
 * Longest an agent link may stay open before the server closes it; the CLI
 * reconnects (and is re-authenticated) on its own.
 */
export const AGENT_LINK_MAX_MS = 12 * 60 * 60 * 1000;

/**
 * May a new link opened with `apiKeyId` replace `existing`? Only when nothing is
 * connected or the live link was opened with the same key: a different key
 * (e.g. a leaked IDE key) must not silently take over a running local agent,
 * receive its decrypted env and answer its tool calls.
 */
export function mayReplaceAgent(
  existing: AgentConn | undefined,
  apiKeyId: string | undefined
): boolean {
  if (!existing) return true;
  return Boolean(apiKeyId) && existing.apiKeyId === apiKeyId;
}

/** Is a link opened at `connectedAt` past its maximum lifetime? */
export function agentLinkExpired(connectedAt: number, now: number = Date.now()): boolean {
  return now - connectedAt >= AGENT_LINK_MAX_MS;
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

export function getAgent(key: string): AgentConn | undefined {
  return conns.get(key);
}

/**
 * Register `conn` for `key`, closing the link it replaces (same key: a
 * reconnect). Returns false, registering nothing, when another key holds the
 * live link (see mayReplaceAgent).
 */
export function registerAgent(key: string, conn: AgentConn): boolean {
  const existing = conns.get(key);
  if (!mayReplaceAgent(existing, conn.apiKeyId)) return false;
  conns.set(key, conn);
  if (existing && existing !== conn) {
    try {
      existing.close?.();
    } catch {
      /* already closed */
    }
  }
  return true;
}

/**
 * Remove a connection only if it is still the current one (don't clobber a
 * reconnect). Returns whether it was removed.
 */
export function unregisterAgent(key: string, conn: AgentConn): boolean {
  if (conns.get(key) !== conn) return false;
  conns.delete(key);
  return true;
}

/** Close every agent link opened with `apiKeyId` (call on revoke). */
export function dropAgentsForKey(apiKeyId: string): number {
  let dropped = 0;
  for (const conn of [...conns.values()]) {
    if (conn.apiKeyId !== apiKeyId) continue;
    dropped++;
    try {
      conn.close?.();
    } catch {
      /* already closed */
    }
  }
  return dropped;
}

/** Close every agent link of `userId` (account deletion). */
export function dropAgentsForUser(userId: string): void {
  for (const [key, conn] of [...conns.entries()]) {
    if (!key.startsWith(`${userId}:`)) continue;
    try {
      conn.close?.();
    } catch {
      /* already closed */
    }
    if (conns.get(key) === conn) conns.delete(key);
  }
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
