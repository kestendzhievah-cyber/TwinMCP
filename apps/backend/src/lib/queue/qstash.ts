import { Client, Receiver } from "@upstash/qstash";
import {
  provisionServer,
  destroyServerRuntime,
  installMcpInBox,
  uninstallMcpFromBox,
  disableMcp,
  reconfigureMcp,
} from "@/lib/provisioning";
import { reconcileServerHealth } from "@/lib/health";
import { runUpgradeNudges } from "@/lib/billing/nudge-job";

export type Job =
  | { type: "provision-server"; serverId: string }
  | { type: "destroy-server"; serverId: string }
  | { type: "install-mcp"; userServerId: string }
  | {
      type: "uninstall-mcp";
      boxId: string | null;
      serverId: string;
      slug: string;
      port: number | null;
    }
  | { type: "disable-mcp"; userServerId: string }
  | { type: "reconfigure-mcp"; userServerId: string }
  | { type: "reconcile-health" }
  // Daily Free → Pro nudge emails (schedule it once a day, see TODO.md).
  | { type: "upgrade-nudges" }
  // Daily retention purge: tool-call activity + audit log (lib/activity/purge.ts).
  | { type: "purge-retention" }
  // One outbound webhook delivery attempt (lib/webhooks/deliver.ts). Retries
  // are scheduled by deliver.ts itself (enqueue with delaySeconds).
  | { type: "webhook-deliver"; deliveryId: string }
  // Prepaid wallet (schedule each with a QStash cron, see TODO.md):
  // every 5 min — bill box compute from the Upstash usage counters.
  | { type: "meter-boxes" }
  // every 5 min, after meter-boxes — pause boxes at zero balance / promo caps,
  // promo-only deletion countdown.
  | { type: "wallet-enforce" }
  // hourly — write off expired promotional credit.
  | { type: "wallet-expiry" };

const JOB_PATH = "/api/jobs/run";

let _client: Client | null = null;
function getClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null;
  if (!_client) _client = new Client({ token: process.env.QSTASH_TOKEN });
  return _client;
}

let _receiver: Receiver | null = null;
export function getReceiver(): Receiver | null {
  if (!process.env.QSTASH_CURRENT_SIGNING_KEY) return null;
  if (!_receiver) {
    _receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? "",
    });
  }
  return _receiver;
}

export function isQueueEnabled(): boolean {
  return !!process.env.QSTASH_TOKEN && !!process.env.APP_URL;
}

/**
 * Enqueue a job for async execution.
 * - In production with QSTASH_TOKEN + APP_URL set: publishes to QStash, which retries on failure.
 * - Otherwise: runs inline as a fire-and-forget promise (dev / no-queue mode).
 *   Inline mode is fine for long-lived processes (next dev) but unsafe on serverless
 *   where the lambda may be killed before the job completes.
 */
export async function enqueue(
  job: Job,
  // Optional: run the job no sooner than this many seconds from now (QStash
  // `delay`; a process-local timer in inline mode, lost on restart).
  opts: { delaySeconds?: number } = {}
): Promise<{ mode: "queued" | "inline"; messageId?: string }> {
  const client = getClient();
  const appUrl = process.env.APP_URL;
  const delaySeconds = Math.max(0, Math.round(opts.delaySeconds ?? 0));

  if (client && appUrl) {
    const res = await client.publishJSON({
      url: `${appUrl.replace(/\/$/, "")}${JOB_PATH}`,
      body: job,
      retries: 3,
      ...(delaySeconds > 0 ? { delay: delaySeconds } : {}),
    });
    return { mode: "queued", messageId: res.messageId };
  }

  // Inline fallback — fire and forget
  const run = () =>
    void runJob(job).catch((err) => {
      console.error(`[queue] inline job ${job.type} failed:`, err);
    });
  if (delaySeconds > 0) setTimeout(run, delaySeconds * 1000).unref?.();
  else run();
  return { mode: "inline" };
}

export async function runJob(job: Job): Promise<void> {
  switch (job.type) {
    case "provision-server":
      await provisionServer(job.serverId);
      return;
    case "destroy-server":
      // destroyServerRuntime meters the box (final usage snapshot + debit)
      // before deleteBox: a deleted box loses its usage counters.
      await destroyServerRuntime(job.serverId);
      return;
    case "install-mcp":
      await installMcpInBox(job.userServerId);
      return;
    case "uninstall-mcp":
      await uninstallMcpFromBox({
        boxId: job.boxId,
        serverId: job.serverId,
        slug: job.slug,
        port: job.port,
      });
      return;
    case "disable-mcp":
      await disableMcp(job.userServerId);
      return;
    case "reconfigure-mcp":
      await reconfigureMcp(job.userServerId);
      return;
    case "reconcile-health":
      await reconcileServerHealth();
      return;
    case "upgrade-nudges":
      await runUpgradeNudges();
      return;
    case "purge-retention": {
      const { purgeExpiredRecords } = await import("@/lib/activity/purge");
      const r = await purgeExpiredRecords();
      console.info(
        `[queue] purge-retention: ${r.toolCalls} tool call(s), ${r.auditLogs} audit row(s), ${r.webhookDeliveries} webhook deliver(ies)${r.truncated ? " (truncated)" : ""}`
      );
      return;
    }
    case "webhook-deliver": {
      // Never throws: a failed attempt schedules its own retry, so a QStash
      // retry on top would double-send.
      const { deliverWebhook } = await import("@/lib/webhooks/deliver");
      await deliverWebhook(job.deliveryId);
      return;
    }
    case "meter-boxes": {
      const { runMeterBoxes } = await import("@/lib/wallet/compute-meter");
      const r = await runMeterBoxes();
      console.info(
        `[queue] meter-boxes: ${r.metered}/${r.boxes} box(es), ${r.charged} charge(s), ${r.errors} error(s)${r.skipped ? ` (skipped: ${r.skipped})` : ""}`
      );
      return;
    }
    case "wallet-enforce": {
      const { runWalletEnforce } = await import("@/lib/wallet/compute-meter");
      const r = await runWalletEnforce();
      // Auto-recharges a transient Stripe error left undone.
      const { retryDueAutoRecharges } = await import("@/lib/wallet/auto-recharge");
      await retryDueAutoRecharges().catch((err) =>
        console.error("[queue] auto-recharge retry failed:", err)
      );
      console.info(
        `[queue] wallet-enforce${r.destructive ? "" : " (pause only)"}: ${r.users} user(s), ${r.paused} paused, ${r.deleted} runtime(s) deleted, ${r.warnings} warning(s), ${r.killSwitches} kill switch(es), ${r.errors} error(s)`
      );
      return;
    }
    case "wallet-expiry": {
      const { expirePromos } = await import("@/lib/wallet/ledger");
      const r = await expirePromos();
      console.info(
        `[queue] wallet-expiry: ${r.expired} promo balance(s) expired${r.truncated ? " (truncated)" : ""}`
      );
      return;
    }
    default: {
      const exhaustive: never = job;
      throw new Error(`Unknown job type: ${JSON.stringify(exhaustive)}`);
    }
  }
}
