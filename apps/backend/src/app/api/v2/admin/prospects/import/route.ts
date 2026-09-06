import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db";
import { prospects } from "@/db/schema";
import { requireAdmin, str, int } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ROWS = 500;

interface ImportRow {
  company?: unknown;
  contactName?: unknown;
  email?: unknown;
  role?: unknown;
  source?: unknown;
  estimatedValueEur?: unknown;
  notes?: unknown;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows.slice(0, MAX_ROWS) : [];

  const values = [];
  for (const r of rows) {
    const company = str(r?.company);
    if (!company) continue; // company is the one hard requirement
    const email = str(r?.email);
    values.push({
      id: randomUUID(),
      company: company.slice(0, 200),
      contactName: str(r?.contactName),
      email: email ? email.toLowerCase() : null,
      role: str(r?.role),
      source: str(r?.source) ?? "Import",
      status: "new" as const,
      estimatedValueEur: int(r?.estimatedValueEur),
      notes: typeof r?.notes === "string" ? r.notes.slice(0, 5000) : "",
      createdBy: admin.userId,
    });
  }

  if (values.length) await getDb().insert(prospects).values(values);

  return NextResponse.json({ inserted: values.length, skipped: rows.length - values.length });
}
