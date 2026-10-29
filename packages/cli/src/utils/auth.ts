import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Stored credentials: `twinmcp login` saves a full-access API key (ctx7sk_…)
// in ~/.twinmcp/credentials.json. The CLI has no OAuth flow: TwinMCP's OAuth
// server (/oauth/*) issues MCP-scoped tokens for remote connectors, which
// cannot call the management API.

const CONFIG_DIR = path.join(os.homedir(), ".twinmcp");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in?: number;
  expires_at?: number;
  scope?: string;
}

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
}

export function saveTokens(tokens: TokenData): void {
  ensureConfigDir();
  const data = {
    ...tokens,
    expires_at:
      tokens.expires_at ?? (tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined),
  };
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export function loadTokens(): TokenData | null {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return null;
  }
  try {
    const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf-8"));
    return data as TokenData;
  } catch {
    return null;
  }
}

export function clearTokens(): boolean {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
    return true;
  }
  return false;
}

export function isTokenExpired(tokens: TokenData): boolean {
  if (!tokens.expires_at) {
    return false;
  }
  return Date.now() > tokens.expires_at - 60000;
}

/**
 * The stored access token (an API key) unless it carries an expiry that has
 * passed. Null when nothing usable is stored: run `twinmcp login` again.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = loadTokens();
  if (!tokens || isTokenExpired(tokens)) return null;
  return tokens.access_token;
}
