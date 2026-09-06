import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects, prospectStatuses, users, type ProspectStatus } from "@/db/schema";
import { badRequest } from "@/lib/errors";
import { requireAdmin, str, int } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const db = getDb();
  const rows = await db.select().from(prospects).orderBy(desc(prospects.createdAt));

  // Flag prospects whose email already has a TwinMCP account — a live conversion
  // signal ("this lead signed up"). One query, case-insensitive match.
  const emails = [
    ...new Set(
      rows
        .map((p) => p.email)
        .filter((e): e is string => !!e)
        .map((e) => e.toLowerCase())
    ),
  ];
  let accounts = new Set<string>();
  if (emails.length) {
    const found = await db
      .select({ email: users.email })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, emails));
    accounts = new Set(found.map((r) => (r.email ?? "").toLowerCase()));
  }

  const items = rows.map((p) => ({
    ...p,
    hasAccount: p.email ? accounts.has(p.email.toLowerCase()) : false,
  }));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const body = await req.json().catch(() => ({}));
  const company = str(body.company);
  if (!company) return badRequest("company is required");

  const status: ProspectStatus = (prospectStatuses as readonly string[]).includes(body.status)
    ? (body.status as ProspectStatus)
    : "new";

  const [row] = await getDb()
    .insert(prospects)
    .values({
      id: randomUUID(),
      company,
      contactName: str(body.contactName),
      email: str(body.email),
      role: str(body.role),
      source: str(body.source),
      status,
      estimatedValueEur: int(body.estimatedValueEur),
      notes: typeof body.notes === "string" ? body.notes : "",
      nextActionAt: body.nextActionAt ? new Date(body.nextActionAt) : null,
      createdBy: admin.userId,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
