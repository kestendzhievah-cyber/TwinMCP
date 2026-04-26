import { NextResponse, type NextRequest } from "next/server";
import { registerClient } from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const clientName = typeof body.client_name === "string" ? body.client_name : "unnamed";
  const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as string[]) : [];

  if (redirectUris.length === 0) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "redirect_uris is required" },
      { status: 400 }
    );
  }

  const client = registerClient(clientName, redirectUris);

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201 }
  );
}
