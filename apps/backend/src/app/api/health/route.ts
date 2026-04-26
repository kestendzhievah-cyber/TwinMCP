import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let dbOk = false;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable
  }

  const status = dbOk ? "ok" : "degraded";
  const code = dbOk ? 200 : 503;

  return NextResponse.json(
    {
      status,
      service: "twinmcp-backend",
      version: process.env.npm_package_version ?? "0.1.0",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      db: dbOk ? "connected" : "unreachable",
      timestamp: new Date().toISOString(),
    },
    { status: code }
  );
}
