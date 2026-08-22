import { type NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth";
import { resolveAgentResponse } from "@/lib/agent/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The local agent posts the result of a relayed JSON-RPC request here, correlated
 * by the `id` the proxy pushed over the link stream. The id is an unguessable
 * random UUID, so it also gates who can resolve a given pending request.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  let payload: { id?: string; ok?: boolean; body?: string; contentType?: string };
  try {
    payload = (await req.json()) as typeof payload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!payload.id || typeof payload.body !== "string") {
    return NextResponse.json({ message: "Missing id or body" }, { status: 400 });
  }

  const delivered = resolveAgentResponse(payload.id, {
    ok: payload.ok !== false,
    body: payload.body,
    contentType: payload.contentType,
  });
  // `delivered: false` just means the request already timed out / never existed.
  return NextResponse.json({ delivered });
}
