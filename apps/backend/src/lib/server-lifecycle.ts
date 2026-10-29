// Server runtime lifecycle: Pause / Resume / Delete runtime (contract K4).
//
// The DB status enum has no `paused` value (servers.status is owned by the
// schema; adding one is out of scope for the runtime), so "paused" is derived:
//
//   status `stopped` + a box id  → paused: the Upstash Box is paused, its disk
//                                  (installed packages, files the MCPs wrote,
//                                  logs) is kept; the next MCP request or the
//                                  Resume button wakes it.
//   status `stopped` + no box id → no runtime: the box was deleted (or never
//                                  created). Configs and keys are kept; Start
//                                  creates a fresh box and reinstalls the MCPs.
//
// Local-agent servers never have a box: `stopped` there means the agent is
// offline, nothing to pause or delete.
//
// Pure: no I/O, safe to import from client components. Unit-tested in
// src/__tests__/server-lifecycle.test.ts.

import type { HostType, ServerStatus } from "@/db/schema/platform";

export type LifecycleState =
  | "provisioning"
  | "running"
  | "paused"
  | "no_runtime"
  | "agent_offline"
  | "error"
  | "destroyed";

export interface LifecycleInput {
  status: ServerStatus;
  hostType: HostType;
  boxId: string | null;
}

export function lifecycleState({ status, hostType, boxId }: LifecycleInput): LifecycleState {
  if (status !== "stopped") return status;
  if (hostType === "local_agent") return "agent_offline";
  return boxId ? "paused" : "no_runtime";
}

/** A box-hosted server that is paused and can be woken in place. */
export function isPausedRuntime(input: LifecycleInput): boolean {
  return lifecycleState(input) === "paused";
}

export interface LifecycleActions {
  /** Wake a paused box (data kept). */
  resume: boolean;
  /** Create a runtime (none exists, or the last one failed). */
  start: boolean;
  /** Pause the box, keeping its data. */
  pause: boolean;
  /** Recreate the runtime from the saved configs. */
  restart: boolean;
  /** Destroy the box and its data, keeping configs. */
  deleteRuntime: boolean;
}

/** Which lifecycle buttons make sense for a server right now. */
export function lifecycleActions(input: LifecycleInput): LifecycleActions {
  const state = lifecycleState(input);
  const box = input.hostType !== "local_agent";
  const hasBox = box && !!input.boxId;
  return {
    resume: state === "paused",
    start: box && (state === "no_runtime" || state === "error"),
    pause: box && state === "running" && hasBox,
    restart: box && state === "running",
    // Also offered while provisioning, as the old Stop was: the way out of a
    // runtime stuck mid-install.
    deleteRuntime: hasBox && state !== "destroyed",
  };
}

/**
 * The typed confirmation for "Delete runtime": the exact server name, ignoring
 * surrounding whitespace. Case-sensitive on purpose — it must be deliberate.
 */
export function deleteRuntimeConfirmed(typed: string, serverName: string): boolean {
  const want = serverName.trim();
  return want.length > 0 && typed.trim() === want;
}

/** What "Delete runtime" destroys, shown verbatim in the confirm dialog. */
export const DELETE_RUNTIME_LOSES = [
  "The Upstash Box and everything on its disk: installed packages and any files your MCPs wrote there.",
  "The MCP logs stored in the box.",
  "The current MCP endpoint tokens. Your TwinMCP URLs and API keys keep working once you Start again.",
] as const;

/** What "Delete runtime" keeps. */
export const DELETE_RUNTIME_KEEPS =
  "The server, its installed MCP list, their saved configuration and your API keys are kept. Start creates a fresh box and reinstalls the MCPs.";

/** Box statuses (from the Upstash API) that mean the box no longer exists. */
const GONE_STATUSES = new Set(["deleted", "terminated", "failed", "error"]);

/**
 * Does this box status, or this error thrown by a box call, prove the box is
 * gone for good? Conservative: a transient network error is NOT "gone", so a
 * flaky status call can never trigger a recreate (which would lose data).
 */
export function isRuntimeGone(statusOrError: unknown): boolean {
  if (typeof statusOrError === "string") return GONE_STATUSES.has(statusOrError);
  if (!statusOrError || typeof statusOrError !== "object") return false;
  const e = statusOrError as { statusCode?: unknown; message?: unknown };
  if (e.statusCode === 404 || e.statusCode === 410) return true;
  return typeof e.message === "string" && /\b(has been deleted|not found)\b/i.test(e.message);
}

/**
 * After box.pause() failed: what to do, decided from the box STATUS probe
 * (the string getStatus returned, or the error it threw) and never from the
 * pause error itself — a pause endpoint answering 404 for a live box must not
 * be read as "the box is gone".
 *   already_paused  the idle lifecycle paused it first: nothing to do
 *   forget          the box is provably gone: clear it in the DB (no deleteBox)
 *   stop_bridges    the box is alive but refused (keep-alive): stop serving
 */
export function pauseFailureAction(status: unknown): "already_paused" | "forget" | "stop_bridges" {
  if (status === "paused") return "already_paused";
  if (isRuntimeGone(status)) return "forget";
  return "stop_bridges";
}
