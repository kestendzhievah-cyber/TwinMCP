import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { usageEvents } from "@/db/schema";

export interface UsageEventInput {
  userId?: string;
  apiKeyId?: string;
  endpoint: string;
  libraryId?: string;
  latencyMs: number;
  statusCode: number;
}

export function logUsage(event: UsageEventInput): void {
  const row = {
    id: randomUUID(),
    userId: event.userId ?? null,
    apiKeyId: event.apiKeyId ?? null,
    endpoint: event.endpoint,
    libraryId: event.libraryId ?? null,
    latencyMs: event.latencyMs,
    statusCode: event.statusCode,
  };
  getDb()
    .insert(usageEvents)
    .values(row)
    .catch((err) => {
      console.error("[usage] failed to log event", err);
    });
}
