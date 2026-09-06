import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { prospects } from "@/db/schema";
import { badRequest, jsonError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public demo-request endpoint: anonymous visitors on /fr/entreprises submit
// here and land straight in the admin prospection pipeline (source "site web").
//
// Lightweight in-process IP throttle — prod is a single container (PRODUCTION.md)
// so this Map is the whole rate limiter; no Redis hop for a low-volume marketing
// form. Fail-open by design.
const HITS = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000; // 1h
const MAX_PER_WINDOW = 5;

function tooMany(ip: string): boolean {
  const now = Date.now();
  const recent = (HITS.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    HITS.set(ip, recent);
    return true;
  }
  recent.push(now);
  HITS.set(ip, recent);
  if (HITS.size > 10_000) HITS.clear(); // crude unbounded-growth guard
  return false;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Honeypot: bots fill hidden fields humans never see. Pretend success, drop.
  if (typeof body.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (tooMany(ip)) return jsonError(429, "Trop de demandes. Réessayez dans une heure.");

  const company = clip(body.company, 200);
  const email = clip(body.email, 200).toLowerCase();
  const contactName = clip(body.contactName, 200);
  const message = clip(body.message, 5000);

  if (!company) return badRequest("company is required");
  if (!EMAIL_RE.test(email)) return badRequest("valid email is required");

  await getDb()
    .insert(prospects)
    .values({
      id: randomUUID(),
      company,
      contactName: contactName || null,
      email,
      source: "Site web (démo)",
      status: "new",
      notes: message,
      // Surface immediately in the "à relancer" list + nav badge so an inbound
      // demo request gets followed up fast.
      nextActionAt: new Date(),
    });

  return NextResponse.json({ ok: true });
}
