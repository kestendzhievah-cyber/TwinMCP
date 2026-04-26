import "dotenv/config";
import { getQueue } from "./queue";
import { SEED_LIBRARIES } from "./libraries";

const WEEKLY_CRON = "0 3 * * 0"; // Sundays 03:00 UTC

async function main() {
  const q = getQueue();
  for (const s of SEED_LIBRARIES) {
    const jobId = `${s.owner}/${s.repo}`;
    await q.upsertJobScheduler(
      `reindex:${jobId}`,
      { pattern: WEEKLY_CRON },
      {
        name: "reindex",
        data: s,
        opts: { attempts: 2, backoff: { type: "exponential", delay: 60_000 } },
      }
    );
    console.log(`[seed] scheduled ${jobId}`);
  }
  await q.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
