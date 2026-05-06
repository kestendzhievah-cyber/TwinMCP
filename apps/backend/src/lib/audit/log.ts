import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema/platform";

export type AuditAction =
  | "server.create"
  | "server.update"
  | "server.delete"
  | "server.start"
  | "server.stop"
  | "server.restart"
  | "mcp.install"
  | "mcp.uninstall"
  | "mcp.toggle"
  | "mcp.reconfigure"
  | "mcp_server.publish"
  | "mcp_server.update"
  | "mcp_server.delete"
  | "api_key.create"
  | "api_key.revoke"
  | "user.delete";

export type AuditTargetType = "server" | "user_server" | "mcp_server" | "api_key" | "user";

export interface AuditEntry {
  userId: string | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export function logAudit(entry: AuditEntry): void {
  // Fire-and-forget — do not block the response on logging
  void getDb()
    .insert(auditLogs)
    .values({
      id: randomUUID(),
      userId: entry.userId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ?? {},
      ip: entry.ip ?? null,
    })
    .catch((err) => {
      console.error("[audit] insert failed:", err);
    });
}

export function clientIp(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null
  );
}
