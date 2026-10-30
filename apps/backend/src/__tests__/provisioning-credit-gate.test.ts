import { beforeEach, describe, expect, it, vi } from "vitest";

// Prepaid wallet in provisioning: no credit → no new box and no wake-up
// (402 / -32008 via InsufficientCreditError), and a box is metered BEFORE it
// is deleted (Upstash loses its usage counters with the box).

const calls: string[] = [];
const box = {
  createBox: vi.fn(async () => {
    calls.push("createBox");
    return { id: "box_new", endpointUrl: null };
  }),
  deleteBox: vi.fn(async () => {
    calls.push("deleteBox");
  }),
  resume: vi.fn(async () => {}),
  getStatus: vi.fn(async () => "running"),
  exec: vi.fn(async () => ({ status: "completed", result: "" })),
  ping: vi.fn(async () => false),
  writeFile: vi.fn(async () => {}),
  exposePort: vi.fn(),
};
vi.mock("@/lib/upstash/box-client", () => ({ getBoxClient: () => box }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
vi.mock("@/lib/webhooks/emit", () => ({ emitWebhookEvent: vi.fn() }));

const gate = vi.hoisted(() => ({
  block: null as null | "no_credit" | "promo_cost_cap",
}));
vi.mock("@/lib/wallet/compute-meter", () => ({
  checkComputeAllowed: vi.fn(async () => gate.block),
  meterBoxBeforeDelete: vi.fn(async (boxId: string) => {
    calls.push(`meter:${boxId}`);
  }),
  ensureZeroSnapshot: vi.fn(async () => {}),
}));

const srvRow = {
  id: "srv_1",
  userId: "u_1",
  boxId: "box_old" as string | null,
  boxSize: "small",
  status: "stopped",
  hostType: "upstash_box",
  slug: "s",
};
const updates: Array<Record<string, unknown>> = [];
function chain(result: () => unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["from", "where", "limit", "innerJoin", "returning"]) q[m] = () => q;
  q.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve().then(result).then(res, rej);
  return q;
}
vi.mock("@/db", () => ({
  getDb: () => ({
    select: () => chain(() => [srvRow]),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        updates.push(values);
        return chain(() => []);
      },
    }),
  }),
}));

import {
  InsufficientCreditError,
  destroyServerRuntime,
  isInsufficientCreditError,
  provisionServer,
  resumeServer,
} from "@/lib/provisioning";
import { reconcileServersForPlan } from "@/lib/billing/reconcile";

beforeEach(() => {
  vi.clearAllMocks();
  calls.length = 0;
  updates.length = 0;
  gate.block = null;
  srvRow.boxId = "box_old";
  srvRow.status = "stopped";
});

describe("resumeServer — no wake without credit", () => {
  it("refuses with InsufficientCreditError (402 / -32008) and never touches the box", async () => {
    gate.block = "no_credit";
    const err = await resumeServer("srv_1").catch((e: unknown) => e);
    expect(isInsufficientCreditError(err)).toBe(true);
    const e = err as InsufficientCreditError;
    expect(e.httpStatus).toBe(402);
    expect(e.rpcCode).toBe(-32008);
    expect(e.message).toBe(
      "Your TwinMCP credit is used up. Top up at https://twinmcp.fr/dashboard/billing"
    );
    expect(box.resume).not.toHaveBeenCalled();
    expect(box.exec).not.toHaveBeenCalled();
  });

  it("past the promo compute cap: refused with that reason", async () => {
    gate.block = "promo_cost_cap";
    const err = await resumeServer("srv_1").catch((e: unknown) => e);
    expect((err as InsufficientCreditError).reason).toBe("promo_cost_cap");
    expect(box.resume).not.toHaveBeenCalled();
  });

  it("with credit, the box is woken", async () => {
    await resumeServer("srv_1");
    expect(box.resume).toHaveBeenCalledWith("box_old");
  });
});

describe("provisionServer — no new box without credit", () => {
  it("leaves the server stopped and creates nothing", async () => {
    gate.block = "no_credit";
    srvRow.boxId = null;
    srvRow.status = "provisioning";
    await provisionServer("srv_1");
    expect(box.createBox).not.toHaveBeenCalled();
    expect(updates.at(-1)).toMatchObject({ status: "stopped" });
  });
});

describe("destroyServerRuntime — meter before delete", () => {
  it("takes the final usage sample before deleteBox", async () => {
    await destroyServerRuntime("srv_1");
    expect(calls).toEqual(["meter:box_old", "deleteBox"]);
  });
});

describe("reconcileServersForPlan — billing no longer stops servers", () => {
  it("is a no-op", async () => {
    expect(await reconcileServersForPlan("u_1", "free")).toEqual({ stopped: [] });
  });
});
