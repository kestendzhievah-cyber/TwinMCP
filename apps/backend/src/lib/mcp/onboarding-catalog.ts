// The MCPs the onboarding wizard offers for a first install, in display order.
//
// Every slug here is a box-hosted, zero-configuration entry of
// scripts/seed-mcps.ts (hostMode "box", configSchema with no required field),
// so a brand-new account can install one without an API key, a local agent or
// any setup, and the Connect step can prove the tool call end to end. Keep the
// list in sync with the seed: app/onboarding/page.tsx also filters on hostMode
// and public visibility, so a slug that stops qualifying simply disappears.
//
// Client-safe: constants only.

export const ONBOARDING_SLUGS = [
  "fetch",
  "wikipedia",
  "duckduckgo",
  "memory",
  "time",
  "sequential-thinking",
] as const;

export type OnboardingSlug = (typeof ONBOARDING_SLUGS)[number];

/** Index in ONBOARDING_SLUGS, or Infinity for a slug outside the list (sorts last). */
export function onboardingRank(slug: string): number {
  const i = (ONBOARDING_SLUGS as readonly string[]).indexOf(slug);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

/** A catalog entry is zero-config when no property of its schema is required. */
export function hasRequiredConfig(schema: unknown): boolean {
  if (!schema || typeof schema !== "object" || !("properties" in schema)) return false;
  const props = (schema as { properties?: Record<string, { required?: boolean }> }).properties;
  if (!props) return false;
  return Object.values(props).some((p) => p && typeof p === "object" && p.required === true);
}

// One prompt per MCP the user can paste into their IDE right after the
// connection test passes. The call shows up in the server's Logs tab, which is
// the moment the product proves itself. Only MCPs whose tools were verified
// are listed; anything else falls back to the first tool name the test saw.
const SAMPLE_PROMPTS: Record<string, string> = {
  fetch: "Use the fetch tool to read https://twinmcp.fr",
  wikipedia: 'Use the Wikipedia tool to summarize the article "Model Context Protocol"',
  duckduckgo: 'Use the DuckDuckGo tool to search for "Model Context Protocol"',
  memory: "Use the memory tool to remember that this project uses TwinMCP",
  time: "Use the time tool to tell me the current time in Paris",
  "sequential-thinking": "Use the sequential thinking tool to plan a three-step refactor",
  "twinmcp-docs": "Use the get-context tool to explain how TwinMCP API keys work",
};

/**
 * The "try it" prompt for an MCP: a curated one for the onboarding list,
 * otherwise a generic line built from the first tool the connection test
 * returned (or the MCP's slug when the tool list is unknown).
 */
export function sampleToolPrompt(mcpSlug: string, tools?: readonly string[]): string {
  const curated = SAMPLE_PROMPTS[mcpSlug];
  if (curated) return curated;
  const tool = tools?.[0] ?? mcpSlug;
  return `Use the ${tool} tool`;
}
