import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects, prospectStatuses, type ProspectStatus } from "@/db/schema";
import { badRequest } from "@/lib/errors";
import { requireAdmin, str, int } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const items = await getDb().select().from(prospects).orderBy(desc(prospects.createdAt));
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
