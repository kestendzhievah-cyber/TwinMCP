import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, gte, inArray } from "drizzle-orm";
import * as Sentry from "@sentry/nextjs";
import { getDb } from "@/db";
import { prospects } from "@/db/schema";
import { badRequest, jsonError, serverError } from "@/lib/errors";
import { checkAuthWriteLimit } from "@/lib/auth/rate-limit";
import { trustedClientIp } from "@/lib/net/client-ip";
import { sendDemoRequestAcknowledgement, sendDemoRequestNotification } from "@/lib/email";
import {
  DEMO_DEDUPE_WINDOW_MS,
  DEMO_HOURLY_CAP,
  DEMO_SOURCES,
  appendDemoNote,
  demoCompanyLabel,
  demoInvalidFields,
  demoRequestNotes,
  demoRequestSchema,
  demoRequestSource,
  isHoneypotFilled,
  isRecentDemoRequest,
} from "@/lib/sales/demo-request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public (unauthenticated): the guided-setup / DPA / security request form on
// /demo and /fr/demo (components/marketing/demo-request-form.tsx).
//
// Order: rate limit (IP) → honeypot → validation → rate limit (email) →
// per-address dedupe + global hourly cap (DB) → CRM → internal email →
// acknowledgement. The request is stored in the prospection CRM first: email
// delivery is best-effort (Resend may be unconfigured) and a request must never
// be lost or answered with a 500 when the DB has it.
//
// Abuse: the acknowledgement goes to whatever address was typed. The Redis
// limits fail open (Redis down = no limit), so the guards that bound it live in
// the DB: one CRM row and one acknowledgement per address per 24 h, and at most
// DEMO_HOURLY_CAP new requests per hour overall.

function tooMany(reset: number) {
  const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  const res = jsonError(429, "Too many requests. Please try again in a few minutes.", {
    retryAfter,
  });
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

export async function POST(req: NextRequest) {
  // Spam guard: rate-limit by IP — X-Real-Ip / the right-most forwarded hop,
  // never the client-controlled left-most one (fails open without Redis).
  const ip = trustedClientIp(req) ?? "unknown";
  const rl = await checkAuthWriteLimit(ip, "contact-sales");
  if (!rl.ok) return tooMany(rl.reset);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  // A filled honeypot is a bot: answer like a success so it learns nothing,
  // and store / send nothing.
  if (isHoneypotFilled(body)) return NextResponse.json({ ok: true });

  const parsed = demoRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please fill in the required fields.", {
      fields: demoInvalidFields(parsed.error.issues),
    });
  }
  const data = parsed.data;

  // Second limit keyed on the address: one address cannot be flooded from many IPs.
  const rlEmail = await checkAuthWriteLimit(`email:${data.email}`, "contact-sales");
  if (!rlEmail.ok) return tooMany(rlEmail.reset);

  const db = getDb();
  const now = Date.now();

  // Redis-independent guards. A DB error here falls through: the insert below
  // fails too and the request still reaches the sales inbox.
  let recent: { id: string; notes: string; createdAt: Date } | undefined;
  let lastHour = 0;
  try {
    [recent] = await db
      .select({ id: prospects.id, notes: prospects.notes, createdAt: prospects.createdAt })
      .from(prospects)
      .where(
        and(
          eq(prospects.email, data.email),
          inArray(prospects.source, [...DEMO_SOURCES]),
          gte(prospects.createdAt, new Date(now - DEMO_DEDUPE_WINDOW_MS))
        )
      )
      .orderBy(desc(prospects.createdAt))
      .limit(1);
    const [c] = await db
      .select({ n: count() })
      .from(prospects)
      .where(
        and(
          inArray(prospects.source, [...DEMO_SOURCES]),
          gte(prospects.createdAt, new Date(now - 60 * 60 * 1000))
        )
      );
    lastHour = Number(c?.n ?? 0);
  } catch (err) {
    console.error("[contact-sales] dedupe lookup failed:", err);
  }

  if (recent && isRecentDemoRequest(recent.createdAt, now)) {
    // Same address within 24 h: add the message to the existing request and
    // send nothing (no second acknowledgement, no second sales email).
    await db
      .update(prospects)
      .set({ notes: appendDemoNote(recent.notes, demoRequestNotes(data)), updatedAt: new Date() })
      .where(eq(prospects.id, recent.id))
      .catch((err) => console.error("[contact-sales] note append failed:", err));
    return NextResponse.json({ ok: true });
  }

  if (lastHour >= DEMO_HOURLY_CAP) return tooMany(now + 15 * 60 * 1000);

  let storedInCrm = false;
  try {
    await db.insert(prospects).values({
      id: randomUUID(),
      // company is NOT NULL in the CRM; DPA / security requests don't ask for it.
      company: demoCompanyLabel(data),
      contactName: data.name,
      email: data.email,
      source: demoRequestSource(data.topic),
      status: "new",
      notes: demoRequestNotes(data),
      // Surface immediately in the "à relancer" list + nav badge.
      nextActionAt: new Date(),
    });
    storedInCrm = true;
  } catch (err) {
    console.error("[contact-sales] prospect insert failed:", err);
    Sentry.captureException(err, { tags: { area: "contact-sales", stage: "crm" } });
  }

  let notified = false;
  try {
    await sendDemoRequestNotification(data);
    notified = true;
  } catch (err) {
    console.error("[contact-sales] internal notification failed:", err);
    // No PII in Sentry: only the non-identifying shape of the request.
    Sentry.captureException(err, {
      tags: { area: "contact-sales", stage: "notify" },
      extra: {
        storedInCrm,
        topic: data.topic,
        teamSize: data.teamSize ?? null,
        locale: data.locale,
        clients: data.clients.length,
      },
    });
  }

  if (!storedInCrm && !notified) {
    return serverError("Could not send your request. Please email hello@twinmcp.fr directly.");
  }

  // The acknowledgement never blocks the answer: the request is already safe.
  let acknowledged = false;
  try {
    await sendDemoRequestAcknowledgement(data.email, data.locale);
    acknowledged = true;
  } catch (err) {
    console.error("[contact-sales] acknowledgement failed:", err);
    Sentry.captureException(err, { tags: { area: "contact-sales", stage: "ack" } });
  }

  return NextResponse.json({ ok: true, acknowledged });
}
