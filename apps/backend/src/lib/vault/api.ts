// Shared bits of the /api/v2/secrets routes: request validation and the JSON
// shape of a secret. Values are never part of any response.
import { z } from "zod";
import { jsonError } from "@/lib/errors";
import { SECRET_NAME_RE, SECRET_VALUE_MAX } from "./refs";
import type { SecretSummary } from "./store";
import type { SecretUsage } from "./usage";

export const secretNameSchema = z
  .string()
  .regex(SECRET_NAME_RE, "Name must be 1 to 64 characters: A-Z, 0-9 and _ only.");

export const secretValueSchema = z
  .string()
  .min(1, "Value is required.")
  .max(SECRET_VALUE_MAX, `Value must be at most ${SECRET_VALUE_MAX} characters.`);

export const createSecretSchema = z.object({ name: secretNameSchema, value: secretValueSchema });
export const updateSecretSchema = z.object({ value: secretValueSchema });

export interface SecretJson {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  usedBy: SecretUsage[];
}

export function secretJson(s: SecretSummary, usedBy: SecretUsage[] = []): SecretJson {
  return {
    id: s.id,
    name: s.name,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
    lastUsedAt: s.lastUsedAt ? s.lastUsedAt.toISOString() : null,
    usedBy,
  };
}

/**
 * Names referenced by some MCP config but absent from the vault: those MCPs
 * will not start until the secret is created.
 */
export function danglingRefs(
  usage: ReadonlyMap<string, SecretUsage[]>,
  stored: ReadonlySet<string>
): Array<{ name: string; usedBy: SecretUsage[] }> {
  return [...usage.entries()]
    .filter(([name]) => !stored.has(name))
    .map(([name, usedBy]) => ({ name, usedBy }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** 429 for the secret write routes (checkAuthWriteLimit, fails open without Redis). */
export function secretWriteRateLimited(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return jsonError(
    429,
    "Too many secret changes. Please wait a moment and try again.",
    { retryAfter },
    { "Retry-After": String(retryAfter) }
  );
}
