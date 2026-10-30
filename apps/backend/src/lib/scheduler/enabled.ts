// Whether this process should run the in-process scheduler. Pure: the caller
// passes the env, argv and runtime (instrumentation.ts passes
// process.env.NEXT_RUNTIME, which Next inlines per bundle).

export interface SchedulerDecision {
  enabled: boolean;
  reason: string;
}

const OFF = new Set(["0", "false", "off", "no"]);
const ON = new Set(["1", "true", "on", "yes"]);

export function schedulerDecision(
  env: Record<string, string | undefined>,
  argv: readonly string[],
  runtime: string | undefined
): SchedulerDecision {
  const flag = env.INTERNAL_SCHEDULER?.trim().toLowerCase();
  if (flag && OFF.has(flag)) return { enabled: false, reason: "INTERNAL_SCHEDULER disables it" };
  if (runtime !== "nodejs") return { enabled: false, reason: `runtime ${runtime ?? "unknown"}` };
  if (env.VITEST || env.NODE_ENV === "test") return { enabled: false, reason: "test run" };
  // `next build` may load instrumentation while collecting page data.
  if (env.NEXT_PHASE === "phase-production-build") {
    return { enabled: false, reason: "next build" };
  }
  if (argv.some((a) => /(^|[\\/])next(\.js)?$/.test(a)) && argv.includes("build")) {
    return { enabled: false, reason: "next build" };
  }
  if (!env.DATABASE_URL) return { enabled: false, reason: "DATABASE_URL not set" };
  if (flag && ON.has(flag)) return { enabled: true, reason: "INTERNAL_SCHEDULER enables it" };
  // Off unless asked for: the production Docker image sets INTERNAL_SCHEDULER=1.
  // A local `next start` (NODE_ENV=production) with a .env.local that points at
  // the production database must never run billing jobs against it.
  return { enabled: false, reason: "off unless INTERNAL_SCHEDULER=1 (set in the Docker image)" };
}

/** Comma-separated job names to skip (INTERNAL_SCHEDULER_SKIP="digest,churn"). */
export function skippedJobs(env: Record<string, string | undefined>): Set<string> {
  return new Set(
    (env.INTERNAL_SCHEDULER_SKIP ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}
