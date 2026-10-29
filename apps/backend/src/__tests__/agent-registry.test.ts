import { describe, expect, it, vi } from "vitest";
import {
  AGENT_LINK_MAX_MS,
  agentLinkExpired,
  connKey,
  dropAgentsForKey,
  dropAgentsForUser,
  getAgent,
  isAgentOnline,
  mayReplaceAgent,
  registerAgent,
  unregisterAgent,
  type AgentConn,
} from "@/lib/agent/registry";

const conn = (apiKeyId?: string): AgentConn => ({
  send: vi.fn(),
  connectedAt: Date.now(),
  apiKeyId,
  close: vi.fn(),
});

describe("mayReplaceAgent — no silent takeover by another key", () => {
  it("free slot, or the same key reconnecting", () => {
    expect(mayReplaceAgent(undefined, "k1")).toBe(true);
    expect(mayReplaceAgent(conn("k1"), "k1")).toBe(true);
  });

  it("a different key (or none) is refused while a link is live", () => {
    expect(mayReplaceAgent(conn("k1"), "k2")).toBe(false);
    expect(mayReplaceAgent(conn("k1"), undefined)).toBe(false);
    expect(mayReplaceAgent(conn(undefined), undefined)).toBe(false);
  });
});

describe("agentLinkExpired", () => {
  it("caps a link's lifetime", () => {
    const t0 = 1_000_000;
    expect(agentLinkExpired(t0, t0 + AGENT_LINK_MAX_MS - 1)).toBe(false);
    expect(agentLinkExpired(t0, t0 + AGENT_LINK_MAX_MS)).toBe(true);
  });
});

describe("registerAgent / dropAgentsForKey", () => {
  it("refuses a second key, replaces (and closes) a same-key link", () => {
    const key = connKey("u-reg", "srv");
    const a = conn("k1");
    expect(registerAgent(key, a)).toBe(true);
    expect(registerAgent(key, conn("k2"))).toBe(false);
    expect(getAgent(key)).toBe(a);

    const b = conn("k1");
    expect(registerAgent(key, b)).toBe(true);
    expect(a.close).toHaveBeenCalled();
    expect(unregisterAgent(key, a)).toBe(false); // the stale link cannot evict b
    expect(getAgent(key)).toBe(b);
    expect(unregisterAgent(key, b)).toBe(true);
    expect(isAgentOnline(key)).toBe(false);
  });

  it("closes every link opened with a revoked key", () => {
    const c1 = conn("revoked");
    const c2 = conn("other");
    registerAgent(connKey("u-drop", "a"), c1);
    registerAgent(connKey("u-drop", "b"), c2);
    expect(dropAgentsForKey("revoked")).toBe(1);
    expect(c1.close).toHaveBeenCalled();
    expect(c2.close).not.toHaveBeenCalled();
    unregisterAgent(connKey("u-drop", "a"), c1);
    unregisterAgent(connKey("u-drop", "b"), c2);
  });

  it("drops a deleted user's links", () => {
    const c = conn("k");
    registerAgent(connKey("u-gone", "a"), c);
    dropAgentsForUser("u-gone");
    expect(c.close).toHaveBeenCalled();
    expect(isAgentOnline(connKey("u-gone", "a"))).toBe(false);
  });
});
