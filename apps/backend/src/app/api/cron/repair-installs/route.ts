import { createHash, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { serverError } from "@/lib/errors";
import { runRepairInstalls } from "@/lib/mcp/repair-installs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Re-enqueues MCP installs that never completed (enabled, no bridge
// endpoint, on a running box server, older than 15 minutes), with a small
// per-row attempt budget (lib/mcp/repair-installs.ts). The in-app scheduler
// runs it every 10 minutes; this route is the manual trigger.
//
// Auth: Bearer CRON_SECRET (constant-time compare) on POST or GET; an admin
// session on POST only (a state-changing GET with cookie auth could be
// triggered by any link).

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function hasCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`);
}

async function run() {
  try {
    return NextResponse.json({ ok: true, ...(await runRepairInstalls()) });
  } catch (err) {
    console.error("[cron/repair-installs]", err);
    return serverError("Install repair run failed.");
  }
}

export async function POST(req: NextRequest) {
  if (!hasCronSecret(req)) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
  }
  return run();
}

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) {
    return NextResponse.json(
      { message: "Bearer CRON_SECRET required (admins: use POST)." },
      { status: 401 }
    );
  }
  return run();
}
