import { describe, it, expect, vi, beforeEach } from "vitest";

// emitWebhookEvent sits on the proxy's 429 path and in background jobs: it must
// return synchronously, never throw, and cost nothing for accounts without a
// subscribed endpoint.

const mocks = vi.hoisted(() => ({
  where: vi.fn<() => Promise<unknown>>(),
  insertValues: vi.fn<(rows: unknown) => Promise<void>>(),
  scheduleDelivery: vi.fn<(id: string) => Promise<void>>(),
}));

vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => ({ from: () => ({ where: mocks.where }) }),
    insert: () => ({ values: mocks.insertValues }),
  }),
}));
vi.mock("./deliver", () => ({ scheduleDelivery: mocks.scheduleDelivery }));

import { emitWebhookEvent, invalidateWebhookEndpointCache } from "./emit";

const flush = () => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  vi.clearAllMocks();
  invalidateWebhookEndpointCache();
  mocks.insertValues.mockResolvedValue(undefined);
  mocks.scheduleDelivery.mockResolvedValue(undefined);
});

describe("emitWebhookEvent", () => {
  it("never throws, even when the database is down", async () => {
    mocks.where.mockRejectedValue(new Error("db down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(emitWebhookEvent("u1", "quota.reached", { limit: 50 })).toBeUndefined();
    await flush();
    expect(mocks.insertValues).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("delivers only to endpoints subscribed to the event", async () => {
    mocks.where.mockResolvedValue([
      { id: "ep_a", events: ["mcp.installed"] },
      { id: "ep_b", events: ["quota.reached"] },
    ]);
    emitWebhookEvent("u1", "mcp.installed", { mcpSlug: "github" });
    await flush();
    const rows = mocks.insertValues.mock.calls[0]![0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      endpointId: "ep_a",
      eventType: "mcp.installed",
      status: "pending",
      payload: { type: "mcp.installed", data: { mcpSlug: "github" } },
    });
    expect(String(rows[0]!.id)).toMatch(/^msg_/);
    expect(mocks.scheduleDelivery).toHaveBeenCalledWith(rows[0]!.id);
  });

  it("caches the endpoint list per user (one query for a burst)", async () => {
    mocks.where.mockResolvedValue([]);
    emitWebhookEvent("u2", "quota.reached", {});
    await flush();
    emitWebhookEvent("u2", "quota.reached", {});
    await flush();
    expect(mocks.where).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).not.toHaveBeenCalled();
    invalidateWebhookEndpointCache("u2");
    emitWebhookEvent("u2", "quota.reached", {});
    await flush();
    expect(mocks.where).toHaveBeenCalledTimes(2);
  });
});
