import { beforeEach, describe, expect, it, vi } from "vitest";

// Pause must never destroy a live box (contract K4: no data loss on Pause).
// pauseServerRuntime runs against a mocked DB and box client: the box refuses
// to pause with a 404-looking error while its status probe says it is alive.

const box = {
  pause: vi.fn(),
  getStatus: vi.fn(),
  deleteBox: vi.fn(),
  exec: vi.fn(),
  resume: vi.fn(),
  exposePort: vi.fn(),
};
vi.mock("@/lib/upstash/box-client", () => ({ getBoxClient: () => box }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const updates: Array<Record<string, unknown>> = [];
function chain(result: unknown) {
  // A thenable query builder: every method returns itself, awaiting resolves.
  const q: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "innerJoin", "returning"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve(result).then(res, rej);
  return q;
}
vi.mock("@/db", () => ({
  getDb: () => ({
    select: (fields: Record<string, unknown>) =>
      // the server lookup selects boxId; the bridges lookup selects slug/port
      chain("hostType" in fields ? [{ boxId: "box_live", hostType: "upstash_box" }] : []),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return chain([]);
      },
    }),
  }),
}));

import { pauseServerRuntime } from "@/lib/provisioning";

beforeEach(() => {
  vi.clearAllMocks();
  updates.length = 0;
});

describe("pauseServerRuntime — a failed pause never deletes a live box", () => {
  it("pause rejects with statusCode 404 but the box is running → bridges stopped, box kept", async () => {
    box.pause.mockRejectedValue(Object.assign(new Error("Not Found"), { statusCode: 404 }));
    box.getStatus.mockResolvedValue("running");

    const outcome = await pauseServerRuntime("srv_1");

    expect(outcome).toBe("bridges_stopped");
    expect(box.deleteBox).not.toHaveBeenCalled();
    // the box id is never cleared
    expect(updates.some((u) => "boxId" in u)).toBe(false);
    expect(updates.at(-1)).toMatchObject({ status: "stopped" });
  });

  it("status probe says the box is gone → runtime forgotten in the DB, still no deleteBox", async () => {
    box.pause.mockRejectedValue(new Error("boom"));
    box.getStatus.mockResolvedValue("deleted");

    const outcome = await pauseServerRuntime("srv_1");

    expect(outcome).toBe("no_runtime");
    expect(box.deleteBox).not.toHaveBeenCalled();
    expect(updates.some((u) => u.boxId === null)).toBe(true);
  });

  it("a successful pause keeps the box id", async () => {
    box.pause.mockResolvedValue(undefined);

    expect(await pauseServerRuntime("srv_1")).toBe("paused");
    expect(box.deleteBox).not.toHaveBeenCalled();
    expect(updates.some((u) => "boxId" in u)).toBe(false);
  });
});
