import { NextResponse, type NextRequest } from "next/server";
import {
  consumeAuthCode,
  consumeRefreshToken,
  createRefreshToken,
  signAccessToken,
  verifyCodeChallenge,
  ACCESS_TOKEN_TTL,
} from "@/lib/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: URLSearchParams;
  try {
    const text = await req.text();
    body = new URLSearchParams(text);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const grantType = body.get("grant_type") ?? "";

  if (grantType === "authorization_code") {
    return handleAuthorizationCode(body);
  }
  if (grantType === "refresh_token") {
    return handleRefreshToken(body);
  }

  return NextResponse.json({ error: "unsupported_grant_type" }, { status: 400 });
}

async function handleAuthorizationCode(body: URLSearchParams) {
  const code = body.get("code") ?? "";
  const codeVerifier = body.get("code_verifier") ?? "";
  const clientId = body.get("client_id") ?? "";

  if (!code || !codeVerifier || !clientId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "code, code_verifier, client_id required" },
      { status: 400 }
    );
  }

  const authCode = consumeAuthCode(code);
  if (!authCode) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "invalid or expired code" },
      { status: 400 }
    );
  }

  if (authCode.clientId !== clientId) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "client_id mismatch" },
      { status: 400 }
    );
  }

  if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
    return NextResponse.json(
      { error: "invalid_grant", error_description: "PKCE verification failed" },
      { status: 400 }
    );
  }

  const accessToken = await signAccessToken(authCode.userId, clientId, authCode.scopes);
  const refreshToken = createRefreshToken(authCode.userId, clientId, authCode.scopes);

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: refreshToken,
    scope: authCode.scopes.join(" "),
  });
}

async function handleRefreshToken(body: URLSearchParams) {
  const token = body.get("refresh_token") ?? "";
  const clientId = body.get("client_id") ?? "";

  if (!token || !clientId) {
    return NextResponse.json(
      { error: "invalid_request", error_description: "refresh_token, client_id required" },
      { status: 400 }
    );
  }

  const entry = consumeRefreshToken(token);
  if (!entry || entry.clientId !== clientId) {
    return NextResponse.json({ error: "invalid_grant" }, { status: 400 });
  }

  const accessToken = await signAccessToken(entry.userId, clientId, entry.scopes);
  const newRefreshToken = createRefreshToken(entry.userId, clientId, entry.scopes);

  return NextResponse.json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TOKEN_TTL,
    refresh_token: newRefreshToken,
    scope: entry.scopes.join(" "),
  });
}
