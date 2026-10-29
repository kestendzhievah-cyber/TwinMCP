import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { compareTwinPairs } from "@/lib/compare/data";
import { SOLUTIONS, SOLUTIONS_INDEX_PATHS, solutionPath } from "@/lib/solutions/data";
import { FR_SERVER_CLIENT_GUIDE_SLUGS } from "@/lib/i18n/locales";
import { MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { INDEXED_CLIENT_GUIDE_SLUGS, serverPageParams } from "@/lib/seo/server-pages";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

describe("sitemap", () => {
  const entries = sitemap();
  const byUrl = new Map(entries.map((e) => [e.url, e]));

  it("lists every URL once", () => {
    expect(byUrl.size).toBe(entries.length);
  });

  it("lists the compare and solutions twins with symmetric hreflang alternates", () => {
    const pairs = [
      ...compareTwinPairs(),
      SOLUTIONS_INDEX_PATHS,
      ...SOLUTIONS.map((s) => ({ en: solutionPath(s, "en"), fr: solutionPath(s, "fr") })),
    ];
    expect(pairs.length).toBe(4 + 1 + SOLUTIONS.length);
    for (const { en, fr } of pairs) {
      const expected = { en: `${SITE}${en}`, fr: `${SITE}${fr}`, "x-default": `${SITE}${en}` };
      expect(byUrl.get(`${SITE}${en}`)?.alternates?.languages).toEqual(expected);
      expect(byUrl.get(`${SITE}${fr}`)?.alternates?.languages).toEqual(expected);
    }
  });

  it("lists per-client guides only for the pinned indexed MCPs", () => {
    const guide = /\/(?:servers|fr\/serveurs)\/([^/]+)\/([^/]+)$/;
    const guides = entries.map((e) => e.url.match(guide)).filter((m) => m !== null);
    const slugs = new Set(guides.map((m) => m![1]));
    expect([...slugs].sort()).toEqual([...INDEXED_CLIENT_GUIDE_SLUGS].sort());
    const frIndexed = INDEXED_CLIENT_GUIDE_SLUGS.filter((s) =>
      FR_SERVER_CLIENT_GUIDE_SLUGS.includes(s)
    );
    expect(guides).toHaveLength(
      (INDEXED_CLIENT_GUIDE_SLUGS.length + frIndexed.length) * MATRIX_CLIENTS.length
    );
    // Every per-MCP page stays listed in both languages.
    for (const { slug } of serverPageParams()) {
      expect(byUrl.has(`${SITE}/servers/${slug}`), slug).toBe(true);
      expect(byUrl.has(`${SITE}/fr/serveurs/${slug}`), slug).toBe(true);
    }
  });
});
