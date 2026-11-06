// The scheduler's job table: one entry per /api/cron/* route, calling the
// same library functions in-process (never over HTTP). The routes stay as
// manual / override triggers (Bearer CRON_SECRET or an admin session).
//
// Modules are imported lazily, as lib/queue/qstash.ts does: this table is
// cheap to import (tests, /api/health) and a job's dependencies load only
// when it first runs.

import { type Schedule } from "./schedule";

export interface JobOutcome {
  /** One short line for the log and /api/health (counts only, no personal data). */
  summary: string;
  /** False when the run completed with partial errors. Defaults to true. */
  ok?: boolean;
  /** Run again this soon (batched work left over), instead of the next slot. */
  followUpMs?: number;
}

export interface JobDef {
  /** Same name as the /api/cron/<name> route. */
  name: string;
  schedule: Schedule;
  /** The run is reported as failed past this; the work itself cannot be cancelled. */
  timeoutMs: number;
  run: () => Promise<JobOutcome>;
}

const MIN = 60_000;

async function meterBoxes(): Promise<JobOutcome> {
  const { runMeterBoxes } = await import("@/lib/wallet/compute-meter");
  const r = await runMeterBoxes();
  return {
    ok: r.errors === 0,
    summary: `${r.metered}/${r.boxes} box(es), ${r.charged} charge(s), ${r.errors} error(s)${r.skipped ? ` (skipped: ${r.skipped})` : ""}`,
  };
}

async function walletEnforce(): Promise<JobOutcome> {
  const { runWalletEnforce, isEnforcementEnabled } = await import("@/lib/wallet/compute-meter");
  const r = await runWalletEnforce({ dryRun: false, destructive: isEnforcementEnabled() });
  // Auto-recharges a transient Stripe error left undone (same as the route).
  const { retryDueAutoRecharges } = await import("@/lib/wallet/auto-recharge");
  let retried: number | string = 0;
  try {
    retried = await retryDueAutoRecharges();
  } catch (err) {
    console.error("[scheduler] wallet-enforce: auto-recharge retry failed:", err);
    retried = "failed";
  }
  // Pending auto-recharge reconciliation (runWalletEnforce, never a dry run
  // here): null means it threw, which counts as a failure.
  const ar = r.autoRecharge;
  const reconcile = ar
    ? `${ar.checked} checked/${ar.credited} credited/${ar.failed} failed/${ar.cleared} cleared/${ar.errors} err`
    : "failed";
  return {
    ok: r.errors === 0 && retried !== "failed" && ar !== null && ar.errors === 0,
    summary: `${r.destructive ? "" : "(pause only) "}${r.users} user(s), ${r.paused} paused, ${r.deleted} runtime(s) deleted, ${r.warnings} warning(s), ${r.killSwitches} kill switch(es), auto-recharge retried ${retried}, reconcile ${reconcile}, ${r.errors} error(s)`,
  };
}

// Writes off expired promo credit (the "wallet-expiry" QStash job). The 7-day
// and 2-day expiry reminders are sent by wallet-reminders at 08:00 UTC rather
// than hourly, so nobody gets them in the middle of the night; notify.ts
// dedups them either way.
async function walletExpiry(): Promise<JobOutcome> {
  const { expirePromos } = await import("@/lib/wallet/ledger");
  const r = await expirePromos(new Date());
  return {
    summary: `${r.expired} promo balance(s) expired${r.truncated ? " (truncated, continuing)" : ""}`,
    followUpMs: r.truncated ? 5 * MIN : undefined,
  };
}

async function walletReminders(): Promise<JobOutcome> {
  const { expirePromos } = await import("@/lib/wallet/ledger");
  const { runWalletReminders } = await import("@/lib/billing/nudge-job");
  // A failed write-off must not cost the reminders (same as the route).
  let expired = "expire failed";
  try {
    const e = await expirePromos(new Date());
    expired = `${e.expired} expired${e.truncated ? " (truncated)" : ""}`;
  } catch (err) {
    console.error("[scheduler] wallet-reminders: expirePromos failed:", err);
  }
  const r = await runWalletReminders({ dryRun: false });
  return {
    ok: r.errors === 0 && expired !== "expire failed",
    summary: `${expired}; ${r.scanned} scanned, ${r.sent} sent, ${r.dropped} dropped, ${r.errors} error(s)${r.skipped ? ` (skipped: ${r.skipped})` : ""}`,
  };
}

async function purge(): Promise<JobOutcome> {
  const { purgeExpiredRecords } = await import("@/lib/activity/purge");
  const r = await purgeExpiredRecords();
  return {
    summary: `${r.toolCalls} tool call(s), ${r.auditLogs} audit row(s), ${r.webhookDeliveries} webhook deliver(ies)${r.truncated ? " (truncated, continuing)" : ""}`,
    followUpMs: r.truncated ? 15 * MIN : undefined,
  };
}

async function nudges(): Promise<JobOutcome> {
  const { runUpgradeNudges } = await import("@/lib/billing/nudge-job");
  const r = await runUpgradeNudges({ dryRun: false });
  return {
    ok: r.errors === 0,
    summary: `${r.scanned} scanned, ${r.sent} sent, ${r.dropped} dropped, ${r.errors} error(s)${r.skipped ? ` (skipped: ${r.skipped})` : ""}`,
  };
}

/** Admin digest recipient, as the /api/cron/digest and /api/cron/churn routes pick it. */
async function adminRecipient(): Promise<string | undefined> {
  const { adminEmails } = await import("@/lib/admin");
  return process.env.DIGEST_EMAIL ?? adminEmails()[0];
}

async function digest(): Promise<JobOutcome> {
  if (!process.env.RESEND_API_KEY) return { summary: "skipped: RESEND_API_KEY not set" };
  const to = await adminRecipient();
  if (!to) return { summary: "skipped: no DIGEST_EMAIL / ADMIN_EMAILS" };
  const { computeAttention } = await import("@/lib/admin/attention");
  const { buildDigestEmail } = await import("@/lib/admin/digest-email");
  const { sendAdminDigest } = await import("@/lib/email");
  const data = await computeAttention();
  const { subject, html } = buildDigestEmail(data);
  await sendAdminDigest(to, subject, html);
  return { summary: `sent (${data.counts.total} item(s))` };
}

async function churn(): Promise<JobOutcome> {
  // Without a sender or a recipient, nothing is recorded as alerted: the
  // clients stay eligible for the first run that can actually email.
  if (!process.env.RESEND_API_KEY) return { summary: "skipped: RESEND_API_KEY not set" };
  const to = await adminRecipient();
  if (!to) return { summary: "skipped: no DIGEST_EMAIL / ADMIN_EMAILS" };
  const { runChurnAlerts } = await import("./churn");
  const r = await runChurnAlerts(to);
  return { summary: `${r.alerted} alerted of ${r.atRisk} at risk` };
}

// Re-enqueues MCP installs that never completed (lost or rejected
// install-mcp jobs), with a small per-row attempt budget.
async function repairInstalls(): Promise<JobOutcome> {
  const { runRepairInstalls } = await import("@/lib/mcp/repair-installs");
  const r = await runRepairInstalls();
  return {
    ok: r.errors === 0,
    summary: `${r.stuck} stuck install(s), ${r.requeued} re-queued, ${r.exhausted} out of retries, ${r.errors} error(s)`,
  };
}

export const JOBS: readonly JobDef[] = [
  // Compute billing: a stopped meter means compute is used without being billed.
  {
    name: "meter-boxes",
    schedule: { kind: "every", minutes: 5 },
    timeoutMs: 4 * MIN,
    run: meterBoxes,
  },
  // 2 minutes after a meter slot, so it acts on fresh balances.
  {
    name: "wallet-enforce",
    schedule: { kind: "every", minutes: 10, offsetMinutes: 2 },
    timeoutMs: 7 * MIN,
    run: walletEnforce,
  },
  {
    name: "wallet-expiry",
    schedule: { kind: "every", minutes: 60, offsetMinutes: 17 },
    timeoutMs: 5 * MIN,
    run: walletExpiry,
  },
  {
    name: "purge",
    schedule: { kind: "daily", hour: 3, minute: 30 },
    timeoutMs: 5 * MIN,
    run: purge,
  },
  // TODO.md cadence: digest 07:00, churn 08:00, nudges 09:00 UTC. Churn moves
  // to 08:10 so it does not start with wallet-reminders.
  {
    name: "digest",
    schedule: { kind: "daily", hour: 7, minute: 0 },
    timeoutMs: 3 * MIN,
    run: digest,
  },
  {
    name: "wallet-reminders",
    schedule: { kind: "daily", hour: 8, minute: 0 },
    timeoutMs: 15 * MIN,
    run: walletReminders,
  },
  {
    name: "churn",
    schedule: { kind: "daily", hour: 8, minute: 10 },
    timeoutMs: 5 * MIN,
    run: churn,
  },
  {
    name: "nudges",
    schedule: { kind: "daily", hour: 9, minute: 0 },
    timeoutMs: 15 * MIN,
    run: nudges,
  },
  // A lost install leaves an MCP on "still installing" for ever.
  {
    name: "repair-installs",
    schedule: { kind: "every", minutes: 10, offsetMinutes: 6 },
    timeoutMs: 3 * MIN,
    run: repairInstalls,
  },
];
