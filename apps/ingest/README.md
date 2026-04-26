# @twinmcp/ingest

Ingestion worker: scrape GitHub repos → chunk markdown → embed → store in Postgres.

## Env

Requires the same env as `apps/backend` plus:

```
DATABASE_URL_UNPOOLED=...           # direct Postgres (NOT the PgBouncer pooler)
OPENAI_API_KEY=...
GITHUB_TOKEN=ghp_...                # optional but recommended (5000 req/h vs 60)
REDIS_URL=redis://...               # full URL (not Upstash REST) for BullMQ
INGEST_CONCURRENCY=2
```

Copy values from the repo root `.env.example` / your Supabase dashboard.

## One-shot ingestion

```bash
pnpm --filter @twinmcp/ingest ingest -- --repo vercel/next.js
pnpm --filter @twinmcp/ingest ingest -- --all --limit 5
```

## Worker + scheduler (Railway)

```bash
# Schedule weekly reindexing of every seed library
pnpm --filter @twinmcp/ingest seed

# Start the worker (in a long-running process)
pnpm --filter @twinmcp/ingest worker
```

## Pipeline

1. `fetchRepoMeta` — GitHub repo metadata (stars, pushed_at, contributors)
2. `computeTrustScore` — 0-10 score from popularity + recency + maturity + community
3. `downloadTarball` → `fetchRepoDocs` — extract all `*.md` / `*.mdx` under 512 KB
4. `chunkMarkdown` — split by headings, pack to ~500 tokens with 50-token overlap
5. `countCodeSnippets` — count fenced code blocks per file
6. `embedBatch` — OpenAI `text-embedding-3-small`, batched 96 at a time
7. Bulk insert into `libraries`, `documents`, `chunks`

## Notes

- Uses the **direct** Postgres connection (port 5432, `DATABASE_URL_UNPOOLED`). PgBouncer transaction mode breaks `INSERT ... RETURNING` batches at scale.
- BullMQ uses IORedis (full Redis protocol), distinct from the Upstash REST client used by the backend.
- Schema is imported via TS path alias `@schema` → `apps/backend/src/db/schema.ts`. Keep it in sync; do not duplicate.
