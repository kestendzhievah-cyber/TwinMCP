import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { trustedClientIp } from "@/lib/net/client-ip";

export type AuditAction =
  | "api_key.create"
  | "api_key.revoke"
  | "api_key.rotate"
  | "plan.upgrade"
  | "plan.downgrade"
  | "plan.cancel"
  | "subscription.cancel_scheduled"
  | "trial.converted"
  | "payment.failed"
  | "session.signin"
  | "session.signup"
  | "user.password_reset";

export type AuditTargetType = "api_key" | "subscription" | "oauth_provider" | "user" | "none";

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
    ip: trustedClientIp(req),
    userAgent: req.headers.get("user-agent"),
  };
}
