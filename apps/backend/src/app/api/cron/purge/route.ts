import { createHash, timingSafeEqual } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/prospects-lib";
import { purgeExpiredRecords } from "@/lib/activity/purge";
import { serverError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily retention purge: tool-call activity past the owner's plan retention
// (Free 7 days, Pro 90) and audit-log rows past the plan's audit retention
// (90 days). Schedule it once a day (POST with Authorization: Bearer
// <CRON_SECRET>), or the "purge-retention" QStash job. Batched and time-boxed:
// `truncated: true` means the next run continues.
//
// Auth: Bearer CRON_SECRET (constant-time compare) on POST or GET; an admin
// session on POST only — a state-changing GET with cookie auth could be
// triggered by any link (SameSite=Lax cookies ride top-level navigations).

/** Constant-time equality of two strings (SHA-256 digests, so lengths never leak). */
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

async function purge() {
  try {
    const result = await purgeExpiredRecords();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/purge]", err);
    return serverError("Retention purge failed.");
  }
}

export async function POST(req: NextRequest) {
  if (!hasCronSecret(req)) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
  }
  return purge();
}

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) {
    return NextResponse.json(
      { message: "Bearer CRON_SECRET required (admins: use POST)." },
      { status: 401 }
    );
  }
  return purge();
}
