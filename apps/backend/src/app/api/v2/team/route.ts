import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { teamspaceMembers, teamspaces } from "@/db/schema";
import { badRequest, serverError, unauthorized } from "@/lib/errors";
import { requireSessionUser } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1).max(80) });

export async function POST(req: NextRequest) {
  const session = await requireSessionUser(req);
  if (!session) return unauthorized("Sign in required");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.message);

  try {
    const db = getDb();
    const id = randomUUID();
    await db.insert(teamspaces).values({ id, ownerId: session.userId, name: parsed.data.name });
    await db
      .insert(teamspaceMembers)
      .values({ teamspaceId: id, userId: session.userId, role: "owner" });
    return NextResponse.json({ id, name: parsed.data.name }, { status: 201 });
  } catch (err) {
    console.error("[team POST]", err);
    return serverError();
  }
}
