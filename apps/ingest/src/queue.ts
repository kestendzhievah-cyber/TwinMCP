import IORedis from "ioredis";
import { Queue } from "bullmq";

export const QUEUE_NAME = "twinmcp-ingest";

let _redis: IORedis | null = null;
let _queue: Queue | null = null;

function getRedisUrl(): string {
  const url = process.env.REDIS_URL ?? process.env.INGEST_REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL must be set for the ingestion worker (full redis:// URL)");
  }
  return url;
}

export function getRedis(): IORedis {
  if (_redis) return _redis;
  _redis = new IORedis(getRedisUrl(), { maxRetriesPerRequest: null });
  return _redis;
}

export function getQueue(): Queue {
  if (_queue) return _queue;
  _queue = new Queue(QUEUE_NAME, { connection: getRedis() });
  return _queue;
}

export interface IngestJob {
  owner: string;
  repo: string;
  ref?: string;
}
