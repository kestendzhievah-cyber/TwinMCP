import { describe, it, expect } from "vitest";
import {
  DELETE_RUNTIME_KEEPS,
  DELETE_RUNTIME_LOSES,
  deleteRuntimeConfirmed,
  isPausedRuntime,
  isRuntimeGone,
  lifecycleActions,
  lifecycleState,
  pauseFailureAction,
} from "@/lib/server-lifecycle";

const box = (status: Parameters<typeof lifecycleState>[0]["status"], boxId: string | null) => ({
  status,
  hostType: "upstash_box" as const,
  boxId,
});
const agent = (status: Parameters<typeof lifecycleState>[0]["status"]) => ({
  status,
  hostType: "local_agent" as const,
  boxId: null,
});

describe("lifecycleState — `stopped` reads two ways", () => {
  it("stopped + box id = paused (data kept)", () => {
    expect(lifecycleState(box("stopped", "box_1"))).toBe("paused");
    expect(isPausedRuntime(box("stopped", "box_1"))).toBe(true);
  });

  it("stopped without a box = no runtime", () => {
    expect(lifecycleState(box("stopped", null))).toBe("no_runtime");
    expect(isPausedRuntime(box("stopped", null))).toBe(false);
  });

  it("a local agent that is stopped is offline, never paused", () => {
    expect(lifecycleState(agent("stopped"))).toBe("agent_offline");
    expect(isPausedRuntime({ ...agent("stopped"), boxId: "stray" })).toBe(false);
  });

  it("other statuses pass through", () => {
    expect(lifecycleState(box("running", "b"))).toBe("running");
    expect(lifecycleState(box("provisioning", null))).toBe("provisioning");
    expect(lifecycleState(box("error", "b"))).toBe("error");
    expect(lifecycleState(box("destroyed", null))).toBe("destroyed");
  });
});

describe("lifecycleActions", () => {
  it("running box: Pause, Restart, Delete runtime; no Resume/Start", () => {
    expect(lifecycleActions(box("running", "b"))).toEqual({
      resume: false,
      start: false,
      pause: true,
      restart: true,
      deleteRuntime: true,
    });
  });

  it("paused box: Resume and Delete runtime only", () => {
    expect(lifecycleActions(box("stopped", "b"))).toEqual({
      resume: true,
      start: false,
      pause: false,
      restart: false,
      deleteRuntime: true,
    });
  });

  it("no runtime: Start only (nothing to pause or delete)", () => {
    expect(lifecycleActions(box("stopped", null))).toEqual({
      resume: false,
      start: true,
      pause: false,
      restart: false,
      deleteRuntime: false,
    });
  });

  it("error: Start, and Delete runtime when a box is left", () => {
    expect(lifecycleActions(box("error", "b"))).toMatchObject({ start: true, deleteRuntime: true });
    expect(lifecycleActions(box("error", null))).toMatchObject({
      start: true,
      deleteRuntime: false,
    });
  });

  it("provisioning with a box: Delete runtime stays available as a way out", () => {
    expect(lifecycleActions(box("provisioning", "b"))).toMatchObject({
      pause: false,
      deleteRuntime: true,
    });
  });

  it("local agents have no runtime controls at all", () => {
    for (const s of ["running", "stopped", "error"] as const) {
      expect(lifecycleActions(agent(s))).toEqual({
        resume: false,
        start: false,
        pause: false,
        restart: false,
        deleteRuntime: false,
      });
    }
  });

  it("destroyed: nothing", () => {
    expect(Object.values(lifecycleActions(box("destroyed", "b"))).some(Boolean)).toBe(false);
  });
});

describe("deleteRuntimeConfirmed — typed confirmation", () => {
  it("accepts the exact name, ignoring surrounding whitespace", () => {
    expect(deleteRuntimeConfirmed("prod-tools", "prod-tools")).toBe(true);
    expect(deleteRuntimeConfirmed("  prod-tools ", "prod-tools")).toBe(true);
  });

  it("rejects a different case, a prefix or an empty name", () => {
    expect(deleteRuntimeConfirmed("Prod-Tools", "prod-tools")).toBe(false);
    expect(deleteRuntimeConfirmed("prod", "prod-tools")).toBe(false);
    expect(deleteRuntimeConfirmed("", "")).toBe(false);
    expect(deleteRuntimeConfirmed("  ", "  ")).toBe(false);
  });

  it("the dialog copy names what is lost and what is kept", () => {
    expect(DELETE_RUNTIME_LOSES.join(" ")).toMatch(/files your MCPs wrote/);
    expect(DELETE_RUNTIME_LOSES.join(" ")).toMatch(/logs/);
    expect(DELETE_RUNTIME_KEEPS).toMatch(/configuration/);
  });
});

describe("isRuntimeGone — conservative", () => {
  it("terminal box statuses are gone", () => {
    for (const s of ["deleted", "terminated", "failed", "error"])
      expect(isRuntimeGone(s)).toBe(true);
  });

  it("live or paused statuses are not", () => {
    for (const s of ["running", "idle", "paused", "creating", "unknown"]) {
      expect(isRuntimeGone(s)).toBe(false);
    }
  });

  it("a 404/410 or a 'has been deleted' error is gone", () => {
    expect(isRuntimeGone({ statusCode: 404, message: "x" })).toBe(true);
    expect(isRuntimeGone({ statusCode: 410 })).toBe(true);
    expect(isRuntimeGone(new Error("Box has been deleted"))).toBe(true);
    expect(isRuntimeGone(new Error("box not found"))).toBe(true);
  });

  it("a transient network error never is (a recreate would lose data)", () => {
    expect(isRuntimeGone(new Error("fetch failed"))).toBe(false);
    expect(isRuntimeGone({ statusCode: 503, message: "Service Unavailable" })).toBe(false);
    expect(isRuntimeGone(null)).toBe(false);
    expect(isRuntimeGone(undefined)).toBe(false);
  });
});

describe("pauseFailureAction — decided from the status probe only", () => {
  it("a live box is never treated as gone", () => {
    expect(pauseFailureAction("running")).toBe("stop_bridges");
    expect(pauseFailureAction("idle")).toBe("stop_bridges");
    // a transient probe failure is not proof either
    expect(pauseFailureAction(new Error("socket hang up"))).toBe("stop_bridges");
  });

  it("already paused, or provably gone", () => {
    expect(pauseFailureAction("paused")).toBe("already_paused");
    expect(pauseFailureAction("deleted")).toBe("forget");
    expect(pauseFailureAction({ statusCode: 404 })).toBe("forget");
  });
});
