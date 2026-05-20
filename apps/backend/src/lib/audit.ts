import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";

export type AuditAction =
  | "api_key.create"
  | "api_key.revoke"
  | "plan.upgrade"
  | "plan.downgrade"
  | "plan.cancel"
  | "session.signin"
  | "session.signup"
  | "user.password_reset";

export type AuditTargetType =
  | "api_key"
  | "subscription"
  | "oauth_provider"
  | "user"
  | "none";

export interface AuditEntry {
  userId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  ip?: string | null;
  /** Free-form structured context. user-agent goes here under `userAgent`. */
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit logger. Fire-and-forget: never throws upstream, never
 * blocks the request. A failed audit row is logged to console (Sentry will
 * pick it up) but does not affect the caller's response.
 *
 * Stores into the existing `audit_logs` table from db/schema/platform.ts.
 */
export function audit(entry: AuditEntry): void {
  const row = {
    id: randomUUID(),
    userId: entry.userId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    ip: entry.ip ?? null,
    metadata: entry.metadata ?? {},
  };

  void getDb()
    .insert(auditLogs)
    .values(row)
    .catch((err) => {
      console.error("[audit] failed to persist", entry.action, err);
    });
}

/** Pull IP / user-agent from a request without coupling callers to Next types. */
export function auditCtxFromRequest(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent"),
  };
}
