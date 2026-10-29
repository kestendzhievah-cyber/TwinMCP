import { describe, it, expect } from "vitest";
import {
  CATALOGUE_COUNT,
  CHECKED_ON,
  COMPARISONS,
  COMPARE_BASE,
  compareLanguages,
  comparePath,
  compareTwinPairs,
  formatCheckedOn,
  getComparison,
  getComparisonByFrSlug,
  sourceNumber,
  type Comparison,
} from "@/lib/compare/data";
import { TRANSLATED_TWINS, localizedPath } from "@/lib/i18n/locales";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";
import { getDailyLimit } from "@/lib/rate-limit";
import { formatEur } from "@/components/pricing/pricing-data";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";
import { INTERNAL_SLUGS, SERVERS } from "@/lib/servers/catalog";

// The comparison pages state facts about third parties and about TwinMCP.
// These guards keep them sourced, symmetric in both languages, and pinned to
// the code that defines the TwinMCP side.

/** Every TwinMCP-side sentence of a comparison, both locales. */
function twinmcpCopy(c: Comparison): string[] {
  return [
    ...c.rows.flatMap((r) => [r.twinmcp.en, r.twinmcp.fr]),
    ...c.chooseTwinmcp.en,
    ...c.chooseTwinmcp.fr,
  ];
}

describe("compare data: catalogue size", () => {
  it("counts the seeded, non-retired, user-installable MCPs, never rounded", () => {
    const live = new Set(
      OFFICIAL_MCPS.map((m) => m.slug).filter(
        (slug) => !RETIRED_SLUGS.includes(slug) && !INTERNAL_SLUGS.includes(slug)
      )
    );
    expect(live.size).toBeGreaterThan(50);
    expect(CATALOGUE_COUNT).toBe(live.size);
    // Same number the /servers catalogue pages list.
    expect(CATALOGUE_COUNT).toBe(SERVERS.length);
    const composio = getComparison("composio")!;
    const row = composio.rows.find((r) => r.id === "catalogue")!;
    expect(row.twinmcp.en).toContain(`${CATALOGUE_COUNT} MCP servers`);
    expect(row.twinmcp.fr).toContain(`${CATALOGUE_COUNT} serveurs MCP`);
  });
});

describe("compare data: sources", () => {
  it("dates every source with CHECKED_ON and an https URL", () => {
    expect(CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const c of COMPARISONS) {
      expect(c.sources.length, c.slug).toBeGreaterThan(0);
      for (const s of c.sources) {
        expect(s.url, s.id).toMatch(/^https:\/\//);
        expect(s.checkedOn, s.id).toBe(CHECKED_ON);
        expect(s.label.trim(), s.id).not.toBe("");
      }
      expect(new Set(c.sources.map((s) => s.id)).size).toBe(c.sources.length);
    }
  });

  it("backs every competitor cell with a source of the same page", () => {
    for (const c of COMPARISONS) {
      const used = new Set<string>();
      for (const row of c.rows) {
        if (c.slug !== "self-hosting") {
          expect(row.sources.length, `${c.slug}/${row.id}`).toBeGreaterThan(0);
        }
        for (const id of row.sources) {
          expect(sourceNumber(c, id), `${c.slug}/${row.id} → ${id}`).toBeGreaterThan(0);
          used.add(id);
        }
      }
      // No dangling source in the list at the bottom of the page.
      for (const s of c.sources) expect(used.has(s.id), `${c.slug}: ${s.id} unused`).toBe(true);
    }
  });

  it("numbers sources from 1 in list order", () => {
    const c = getComparison("composio")!;
    expect(sourceNumber(c, c.sources[0].id)).toBe(1);
    expect(sourceNumber(c, c.sources[c.sources.length - 1].id)).toBe(c.sources.length);
    expect(sourceNumber(c, "nope")).toBe(0);
  });
});

describe("compare data: bilingual content", () => {
  it("fills every field in English and French, with matching list lengths", () => {
    for (const c of COMPARISONS) {
      for (const field of [
        c.them,
        c.title,
        c.description,
        c.eyebrow,
        c.headline,
        c.lead,
        c.summary,
        c.chooseThemTitle,
      ]) {
        expect(field.en.trim(), c.slug).not.toBe("");
        expect(field.fr.trim(), c.slug).not.toBe("");
      }
      for (const row of c.rows) {
        for (const cell of [row.criterion, row.them, row.twinmcp]) {
          expect(cell.en.trim(), `${c.slug}/${row.id}`).not.toBe("");
          expect(cell.fr.trim(), `${c.slug}/${row.id}`).not.toBe("");
        }
      }
      expect(c.chooseThem.fr).toHaveLength(c.chooseThem.en.length);
      expect(c.chooseTwinmcp.fr).toHaveLength(c.chooseTwinmcp.en.length);
      expect(c.faq.fr).toHaveLength(c.faq.en.length);
      expect(c.chooseThem.en.length, c.slug).toBeGreaterThan(0);
      expect(new Set(c.rows.map((r) => r.id)).size).toBe(c.rows.length);
    }
  });

  it("keeps meta descriptions within a search-snippet length", () => {
    for (const c of COMPARISONS) {
      expect(c.description.en.length, c.slug).toBeLessThanOrEqual(300);
      expect(c.description.fr.length, c.slug).toBeLessThanOrEqual(300);
    }
  });
});

describe("compare data: TwinMCP facts", () => {
  it("never promises what is not sold", () => {
    const banned =
      /\bSSO\b|SOC ?2|ISO ?27001|data residency|résidence des données|always[- ]on|refund|rembours|uptime guarantee/i;
    for (const c of COMPARISONS) {
      for (const line of twinmcpCopy(c)) {
        expect(line, c.slug).not.toMatch(banned);
        // "SLA" only ever appears negated on the TwinMCP side.
        for (const m of line.matchAll(/\bSLA\b/g)) {
          const before = line.slice(0, m.index).toLowerCase();
          expect(before, line).toMatch(/(?:\bno|pas de|aucun[e]?|sans|ni)\s*(?:\S+\s+){0,3}$/);
        }
      }
    }
  });

  it("prices and quotas come from the plan code", () => {
    const composio = getComparison("composio")!;
    const paid = composio.rows.find((r) => r.id === "paid")!.twinmcp;
    const freeRow = composio.rows.find((r) => r.id === "free")!.twinmcp;
    expect(paid.en).toContain("€14.99");
    expect(paid.en).toContain("€135");
    expect(paid.en).toContain(getDailyLimit("pro").toLocaleString("en-US"));
    expect(paid.en).toContain(`${PLAN_CAPABILITIES.pro.servers} servers`);
    expect(paid.fr).toContain(formatEur(14.99, "fr"));
    expect(paid.fr).toContain(formatEur(135, "fr"));
    expect(freeRow.en).toContain(`${getDailyLimit("free")} tool calls a day`);
  });

  it("concedes the other option's strengths", () => {
    const composio = getComparison("composio")!;
    expect(composio.chooseThem.en.join(" ")).toMatch(/managed OAuth/);
    expect(composio.chooseThem.en.join(" ")).toMatch(/SOC 2 Type II/);
    const selfHost = getComparison("self-hosting")!;
    expect(selfHost.chooseThem.en.join(" ")).toMatch(/Docker image/);
  });

  it("publishes no ratings", () => {
    expect(JSON.stringify(COMPARISONS)).not.toMatch(/\b(?:aggregate)?rating\b|★/i);
  });
});

describe("compare data: paths and hreflang", () => {
  it("builds hub and page paths per locale", () => {
    expect(comparePath("en")).toBe(COMPARE_BASE.en);
    expect(comparePath("fr")).toBe(COMPARE_BASE.fr);
    const selfHost = getComparison("self-hosting")!;
    expect(comparePath("en", selfHost)).toBe("/compare/self-hosting");
    expect(comparePath("fr", selfHost)).toBe("/fr/comparer/auto-hebergement");
    expect(getComparisonByFrSlug("auto-hebergement")).toBe(selfHost);
    expect(getComparison("nope")).toBeUndefined();
    expect(getComparisonByFrSlug("self-hosting")).toBeUndefined();
  });

  it("emits symmetric language alternates with an English x-default", () => {
    for (const c of [undefined, ...COMPARISONS]) {
      const langs = compareLanguages(c);
      expect(langs).toEqual({
        en: comparePath("en", c),
        fr: comparePath("fr", c),
        "x-default": comparePath("en", c),
      });
    }
  });

  it("registers every page pair as a translated twin for the language switcher", () => {
    const pairs = compareTwinPairs();
    expect(pairs).toHaveLength(COMPARISONS.length + 1);
    for (const pair of pairs) {
      expect(TRANSLATED_TWINS, pair.en).toContainEqual(pair);
      expect(localizedPath(pair.en, "fr")).toBe(pair.fr);
      expect(localizedPath(pair.fr, "en")).toBe(pair.en);
    }
  });

  it("uses unique, URL-safe slugs", () => {
    const slugs = COMPARISONS.map((c) => c.slug);
    const frSlugs = COMPARISONS.map((c) => c.frSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(frSlugs).size).toBe(frSlugs.length);
    for (const s of [...slugs, ...frSlugs]) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe("formatCheckedOn", () => {
  it("writes the date out in each language", () => {
    expect(formatCheckedOn("2026-10-27", "en")).toBe("27 October 2026");
    expect(formatCheckedOn("2026-10-27", "fr")).toBe("27 octobre 2026");
    expect(formatCheckedOn("2026-08-01", "fr")).toBe("1 août 2026");
  });

  it("falls back to the raw string on a malformed date", () => {
    expect(formatCheckedOn("soon", "en")).toBe("soon");
    expect(formatCheckedOn("2026-13-01", "en")).toBe("2026-13-01");
  });
});
