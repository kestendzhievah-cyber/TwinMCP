import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";
import { randomBytes, createHash } from "crypto";

const ISSUER =
  process.env.OAUTH_ISSUER ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://twinmcp.com";
const ALG = "RS256";
const ACCESS_TOKEN_TTL = 3600;
const REFRESH_TOKEN_TTL = 86400 * 30;
const AUTH_CODE_TTL = 300;

let _privateKey: CryptoKey | null = null;
let _publicKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (_privateKey) return _privateKey;
  const pem = process.env.OAUTH_JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("OAUTH_JWT_PRIVATE_KEY not set");
  _privateKey = await importPKCS8(pem, ALG);
  return _privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (_publicKey) return _publicKey;
  const pem = process.env.OAUTH_JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!pem) throw new Error("OAUTH_JWT_PUBLIC_KEY not set");
  _publicKey = await importSPKI(pem, ALG);
  return _publicKey;
}

// --- In-memory stores (swap for Redis/DB in production at scale) ---

interface AuthCode {
  clientId: string;
  userId: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  expiresAt: number;
}

interface RegisteredClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: number;
}

const authCodes = new Map<string, AuthCode>();
const refreshTokens = new Map<string, { userId: string; clientId: string; scopes: string[] }>();
const clients = new Map<string, RegisteredClient>();

// --- Dynamic Client Registration ---

export function registerClient(clientName: string, redirectUris: string[]): RegisteredClient {
  const clientId = `twinmcp_${randomBytes(16).toString("hex")}`;
  const c: RegisteredClient = { clientId, clientName, redirectUris, createdAt: Date.now() };
  clients.set(clientId, c);
  return c;
}

export function getClient(clientId: string): RegisteredClient | undefined {
  return clients.get(clientId);
}

// --- Authorization Code ---

export function createAuthCode(params: {
  clientId: string;
  userId: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
}): string {
  const code = randomBytes(32).toString("hex");
  authCodes.set(code, { ...params, expiresAt: Date.now() + AUTH_CODE_TTL * 1000 });
  return code;
}

export function consumeAuthCode(code: string): AuthCode | null {
  const entry = authCodes.get(code);
  if (!entry) return null;
  authCodes.delete(code);
  if (Date.now() > entry.expiresAt) return null;
  return entry;
}

export function verifyCodeChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method === "S256") {
    const hash = createHash("sha256").update(codeVerifier).digest("base64url");
    return hash === codeChallenge;
  }
  return codeVerifier === codeChallenge;
}

// --- Tokens ---

export async function signAccessToken(
  userId: string,
  clientId: string,
  scopes: string[]
): Promise<string> {
  const key = await getPrivateKey();
  return new SignJWT({ sub: userId, client_id: clientId, scope: scopes.join(" ") })
    .setProtectedHeader({ alg: ALG })
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(key);
}

export function createRefreshToken(userId: string, clientId: string, scopes: string[]): string {
  const token = randomBytes(48).toString("hex");
  refreshTokens.set(token, { userId, clientId, scopes });
  return token;
}

export function consumeRefreshToken(
  token: string
): { userId: string; clientId: string; scopes: string[] } | null {
  const entry = refreshTokens.get(token);
  if (!entry) return null;
  refreshTokens.delete(token);
  return entry;
}

export async function verifyAccessToken(
  token: string
): Promise<{ sub: string; scope: string } | null> {
  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER });
    return { sub: payload.sub as string, scope: (payload.scope as string) ?? "" };
  } catch {
    return null;
  }
}

export { ISSUER, ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL };
