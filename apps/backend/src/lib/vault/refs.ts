// Secret references (contract D6). Pure, dependency-free, client-safe: the
// dashboard field (components/vault/secret-field.tsx), the secrets API and the
// server-side resolver (lib/vault/resolve.ts) all share these.
//
// An MCP config value may be, or contain, `{{secret:NAME}}`. NAME is
// [A-Z0-9_]{1,64}. Anything shaped like a reference but with an invalid name
// (`{{secret:my-token}}`) is reported as missing rather than passed through
// literally, so an MCP never starts with a placeholder in its env.

export const SECRET_NAME_RE = /^[A-Z0-9_]{1,64}$/;
export const SECRET_NAME_MAX = 64;
/** Upper bound for one stored value (a PEM key or a JSON credential fits). */
export const SECRET_VALUE_MAX = 16_384;

// Loose on purpose (see above): captures whatever sits between `secret:` and `}}`.
// A fresh RegExp per use: a shared /g regex carries lastIndex between calls.
const REF_SOURCE = String.raw`\{\{\s*secret:([^{}]*?)\s*\}\}`;
const refRe = () => new RegExp(REF_SOURCE, "g");

export function isValidSecretName(name: unknown): name is string {
  return typeof name === "string" && SECRET_NAME_RE.test(name);
}

/**
 * Normalise what a user typed into a candidate name: trimmed, upper-cased,
 * spaces and dashes to underscores. The result still has to pass
 * isValidSecretName (other characters are not rewritten).
 */
export function normalizeSecretName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/** The reference string for a secret: `{{secret:NAME}}`. */
export function secretRef(name: string): string {
  return `{{secret:${name}}}`;
}

/**
 * When `value` is exactly one reference (the shape the dashboard writes),
 * the referenced name; otherwise null. Invalid names return null too.
 */
export function parseSecretRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = /^\{\{\s*secret:([A-Z0-9_]{1,64})\s*\}\}$/.exec(value.trim());
  return m ? m[1] : null;
}

/** Does this string contain at least one reference (valid or not)? */
export function hasSecretRef(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return refRe().test(value);
}

/**
 * Every referenced name in a config value (strings inside objects and arrays
 * included), deduplicated, in first-seen order. Invalid names are included
 * as written so callers can report them.
 */
export function collectSecretRefs(value: unknown): string[] {
  const seen = new Set<string>();
  const walk = (v: unknown, depth: number): void => {
    if (depth > 20) return;
    if (typeof v === "string") {
      for (const m of v.matchAll(refRe())) seen.add(m[1]);
    } else if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
    } else if (v && typeof v === "object") {
      for (const item of Object.values(v as Record<string, unknown>)) walk(item, depth + 1);
    }
  };
  walk(value, 0);
  return [...seen];
}

/**
 * Replace every reference with its value from `lookup`. Unknown or invalid
 * names are left in place and listed in `missing` (deduplicated). Non-string
 * leaves are returned unchanged; the input is never mutated.
 */
export function substituteSecretRefs<T>(
  value: T,
  lookup: ReadonlyMap<string, string>
): { value: T; missing: string[]; used: string[] } {
  const missing = new Set<string>();
  const used = new Set<string>();
  const walk = (v: unknown, depth: number): unknown => {
    if (depth > 20) return v;
    if (typeof v === "string") {
      if (!v.includes("{{")) return v;
      return v.replace(refRe(), (whole, name: string) => {
        const resolved = isValidSecretName(name) ? lookup.get(name) : undefined;
        if (resolved === undefined) {
          missing.add(name);
          return whole;
        }
        used.add(name);
        return resolved;
      });
    }
    if (Array.isArray(v)) return v.map((item) => walk(item, depth + 1));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, item] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(item, depth + 1);
      }
      return out;
    }
    return v;
  };
  return { value: walk(value, 0) as T, missing: [...missing], used: [...used] };
}

/** The user-facing error for missing secrets: "Missing secret NAME" / "Missing secrets A, B". */
export function missingSecretsMessage(names: readonly string[]): string {
  const shown = names.map((n) => (n.length > 0 ? n : "(empty name)"));
  return shown.length === 1 ? `Missing secret ${shown[0]}` : `Missing secrets ${shown.join(", ")}`;
}

/**
 * Mask a config value for display: a value that is exactly a reference is not
 * secret (it is only a name) and is shown as is; anything else falls back to
 * `fallback` (the caller's usual masking, e.g. null for a secret field).
 */
export function displayConfigValue(value: unknown, fallback: unknown): unknown {
  return parseSecretRef(value) ? value : fallback;
}
