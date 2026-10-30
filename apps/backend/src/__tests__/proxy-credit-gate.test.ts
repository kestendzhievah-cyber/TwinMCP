import { describe, it, expect, beforeEach, vi } from "vitest";

// The billing gate and the charge of the MCP proxy (contract W2), shared by the
// per-MCP route, the aggregated / router endpoint (lib/mcp/relay.ts) and
// mirrored by the playground:
//   - overhead is never gated nor charged;
//   - a billable tools/call is refused BEFORE forwarding when the wallet is
//     empty (402, -32008) or unreadable (fails closed);
//   - the per-minute abuse limiter answers 429 before the wallet is read;
//   - a call the MCP answered is charged once; proxy-side failures are not.

const mocks = vi.hoisted(() => ({
  hasCredit: vi.fn<(userId: string) => Promise<boolean>>(),
  debit: vi.fn(),
  recordMcpUsage: vi.fn(),
  notifyCreditExhausted: vi.fn(async () => {}),
  trackServer: vi.fn(),
}));

vi.mock("@/lib/wallet/ledger", () => ({ hasCredit: mocks.hasCredit, debit: mocks.debit }));
vi.mock("@/lib/wallet/after-debit", () => ({ afterBalanceChange: vi.fn() }));
vi.mock("@/lib/usage-metrics", () => ({ recordMcpUsage: mocks.recordMcpUsage }));
vi.mock("@/lib/billing/quota-nudge", () => ({
  notifyCreditExhausted: mocks.notifyCreditExhausted,
}));
vi.mock("@/lib/analytics/server", () => ({ trackServer: mocks.trackServer }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/db", () => ({ getDb: () => ({}) }));
vi.mock("@/lib/provisioning", () => ({
  RuntimeGoneError: class extends Error {},
  claimReprovision: vi.fn(),
  resumeServer: vi.fn(),
}));
vi.mock("@/lib/queue/qstash", () => ({ enqueue: vi.fn() }));
vi.mock("@/lib/agent/registry", () => ({ isAgentOnline: vi.fn(), relayToAgent: vi.fn() }));
vi.mock("@/lib/activity/record", () => ({ recordToolCall: vi.fn() }));
vi.mock("@/lib/oauth", () => ({ wwwAuthenticateHeader: () => "Bearer" }));

import { billingGate, toolCallMeter, type RelayCtx } from "@/lib/mcp/relay";
import { PROXY_REQUEST_ID_HEADER } from "@/lib/errors";
import { CALLS_PER_MINUTE, flushCallMeter, resetCallBurst } from "@/lib/wallet/call-meter";
import type { AuthedContext } from "@/lib/auth";

const RID = "11111111-2222-4333-8444-555555555555";

function ctx(billable: boolean, userId = "u1"): RelayCtx & { meter: ReturnType<typeof vi.fn> } {
  return {
    auth: { userId, plan: "free", hasStripeCustomer: false } as unknown as AuthedContext,
    requestId: RID,
    verdict: billable
      ? { billable: true, needsCredit: true, units: 1, rpcMethod: "tools/call", rpcId: 5 }
      : { billable: false, needsCredit: false, units: 0, rpcMethod: "tools/list", rpcId: 5 },
    meter: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCallBurst();
  mocks.hasCredit.mockResolvedValue(true);
  mocks.debit.mockResolvedValue({
    applied: true,
    totalMicros: 1,
    crossedZero: false,
    crossedThreshold: false,
  });
});

describe("billingGate", () => {
  it("never gates protocol overhead (and never reads the wallet for it)", async () => {
    mocks.hasCredit.mockResolvedValue(false);
    expect(await billingGate(ctx(false))).toBeNull();
    expect(mocks.hasCredit).not.toHaveBeenCalled();
  });

  it("refuses a non-tool request that makes the MCP work (resources/read) with 402, uncharged", async () => {
    mocks.hasCredit.mockResolvedValue(false);
    const c = {
      ...ctx(false),
      verdict: {
        billable: false,
        needsCredit: true,
        units: 0,
        rpcMethod: "resources/read",
        rpcId: 9,
      },
    };
    const res = await billingGate(c);
    expect(res?.status).toBe(402);
    expect((await res!.json()).error.code).toBe(-32008);
    expect(c.meter).not.toHaveBeenCalled();
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it("lets a tools/call through when the wallet has credit", async () => {
    const c = ctx(true);
    expect(await billingGate(c)).toBeNull();
    expect(mocks.hasCredit).toHaveBeenCalledWith("u1");
    expect(c.meter).not.toHaveBeenCalled();
  });

  it("refuses a tools/call with 402 / -32008 when the wallet is empty", async () => {
    mocks.hasCredit.mockResolvedValue(false);
    const c = ctx(true);
    const res = await billingGate(c);
    expect(res?.status).toBe(402);
    expect(res?.headers.get(PROXY_REQUEST_ID_HEADER)).toBe(RID);
    const body = await res!.json();
    expect(body.id).toBe(5);
    expect(body.error).toEqual({
      code: -32008,
      message: "Your TwinMCP credit is used up. Top up at https://twinmcp.fr/dashboard/billing",
      data: {
        requestId: RID,
        docsUrl: "https://twinmcp.fr/docs#credit",
        topupUrl: "https://twinmcp.fr/dashboard/billing",
      },
    });
    // Counted as a failed call in usage_metrics, never charged.
    expect(c.meter).toHaveBeenCalledWith(false);
    expect(mocks.notifyCreditExhausted).toHaveBeenCalledWith("u1", "free");
  });

  it("fails closed: a wallet that cannot be read refuses the call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.hasCredit.mockRejectedValue(new Error("db down"));
    const res = await billingGate(ctx(true));
    expect(res?.status).toBe(402);
  });

  it("answers 429 / -32029 past the per-minute limit, before reading the wallet", async () => {
    for (let i = 0; i < CALLS_PER_MINUTE; i++) {
      expect(await billingGate(ctx(true, "busy"))).toBeNull();
    }
    mocks.hasCredit.mockClear();
    const c = ctx(true, "busy");
    const res = await billingGate(c);
    expect(res?.status).toBe(429);
    expect(res?.headers.get("Retry-After")).toBeTruthy();
    const body = await res!.json();
    expect(body.error.code).toBe(-32029);
    expect(body.window).toBe("minute");
    expect(body.message).toContain(`${CALLS_PER_MINUTE} tool calls per minute`);
    expect(mocks.hasCredit).not.toHaveBeenCalled();
    expect(c.meter).toHaveBeenCalledWith(false);
    // Another user is unaffected.
    expect(await billingGate(ctx(true, "calm"))).toBeNull();
  });
});

describe("toolCallMeter", () => {
  it("counts and charges a tools/call the MCP answered, once", async () => {
    const meter = toolCallMeter("u1", "us1", true);
    meter(true);
    meter(true); // a second call site cannot double-charge
    expect(mocks.recordMcpUsage).toHaveBeenCalledWith("us1", true);
    await flushCallMeter();
    expect(mocks.debit).toHaveBeenCalledTimes(1);
    expect(mocks.debit.mock.calls[0][0]).toMatchObject({
      userId: "u1",
      kind: "usage_tool_call",
      units: { calls: 1 },
    });
    expect(mocks.debit.mock.calls[0][0].idempotencyKey).toMatch(/^calls:u1:\d+-[0-9a-f]{8}:\d+$/);
  });

  it("counts a proxy-side failure in usage_metrics without charging it", async () => {
    const meter = toolCallMeter("u1", "us1", true);
    meter(false);
    expect(mocks.recordMcpUsage).toHaveBeenCalledWith("us1", false);
    await flushCallMeter();
    expect(mocks.debit).not.toHaveBeenCalled();
  });

  it("does nothing for protocol overhead", async () => {
    const meter = toolCallMeter("u1", "us1", false);
    meter(true);
    expect(mocks.recordMcpUsage).not.toHaveBeenCalled();
    await flushCallMeter();
    expect(mocks.debit).not.toHaveBeenCalled();
  });
});
