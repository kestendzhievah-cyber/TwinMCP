import { type NextRequest, NextResponse } from "next/server";
import { badRequest, serverError } from "@/lib/errors";
import { requireManagementUser } from "@/lib/session";
import { decodeLedgerCursor, listLedger } from "@/lib/wallet/ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/v2/wallet/ledger?cursor=<opaque>: the signed-in user's wallet
// history, newest first, 50 per page. Only ever the caller's own rows.
export async function GET(req: NextRequest) {
  const session = await requireManagementUser(req);
  if (session instanceof NextResponse) return session;

  const raw = new URL(req.url).searchParams.get("cursor");
  const cursor = raw ? decodeLedgerCursor(raw) : null;
  if (raw && !cursor) return badRequest("Invalid cursor.");

  try {
    const page = await listLedger(session.userId, { cursor });
    return NextResponse.json(
      {
        entries: page.entries.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
        nextCursor: page.nextCursor,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[wallet] ledger read failed", err);
    return serverError("Could not load your wallet history.");
  }
}
