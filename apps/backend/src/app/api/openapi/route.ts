import { type NextRequest, NextResponse } from "next/server";
import { buildOpenApiSpec } from "@/lib/openapi/spec";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cached: { origin: string; spec: object } | null = null;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  if (!cached || cached.origin !== origin) {
    cached = { origin, spec: buildOpenApiSpec(origin) };
  }
  return NextResponse.json(cached.spec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
