import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema/platform";
import { trustedClientIp } from "@/lib/net/client-ip";

export type AuditAction =
  | "server.create"
  | "server.update"
  | "server.delete"
  | "server.start"
  | "server.stop"
  | "server.pause"
  | "server.resume"
  | "server.runtime.delete"
  | "server.restart"
  | "mcp.install"
  | "mcp.uninstall"
  | "mcp.toggle"
  | "mcp.reconfigure"
  | "mcp.tool_policy"
  | "admin.server.create"
  | "admin.server.stop"
  | "admin.server.pause"
  | "admin.server.start"
  | "admin.server.delete"
  | "admin.mcp.install"
  | "admin.mcp.uninstall"
  | "admin.churn.alert"
  | "admin.clients.export"
  | "mcp_server.publish"
  | "mcp_server.update"
  | "mcp_server.delete"
  | "api_key.create"
  | "api_key.revoke"
  | "api_key.rotate"
  | "team.member.add"
  | "team.member.remove"
  | "user.delete"
  | "user.onboarding.complete"
  | "secret.create"
  | "secret.update"
  | "secret.delete";

export type AuditTargetType =
  | "server"
  | "user_server"
  | "mcp_server"
  | "api_key"
  | "teamspace"
  | "user"
  | "secret";

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
  return trustedClientIp(req);
}
