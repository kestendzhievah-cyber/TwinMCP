import { NextResponse } from "next/server";
import { NO_STORE_HEADERS, oauthCorsHeaders } from "@/lib/oauth";

// Shared by the public OAuth endpoints (register, token, revoke).

/** RFC 6749 §5.2 error body, never cached, CORS-open (no cookies involved). */
export function oauthErrorResponse(
  status: number,
  error: string,
  description: string,
  extra?: Record<string, string>
) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...oauthCorsHeaders(), ...NO_STORE_HEADERS, ...(extra ?? {}) } }
  );
}

/**
 * Read a token / revocation request body. RFC 6749 mandates
 * application/x-www-form-urlencoded; JSON is accepted too (some clients send
 * it). A public client may put its client_id in a Basic Authorization header
 * instead of the body — it is copied over (any secret is ignored).
 */
export async function readTokenRequest(req: Request): Promise<URLSearchParams | null> {
  let params: URLSearchParams;
  try {
    const text = await req.text();
    if (text.length > 16_384) return null;
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/json")) {
      const json: unknown = JSON.parse(text || "{}");
      if (!json || typeof json !== "object" || Array.isArray(json)) return null;
      params = new URLSearchParams();
      for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
        if (typeof v === "string") params.set(k, v);
      }
    } else {
      params = new URLSearchParams(text);
    }
  } catch {
    return null;
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!params.get("client_id") && auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
      const user = decodeURIComponent(decoded.split(":")[0] ?? "");
      if (user) params.set("client_id", user);
    } catch {
      // ignore a malformed header
    }
  }
  return params;
}
