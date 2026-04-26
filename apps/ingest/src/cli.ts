import "dotenv/config";
import { ingestRepo } from "./ingest";
import { SEED_LIBRARIES } from "./libraries";
import { client } from "./db";

interface Args {
  repo?: string;
  all?: boolean;
  limit?: number;
}

function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--repo") out.repo = argv[++i];
    else if (a === "--all") out.all = true;
    else if (a === "--limit") out.limit = Number(argv[++i]);
    else if (a === "-h" || a === "--help") {
      console.log(`Usage:
  pnpm ingest --repo owner/name     Ingest a single repo
  pnpm ingest --all [--limit N]     Ingest the seed list (optionally capped)
`);
      process.exit(0);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.repo) {
    const [owner, repo] = args.repo.split("/");
    if (!owner || !repo) throw new Error("--repo must be owner/name");
    const res = await ingestRepo({ owner, repo });
    console.log(JSON.stringify(res, null, 2));
    return;
  }

  if (args.all) {
    const seeds = args.limit ? SEED_LIBRARIES.slice(0, args.limit) : SEED_LIBRARIES;
    console.log(`[cli] ingesting ${seeds.length} libraries`);
    for (const s of seeds) {
      try {
        await ingestRepo(s);
      } catch (err) {
        console.error(`[cli] ${s.owner}/${s.repo} failed:`, err);
      }
    }
    return;
  }

  console.error("Nothing to do. Use --repo or --all. See --help.");
  process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end({ timeout: 5 });
  });
