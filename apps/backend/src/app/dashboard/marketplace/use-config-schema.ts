"use client";

import { useEffect, useState } from "react";

// Module-level cache: once an MCP's configSchema is fetched, reopening the same
// card (detail or install) reuses it instead of hitting the API again. Lives for
// the page's lifetime, shared across both dialogs.
const cache = new Map<string, unknown>();

/**
 * Loads a catalog MCP's configSchema on demand (kept out of the marketplace
 * browse payload). Returns the cached value instantly on a repeat open.
 */
export function useMcpConfigSchema(id: string | null): { schema: unknown; loading: boolean } {
  const [schema, setSchema] = useState<unknown>(id ? (cache.get(id) ?? null) : null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    if (cache.has(id)) {
      setSchema(cache.get(id));
      setLoading(false);
      return;
    }
    setSchema(null);
    setLoading(true);
    let cancelled = false;
    fetch(`/api/v2/mcps/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        cache.set(id, d.configSchema);
        if (!cancelled) setSchema(d.configSchema);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { schema, loading };
}
