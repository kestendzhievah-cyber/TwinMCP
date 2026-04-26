import "dotenv/config";
import { Worker } from "bullmq";
import { QUEUE_NAME, getRedis, type IngestJob } from "./queue";
import { ingestRepo } from "./ingest";

const concurrency = Number(process.env.INGEST_CONCURRENCY ?? 2);

const worker = new Worker<IngestJob>(
  QUEUE_NAME,
  async (job) => {
    const { owner, repo, ref } = job.data;
    return ingestRepo({ owner, repo, ref });
  },
  { connection: getRedis(), concurrency }
);

worker.on("completed", (job, res) => {
  console.log(`[worker] ${job.id} done:`, res);
});
worker.on("failed", (job, err) => {
  console.error(`[worker] ${job?.id} failed:`, err.message);
});

console.log(`[worker] listening on queue "${QUEUE_NAME}" (concurrency=${concurrency})`);

async function shutdown() {
  console.log("[worker] shutting down…");
  await worker.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
