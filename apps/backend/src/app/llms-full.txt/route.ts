import { buildLlmsFullTxt } from "@/lib/marketing/llms";
import { getDailyLimit } from "@/lib/rate-limit";

// /llms-full.txt (https://llmstxt.org): the long plain-text brief AI assistants
// read about TwinMCP. Built per request from the plan and quota code, so it
// follows env overrides of the limits; cached for an hour at the edge.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export function GET() {
  const body = buildLlmsFullTxt({
    siteUrl: SITE_URL,
    dailyLimits: { free: getDailyLimit("free"), pro: getDailyLimit("pro") },
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
