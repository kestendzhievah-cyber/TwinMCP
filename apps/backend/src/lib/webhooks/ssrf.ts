import { isIP } from "node:net";
import { lookup as dnsLookup, type LookupAddress } from "node:dns";

// SSRF guard for user-supplied webhook URLs. Three layers:
//   1. validateWebhookUrl()  — syntax: https only in production, no userinfo,
//      no obviously internal host names, no private IP literals.
//   2. assertPublicHost()    — at save time, resolve the name and reject it if
//      ANY address is private, so the user gets immediate feedback.
//   3. guardedLookup()       — at delivery time, the socket's own DNS lookup:
//      the address actually connected to is checked, so a DNS-rebinding name
//      that turned private after it was saved is still refused.
// Redirects are never followed (deliver.ts uses node:https, which does not).
// Also refused: ports other than 443 / 8443 (and 80 outside production), and
// WEBHOOKS_DENY_CIDRS plus the addresses of TwinMCP's own domain, so a
// "public" URL cannot hairpin into the host's own interface (Dokploy, Traefik,
// a database port) or scan ports through the test endpoint.

/** Whether private/loopback targets are allowed (never in production). */
export function allowPrivateTargets(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.WEBHOOKS_ALLOW_PRIVATE === "1";
}

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const n = Number(p);
    if (n > 255) return null;
    out.push(n);
  }
  return out;
}

/** 8 hextets of an IPv6 address (handles "::" and a dotted IPv4 tail). */
function parseIPv6(input: string): number[] | null {
  let ip = input;
  const zone = ip.indexOf("%");
  if (zone !== -1) ip = ip.slice(0, zone);
  // Dotted IPv4 tail ("::ffff:127.0.0.1") → two hextets.
  const lastColon = ip.lastIndexOf(":");
  const tail = ip.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = parseIPv4(tail);
    if (!v4) return null;
    ip = `${ip.slice(0, lastColon + 1)}${((v4[0]! << 8) | v4[1]!).toString(16)}:${(
      (v4[2]! << 8) |
      v4[3]!
    ).toString(16)}`;
  }
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...rest];
  const out: number[] = [];
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    out.push(parseInt(g, 16));
  }
  return out.length === 8 ? out : null;
}

function isPrivateIPv4([a, b, c]: number[]): boolean {
  if (a === undefined || b === undefined || c === undefined) return true;
  return (
    a === 0 || // "this" network
    a === 10 || // RFC 1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64/10
    (a === 169 && b === 254) || // link-local (cloud metadata 169.254.169.254)
    (a === 172 && b >= 16 && b <= 31) || // RFC 1918
    (a === 192 && b === 0 && c === 0) || // IETF protocol assignments
    (a === 192 && b === 0 && c === 2) || // TEST-NET-1
    (a === 192 && b === 168) || // RFC 1918
    (a === 198 && (b === 18 || b === 19)) || // benchmarking 198.18/15
    (a === 198 && b === 51 && c === 100) || // TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // TEST-NET-3
    a >= 224 // multicast 224/4, reserved 240/4, broadcast
  );
}

/**
 * True when `ip` (v4 or v6 literal) is NOT a public unicast address: private,
 * loopback, link-local, CGNAT, multicast, reserved, documentation, unspecified,
 * or an IPv4-mapped / NAT64 / 6to4 wrapper around one. Unparseable → true.
 */
export function isPrivateAddress(ip: string): boolean {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const v4 = parseIPv4(bare);
  if (v4) return isPrivateIPv4(v4);
  const h = parseIPv6(bare);
  if (!h) return true;
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  const embedded = (hi: number, lo: number) => [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
  // ::, ::1 and the deprecated IPv4-compatible ::a.b.c.d
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0) {
    if (h5 === 0xffff) return isPrivateIPv4(embedded(h6, h7)); // ::ffff:a.b.c.d
    if (h5 === 0) return true; // ::, ::1, ::a.b.c.d — never a legitimate target
  }
  // ::ffff:0:a.b.c.d SIIT (RFC 6052 / 7915) → the embedded IPv4 decides
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0xffff && h5 === 0) {
    return isPrivateIPv4(embedded(h6, h7));
  }
  // 64:ff9b::/96 NAT64 → the embedded IPv4 decides
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) {
    return isPrivateIPv4(embedded(h6, h7));
  }
  // 64:ff9b:1::/48 local-use NAT64 (RFC 8215): translates into private space
  if (h0 === 0x64 && h1 === 0xff9b && h2 === 1) return true;
  // 2002::/16 6to4 → the embedded IPv4 decides
  if (h0 === 0x2002) return isPrivateIPv4(embedded(h1, h2));
  if ((h0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((h0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((h0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((h0 & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  if (h0 === 0x2001 && h1 === 0x0db8) return true; // 2001:db8::/32 documentation
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true; // 100::/64 discard
  return false;
}

const INTERNAL_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".intranet",
  ".lan",
  ".home.arpa",
];

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

/** Ports a webhook may target: https (443, 8443), plus http 80 outside production. */
export function isAllowedWebhookPort(url: URL, production: boolean): boolean {
  const port = url.port;
  if (port === "" || port === "443" || port === "8443") return true;
  return !production && port === "80";
}

// ── Deny list: WEBHOOKS_DENY_CIDRS + TwinMCP's own addresses ────────────────

/** An address as bits: 32 for IPv4 (IPv4-mapped v6 folded in), 128 for IPv6. */
function addressBits(ip: string): { v: 4 | 6; bits: number[] } | null {
  const bare = ip.startsWith("[") && ip.endsWith("]") ? ip.slice(1, -1) : ip;
  const toBits = (bytes: number[], width: number) => {
    const out: number[] = [];
    for (const b of bytes) for (let i = width - 1; i >= 0; i--) out.push((b >> i) & 1);
    return out;
  };
  const v4 = parseIPv4(bare);
  if (v4) return { v: 4, bits: toBits(v4, 8) };
  const h = parseIPv6(bare);
  if (!h) return null;
  if (h[0] === 0 && h[1] === 0 && h[2] === 0 && h[3] === 0 && h[4] === 0 && h[5] === 0xffff) {
    return { v: 4, bits: toBits([h[6]! >> 8, h[6]! & 0xff, h[7]! >> 8, h[7]! & 0xff], 8) };
  }
  return { v: 6, bits: toBits(h, 16) };
}

/** Parse "a.b.c.d/n", "x::/n" or a bare address (a /32 or /128). Null when invalid. */
export function parseCidr(raw: string): { v: 4 | 6; bits: number[]; prefix: number } | null {
  const [addr = "", len] = raw.trim().split("/");
  const parsed = addressBits(addr);
  if (!parsed) return null;
  const max = parsed.v === 4 ? 32 : 128;
  const prefix = len === undefined ? max : Number(len);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > max) return null;
  return { ...parsed, prefix };
}

/** Is `ip` inside one of `cidrs` (strings as parseCidr reads them)? Invalid entries are skipped. */
export function isDeniedAddress(ip: string, cidrs: readonly string[]): boolean {
  const a = addressBits(ip);
  if (!a) return false;
  for (const raw of cidrs) {
    const c = parseCidr(raw);
    if (!c || c.v !== a.v) continue;
    let match = true;
    for (let i = 0; i < c.prefix; i++) {
      if (a.bits[i] !== c.bits[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/** WEBHOOKS_DENY_CIDRS: comma- or space-separated CIDRs / addresses. */
export function envDenyCidrs(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.WEBHOOKS_DENY_CIDRS ?? "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * TwinMCP's own host names: their addresses are the VPS's public interface.
 * WEBHOOKS_DENY_SELF=0 turns this off — needed if the domain is ever fronted by
 * a shared CDN, whose anycast addresses also serve customers' receivers.
 */
function selfHostnames(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.WEBHOOKS_DENY_SELF === "0") return [];
  const hosts = new Set<string>(["twinmcp.fr"]);
  for (const v of [env.NEXT_PUBLIC_SITE_URL, env.OAUTH_ISSUER, env.NEXT_PUBLIC_API_URL]) {
    if (!v) continue;
    try {
      hosts.add(new URL(v).hostname.toLowerCase());
    } catch {
      /* not a URL */
    }
  }
  return [...hosts];
}

const SELF_TTL_MS = 10 * 60_000;
let selfCache: { at: number; addrs: string[] } | null = null;

/**
 * The deny list in force: WEBHOOKS_DENY_CIDRS plus the current addresses of
 * TwinMCP's own domain (resolved, cached 10 min; a DNS failure keeps the last
 * known list). Never throws.
 */
export async function deniedCidrs(env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const fromEnv = envDenyCidrs(env);
  if (!selfCache || Date.now() - selfCache.at > SELF_TTL_MS) {
    const found: string[] = [];
    await Promise.all(
      selfHostnames(env).map(
        (h) =>
          new Promise<void>((resolve) => {
            dnsLookup(h, { all: true, verbatim: true }, (err, addrs) => {
              if (!err) for (const a of addrs) found.push(a.address);
              resolve();
            });
          })
      )
    );
    selfCache = { at: Date.now(), addrs: found.length > 0 ? found : (selfCache?.addrs ?? []) };
  }
  return [...fromEnv, ...selfCache.addrs];
}

export const MAX_WEBHOOK_URL_LENGTH = 2048;

/**
 * Synchronous URL policy (no DNS). Production requires https; elsewhere http
 * is allowed for local testing. Private targets need WEBHOOKS_ALLOW_PRIVATE=1
 * outside production.
 */
export function validateWebhookUrl(raw: string, env: NodeJS.ProcessEnv = process.env): UrlCheck {
  if (raw.length > MAX_WEBHOOK_URL_LENGTH) return { ok: false, reason: "URL is too long." };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Enter a valid URL, including https://." };
  }
  const production = env.NODE_ENV === "production";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !production)) {
    return { ok: false, reason: "Webhook URLs must use https://." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "Webhook URLs cannot contain a username or password." };
  }
  if (allowPrivateTargets(env)) return { ok: true, url };

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return { ok: false, reason: "Enter a valid URL, including https://." };
  if (host === "localhost" || INTERNAL_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    return { ok: false, reason: "Webhook URLs must point to a public host." };
  }
  const literal = host.startsWith("[") ? host.slice(1, -1) : host;
  if (isIP(literal) && (isPrivateAddress(literal) || isDeniedAddress(literal, envDenyCidrs(env)))) {
    return { ok: false, reason: "Webhook URLs must point to a public IP address." };
  }
  // A hostname with no dot (e.g. "intranet") only resolves on internal DNS.
  if (!isIP(literal) && !host.includes(".")) {
    return { ok: false, reason: "Webhook URLs must point to a public host." };
  }
  if (!isAllowedWebhookPort(url, production)) {
    return {
      ok: false,
      reason: production
        ? "Webhook URLs must use port 443 or 8443."
        : "Webhook URLs must use port 80, 443 or 8443.",
    };
  }
  return { ok: true, url };
}

export class SsrfBlockedError extends Error {
  constructor(message = "Webhook target resolves to a private address") {
    super(message);
    this.name = "SsrfBlockedError";
  }
}

type LookupAll = (hostname: string) => Promise<LookupAddress[]>;

const defaultLookupAll: LookupAll = (hostname) =>
  new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) =>
      err ? reject(err) : resolve(addrs)
    );
  });

/**
 * Resolve the URL's host and throw SsrfBlockedError when any address is
 * private (an attacker controlling DNS could otherwise mix one public and one
 * private A record). DNS failures throw the resolver's error.
 */
export async function assertPublicHost(
  url: URL,
  lookupAll: LookupAll = defaultLookupAll,
  env: NodeJS.ProcessEnv = process.env
): Promise<void> {
  if (allowPrivateTargets(env)) return;
  const host = url.hostname.startsWith("[") ? url.hostname.slice(1, -1) : url.hostname;
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookupAll(host);
  if (addrs.length === 0) throw new SsrfBlockedError("Webhook host does not resolve");
  if (addrs.some((a) => isPrivateAddress(a.address))) throw new SsrfBlockedError();
  const deny = await deniedCidrs(env);
  if (addrs.some((a) => isDeniedAddress(a.address, deny))) {
    throw new SsrfBlockedError("Webhook target is a TwinMCP address");
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number
) => void;

/**
 * Drop-in `lookup` for http(s).request: resolves like dns.lookup, then refuses
 * the connection when any resolved address is private. The socket connects to
 * an address this function returned, so there is no check-then-use gap.
 */
export function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string } | number | undefined,
  callback: LookupCallback
): void {
  const all = typeof options === "object" && options !== null && options.all === true;
  dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) => {
    if (err) return callback(err, all ? [] : "", undefined);
    if (!allowPrivateTargets() && addrs.some((a) => isPrivateAddress(a.address))) {
      return callback(new SsrfBlockedError() as NodeJS.ErrnoException, all ? [] : "", undefined);
    }
    if (allowPrivateTargets()) return answer(addrs);
    deniedCidrs().then(
      (deny) => {
        if (addrs.some((a) => isDeniedAddress(a.address, deny))) {
          return callback(
            new SsrfBlockedError("Webhook target is a TwinMCP address") as NodeJS.ErrnoException,
            all ? [] : "",
            undefined
          );
        }
        answer(addrs);
      },
      () => answer(addrs)
    );
  });

  function answer(addrs: LookupAddress[]): void {
    if (addrs.length === 0) {
      return callback(
        new SsrfBlockedError("Webhook host does not resolve") as NodeJS.ErrnoException,
        all ? [] : "",
        undefined
      );
    }
    if (all) return callback(null, addrs);
    const first = addrs[0]!;
    callback(null, first.address, first.family);
  }
}
