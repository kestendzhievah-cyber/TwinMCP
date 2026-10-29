// Facts quoted by the docs pages (EN /docs, FR /fr/docs), derived from the
// modules that enforce them so the copy cannot drift from the product:
//   - daily tool-call quotas  → lib/rate-limit.ts (getDailyLimit)
//   - plan allowances         → lib/plan-features.ts
//   - key scopes and rotation → lib/auth/key-scope.ts (contract K1)
//   - proxy error shape       → contract K2 (x-twinmcp-request-id, error.data)
// Pure module: no React, safe to unit-test.

import { getDailyLimit } from "@/lib/rate-limit";
import { PLAN_CAPABILITIES, PLAN_LABELS, minPlanFor } from "@/lib/plan-features";
import {
  MANAGEMENT_SCOPE_MESSAGE,
  ROTATION_OVERLAP_MS,
  SERVER_SCOPE_MESSAGE,
} from "@/lib/auth/key-scope";
import type { Locale } from "@/lib/i18n/locales";

/** Header the MCP proxy sets on every response (contract K2). */
export const REQUEST_ID_HEADER = "x-twinmcp-request-id";

/** Where the proxy's JSON-RPC `error.data.docsUrl` points (contract K2). */
export const TROUBLESHOOTING_ANCHOR = "troubleshooting";

/** JSON-RPC error codes the proxy emits, as documented on the page. */
export const RPC_CODES = {
  /** Box waking up / MCP still installing (HTTP 503). */
  notReady: -32001,
  /** Tool call timed out and was not retried (HTTP 504). */
  uncertain: -32002,
  /** Key bound to another server (HTTP 403, contract K2). */
  wrongServer: -32003,
} as const;

export { MANAGEMENT_SCOPE_MESSAGE, SERVER_SCOPE_MESSAGE };

/** Format an integer the way each locale writes it ("5,000" / "5 000"). */
export function formatCount(n: number, locale: Locale): string {
  // fr-FR groups with a narrow no-break space; plain no-break space reads the
  // same in EB Garamond and survives copy-paste into search boxes.
  return n.toLocaleString(locale === "fr" ? "fr-FR" : "en-US").replace(/ /g, " ");
}

/** Hours the replaced key keeps working after a rotation (24). */
export function rotationOverlapHours(): number {
  return Math.round(ROTATION_OVERLAP_MS / 3_600_000);
}

export interface DocsPlanFacts {
  freeDaily: number;
  proDaily: number;
  freeKeys: number;
  proKeys: number;
  /** Plan label required to package your own MCP ("Pro"). */
  customMcpPlan: string;
}

export function docsPlanFacts(): DocsPlanFacts {
  return {
    freeDaily: getDailyLimit("free"),
    proDaily: getDailyLimit("pro"),
    freeKeys: PLAN_CAPABILITIES.free.apiKeys,
    proKeys: PLAN_CAPABILITIES.pro.apiKeys,
    customMcpPlan: PLAN_LABELS[minPlanFor("publishMcp")],
  };
}
