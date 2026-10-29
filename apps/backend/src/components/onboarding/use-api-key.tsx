"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickKeyForServer, type KeyScope } from "@/lib/auth/key-scope";

/**
 * The API key for a connection snippet, shared by the onboarding Connect step
 * and the server page's Connect panel.
 *
 * A key's secret is shown once, so a repeat visit cannot "show" the existing
 * key again. Instead of minting a fresh key on every visit (which burns the
 * Free plan's 3-key allowance), the hook first lists the account's keys and,
 * when one fits, offers to rotate it: same slot, fresh secret, the old secret
 * keeps working for 24 h then stops. Minting a new key stays available as the
 * explicit second choice.
 *
 * `serverId`: the key goes into an IDE config in plain text, so it is minted
 * as an MCP-proxy-only key bound to that server (it cannot touch the
 * management API or any other server), and only such a key — bound to this
 * server, else an unbound proxy key — is offered for reuse, never a
 * full-access one (lib/auth/key-scope.ts pickKeyForServer).
 *
 * `autoMint`: mint straight away when the account has no key yet (onboarding,
 * where the user has nothing to choose between).
 */

export interface ExistingKey {
  id: string;
  name: string | null;
  prefix: string;
  scope?: KeyScope;
  serverId?: string | null;
  expiresAt?: string | null;
}

export type KeyPhase = "loading" | "choose" | "none" | "working" | "ready";

interface Options {
  /** Name for a newly minted key, e.g. "my-server · Cursor". */
  keyName: string;
  /** Prefer an existing key whose name starts with this (the server's name). */
  preferNamePrefix?: string;
  /** Mint / reuse an mcp_proxy key bound to this server (see above). */
  serverId?: string;
  autoMint?: boolean;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  return body.message ?? fallback;
}

export function useApiKey({ keyName, preferNamePrefix, serverId, autoMint = false }: Options) {
  const [phase, setPhase] = useState<KeyPhase>("loading");
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingKey | null>(null);
  const [error, setError] = useState("");
  /** After a rotation: when the replaced key stops working (ISO). */
  const [oldKeyExpiresAt, setOldKeyExpiresAt] = useState<string | null>(null);
  // Read at mint time, so a later change of IDE names the key correctly
  // without re-running the mount effect.
  const nameRef = useRef(keyName);
  useEffect(() => {
    nameRef.current = keyName;
  }, [keyName]);
  const mounted = useRef(true);

  const mint = useCallback(async () => {
    setPhase("working");
    setError("");
    try {
      const res = await fetch("/api/v2/auth/keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          serverId
            ? { name: nameRef.current.slice(0, 80), scope: "mcp_proxy", serverId }
            : { name: nameRef.current.slice(0, 80) }
        ),
      });
      if (!mounted.current) return;
      if (!res.ok) {
        // Typically the plan's key limit: the server's message says so.
        setError(await errorMessage(res, "Could not create an API key."));
        setPhase("choose");
        return;
      }
      const data = (await res.json()) as {
        id: string;
        key: string;
        prefix: string;
        scope?: KeyScope;
        serverId?: string | null;
      };
      setApiKey(data.key);
      setOldKeyExpiresAt(null);
      setExisting({
        id: data.id,
        name: nameRef.current,
        prefix: data.prefix,
        scope: data.scope,
        serverId: data.serverId ?? null,
      });
      setPhase("ready");
    } catch {
      if (!mounted.current) return;
      setError("Network error — try again.");
      setPhase("choose");
    }
  }, [serverId]);

  const rotate = useCallback(async (key: ExistingKey) => {
    setPhase("working");
    setError("");
    try {
      const res = await fetch(`/api/v2/auth/keys/${key.id}/rotate`, { method: "POST" });
      if (!mounted.current) return;
      if (!res.ok) {
        setError(await errorMessage(res, "Could not rotate the key. Try from the API keys page."));
        setPhase("choose");
        return;
      }
      const data = (await res.json()) as {
        id: string;
        key: string;
        prefix: string;
        name?: string | null;
        scope?: KeyScope;
        serverId?: string | null;
        oldKeyExpiresAt?: string;
      };
      setApiKey(data.key);
      setOldKeyExpiresAt(data.oldKeyExpiresAt ?? null);
      // Rotation creates a new row (same scope / server) and schedules the old
      // one to expire in 24 h: track the new id.
      setExisting({
        id: data.id,
        name: data.name ?? key.name,
        prefix: data.prefix,
        scope: data.scope ?? key.scope,
        serverId: data.serverId ?? key.serverId ?? null,
      });
      setPhase("ready");
    } catch {
      if (!mounted.current) return;
      setError("Network error — try again.");
      setPhase("choose");
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    async function load() {
      let keys: ExistingKey[] = [];
      try {
        const res = await fetch("/api/v2/auth/keys");
        if (res.ok) {
          const data = (await res.json()) as { keys?: ExistingKey[] };
          keys = data.keys ?? [];
        }
      } catch {
        /* treat as "no key": minting still works, or explains the limit */
      }
      if (cancelled) return;
      // Keys come newest first. Bound to a server: only a proxy key for it
      // (keys listed before scopes existed carry no scope and are full keys).
      // Otherwise prefer one already named after this server.
      const match = serverId
        ? pickKeyForServer(
            keys.map((k) => ({ ...k, scope: k.scope ?? "full", serverId: k.serverId ?? null })),
            serverId
          )
        : (preferNamePrefix && keys.find((k) => k.name?.startsWith(`${preferNamePrefix} ·`))) ||
          keys[0];
      if (!match) {
        setExisting(null);
        if (autoMint) void mint();
        else setPhase("none");
        return;
      }
      setExisting(match);
      setPhase("choose");
    }
    void load();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [autoMint, mint, preferNamePrefix, serverId]);

  return { phase, apiKey, existing, error, oldKeyExpiresAt, mint, rotate };
}
