"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { testMcpConnection } from "@/lib/mcp/client-config";
import { track } from "@/lib/analytics/funnel";

/**
 * The connection test shared by the onboarding Connect step and the server
 * page's Connect panel: one real MCP handshake (initialize + tools/list)
 * against the proxy URL with the user's key.
 *
 * While the proxy reports the MCP as still installing (a fresh box runs
 * npx/uvx for about a minute) the test retries by itself every 5 s for up to
 * 2 minutes, so the user never has to click "Test" repeatedly. One
 * `connection_tested` funnel event is sent per run, on its final outcome.
 */

/** The shape of testMcpConnection's result (lib/mcp/client-config.ts). */
export interface ConnectionTestResult {
  ok: boolean;
  /** Tool names from tools/list, when the handshake completed. */
  tools?: string[];
  /** The proxy answered 503: the MCP is still installing or the box is waking. */
  installing?: boolean;
  message: string;
}

export type TestPhase = "idle" | "running" | "installing" | "success" | "error";
export type TestSurface = "onboarding" | "server";

export const RETRY_INTERVAL_MS = 5_000;
export const RETRY_WINDOW_MS = 2 * 60_000;

/** "Connected — 3 tools available (fetch, …)" from a tools/list result. */
export function describeTools(tools: readonly string[] | undefined, fallback: string): string {
  if (!tools || tools.length === 0) return fallback;
  const shown = tools.slice(0, 3).join(", ");
  const more = tools.length > 3 ? ", …" : "";
  return `Connected — ${tools.length} tool${tools.length === 1 ? "" : "s"} available (${shown}${more})`;
}

export function useConnectionTest(surface: TestSurface) {
  const [phase, setPhase] = useState<TestPhase>("idle");
  const [message, setMessage] = useState("");
  const [tools, setTools] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Each run gets an id; a stale attempt (after cancel/unmount or a newer run)
  // sees a different id and drops its result.
  const runId = useRef(0);

  const cancel = useCallback(() => {
    runId.current += 1;
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const run = useCallback(
    (url: string, apiKey: string, mcpLabel: string) => {
      cancel();
      const id = runId.current;
      const started = Date.now();
      let sawInstalling = false;

      setPhase("running");
      setMessage("");
      setTools([]);

      const finish = (ok: boolean, result: ConnectionTestResult) => {
        setPhase(ok ? "success" : "error");
        setTools(ok ? (result.tools ?? []) : []);
        setMessage(ok ? describeTools(result.tools, result.message) : result.message);
        track({
          name: "connection_tested",
          properties: { ok, installing: sawInstalling, surface },
        });
      };

      const attempt = async () => {
        const result: ConnectionTestResult = await testMcpConnection(url, apiKey);
        if (id !== runId.current) return;
        if (result.ok) {
          finish(true, result);
          return;
        }
        if (result.installing && Date.now() - started < RETRY_WINDOW_MS) {
          sawInstalling = true;
          setPhase("installing");
          setMessage(`${mcpLabel} is still installing (about a minute)…`);
          timer.current = setTimeout(() => void attempt(), RETRY_INTERVAL_MS);
          return;
        }
        finish(false, result);
      };

      return attempt();
    },
    [cancel, surface]
  );

  /** Stop any retry and clear the result (e.g. another MCP was selected). */
  const reset = useCallback(() => {
    cancel();
    setPhase("idle");
    setMessage("");
    setTools([]);
  }, [cancel]);

  return { phase, message, tools, run, cancel, reset };
}
