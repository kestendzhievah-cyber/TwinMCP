import { randomUUID } from "crypto";
import { getDb } from "@/db";
import { auditLog } from "@/db/schema";

export type AuditAction =
  | "api_key.create"
  | "api_key.revoke"
  | "plan.upgrade"
  | "plan.downgrade"
  | "plan.cancel"
  | "session.signin"
  | "session.signup"
  | "user.password_reset";

export interface AuditEntry {
  userId: string | null;
  action: AuditAction;
  target?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only audit logger. Fire-and-forget: never throws upstream, never
 * blocks the request. A failed audit row is logged to console (Sentry will
 * pick it up) but does not affect the caller's response.
 */
export function audit(entry: AuditEntry): void {
  const row = {
    id: randomUUID(),
    userId: entry.userId,
    action: entry.action,
    target: entry.target ?? null,
    ip: entry.ip ?? null,
    userAgent: entry.userAgent ?? null,
    metadata: entry.metadata ?? {},
  };

  void getDb()
    .insert(auditLog)
    .values(row)
    .catch((err) => {
      console.error("[audit] failed to persist", entry.action, err);
    });
}

/** Helper to pull IP / UA from a Next.js request without coupling callers. */
export function auditCtxFromRequest(req: Request): { ip: string | null; userAgent: string | null } {
  return {
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
    userAgent: req.headers.get("user-agent"),
  };
}
