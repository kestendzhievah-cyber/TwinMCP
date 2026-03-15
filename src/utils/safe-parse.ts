/**
 * Safely parse a value that may be a JSON string, an already-parsed object,
 * null, or undefined.  PostgreSQL jsonb columns return already-parsed objects
 * when accessed via the `pg` driver, so calling `JSON.parse()` on them throws.
 *
 * @param value  The raw value from a database row.
 * @param fallback  Value to return when `value` is null / undefined (default: null).
 */
export function safeParse<T = unknown>(value: unknown, fallback: T | null = null): T | null {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
