import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prospectActivities, prospectActivityTypes, type ProspectActivityType } from "@/db/schema";
import { badRequest } from "@/lib/errors";
import { requireAdmin } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  const items = await getDb()
    .select()
    .from(prospectActivities)
    .where(eq(prospectActivities.prospectId, id))
    .orderBy(desc(prospectActivities.createdAt));
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const type: ProspectActivityType = (prospectActivityTypes as readonly string[]).includes(
    body.type
  )
    ? (body.type as ProspectActivityType)
    : "note";
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 5000) : "";
  if (type === "note" && !text) return badRequest("note body required");

  const [row] = await getDb()
    .insert(prospectActivities)
    .values({
      id: randomUUID(),
      prospectId: id,
      type,
      body: text,
      createdBy: admin.userId,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}
