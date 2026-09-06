import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { prospects, prospectStatuses, type ProspectStatus } from "@/db/schema";
import { badRequest, notFound } from "@/lib/errors";
import { requireAdmin, str, int } from "@/lib/admin/prospects-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Only whitelisted fields — build the patch from what's actually present so a
  // partial update (e.g. just the status) never clobbers untouched columns.
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if ("company" in body) {
    const company = str(body.company);
    if (!company) return badRequest("company cannot be empty");
    patch.company = company;
  }
  if ("contactName" in body) patch.contactName = str(body.contactName);
  if ("email" in body) patch.email = str(body.email);
  if ("role" in body) patch.role = str(body.role);
  if ("source" in body) patch.source = str(body.source);
  if ("notes" in body) patch.notes = typeof body.notes === "string" ? body.notes : "";
  if ("estimatedValueEur" in body) patch.estimatedValueEur = int(body.estimatedValueEur);
  if ("status" in body) {
    if (!(prospectStatuses as readonly string[]).includes(body.status)) {
      return badRequest("invalid status");
    }
    patch.status = body.status as ProspectStatus;
  }
  if ("nextActionAt" in body) {
    patch.nextActionAt = body.nextActionAt ? new Date(body.nextActionAt) : null;
  }

  const [row] = await getDb().update(prospects).set(patch).where(eq(prospects.id, id)).returning();

  if (!row) return notFound("Prospect not found");
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (admin instanceof NextResponse) return admin;

  const { id } = await params;
  const [row] = await getDb().delete(prospects).where(eq(prospects.id, id)).returning();
  if (!row) return notFound("Prospect not found");
  return NextResponse.json({ ok: true });
}
