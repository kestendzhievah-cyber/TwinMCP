import { Client, Receiver } from "@upstash/qstash";
import { provisionServer, destroyServerRuntime, installMcpInBox } from "@/lib/provisioning";

export type Job =
  | { type: "provision-server"; serverId: string }
  | { type: "destroy-server"; serverId: string }
  | { type: "install-mcp"; userServerId: string };

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
export async function enqueue(job: Job): Promise<{ mode: "queued" | "inline"; messageId?: string }> {
  const client = getClient();
  const appUrl = process.env.APP_URL;

  if (client && appUrl) {
    const res = await client.publishJSON({
      url: `${appUrl.replace(/\/$/, "")}${JOB_PATH}`,
      body: job,
      retries: 3,
    });
    return { mode: "queued", messageId: res.messageId };
  }

  // Inline fallback — fire and forget
  void runJob(job).catch((err) => {
    console.error(`[queue] inline job ${job.type} failed:`, err);
  });
  return { mode: "inline" };
}

export async function runJob(job: Job): Promise<void> {
  switch (job.type) {
    case "provision-server":
      await provisionServer(job.serverId);
      return;
    case "destroy-server":
      await destroyServerRuntime(job.serverId);
      return;
    case "install-mcp":
      await installMcpInBox(job.userServerId);
      return;
    default: {
      const exhaustive: never = job;
      throw new Error(`Unknown job type: ${JSON.stringify(exhaustive)}`);
    }
  }
}
