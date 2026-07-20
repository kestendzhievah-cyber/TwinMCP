import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { badRequest, rateLimited, serverError } from "@/lib/errors";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { clientIp } from "@/lib/audit/log";
import { sendSalesInquiry } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public (unauthenticated) — enterprise prospects aren't logged in.
const schema = z.object({
  company: z.string().min(1).max(200),
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  users: z.coerce.number().int().min(1).max(1_000_000),
  message: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  // Spam guard: rate-limit by IP (fails open if Upstash Redis isn't configured).
  const ip = clientIp(req) ?? "unknown";
  const rl = await checkAuthWriteLimit(ip, "contact-sales");
  if (!rl.ok) return rateLimited(true);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Please fill in the required fields.");

  try {
    await sendSalesInquiry(parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never lose a lead: if email delivery isn't configured/working, capture the
    // full inquiry so it's recoverable from observability.
    console.error("[contact-sales] delivery failed:", err);
    Sentry.captureException(err, {
      tags: { area: "contact-sales" },
      extra: { inquiry: parsed.data },
    });
    return serverError("Could not send your message. Please email hello@twinmcp.fr directly.");
  }
}
