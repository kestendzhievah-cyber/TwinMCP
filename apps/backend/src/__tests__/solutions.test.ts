import { describe, it, expect } from "vitest";
import { MCP_BUNDLES } from "@/lib/mcp-bundles";
import { OFFICIAL_MCPS, RETIRED_SLUGS, type SeedEntry } from "@/lib/servers/seed-catalog";
import { LOCALES, hreflangAlternates, localizedPath, type Locale } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";
import {
  SOLUTIONS,
  SOLUTION_MCPS,
  SOLUTIONS_INDEX_PATHS,
  demoPackSummary,
  getSolutionBySlug,
  guidedSetupHref,
  mcpsNeedingInput,
  signUpHref,
  solutionAlternates,
  solutionForBundle,
  solutionMcps,
  solutionPath,
  solutionSlugs,
} from "@/lib/solutions/data";

// The segment pages make product claims per MCP; these guards pin them to the
// seed catalogue (lib/servers/seed-catalog.ts, what scripts/seed-mcps.ts
// writes to the database) and to the packs the admin console installs.
type Entry = SeedEntry & { slug: string };
const CATALOGUE = OFFICIAL_MCPS as Entry[];

function seedEntry(slug: string): Entry | undefined {
  return CATALOGUE.find((m) => m.slug === slug);
}

/** Names of the `required: true` config fields of a seed entry. */
function requiredKeys(entry: Entry): string[] {
  return Object.entries(entry.configSchema.properties)
    .filter(([, field]) => field.required === true)
    .map(([key]) => key)
    .sort();
}

const BANNED =
  /\bSLA\b|\bSSO\b|SOC ?2|ISO ?27001|HIPAA|data residency|résidence des données|always-on|uptime|refund|rembours|guarantee|garanti|certifi|customers? (?:like|such as)|testimonial|\bEU region|région UE/i;
const EMOJI = /\p{Extended_Pictographic}/u;

function allCopy(locale: Locale): string {
  return SOLUTIONS.map((s) => {
    const c = s[locale];
    return [
      c.name,
      c.eyebrow,
      c.title,
      c.metaTitle,
      c.metaDescription,
      c.lead,
      c.audience,
      ...c.problem,
      ...c.notes,
      ...c.prompts.map((p) => p.text),
      ...c.faq.flatMap((f) => [f.q, f.a]),
    ].join("\n");
  }).join("\n");
}

describe("solutions data", () => {
  it("has exactly one page per MCP bundle", () => {
    expect(SOLUTIONS.map((s) => s.bundleId).sort()).toEqual(MCP_BUNDLES.map((b) => b.id).sort());
  });

  it("describes every MCP of every pack, in bundle order", () => {
    for (const s of SOLUTIONS) {
      const bundle = MCP_BUNDLES.find((b) => b.id === s.bundleId)!;
      expect(solutionMcps(s).map((m) => m.slug)).toEqual(bundle.slugs);
    }
  });

  it.each(Object.values(SOLUTION_MCPS))("$slug matches the seed catalogue", (mcp) => {
    const entry = seedEntry(mcp.slug);
    expect(entry, `${mcp.slug} missing from the seed catalogue`).toBeDefined();
    expect(RETIRED_SLUGS).not.toContain(mcp.slug);
    // Hosted in a box (a "local" MCP cannot be part of a hosted pack).
    expect(entry!.hostMode ?? "box").toBe("box");
    // English description and name copied verbatim from the catalogue.
    expect(mcp.description.en).toBe(entry!.description);
    expect(mcp.name).toBe(entry!.name);
    // "What you bring" mirrors the required config fields.
    expect([...mcp.configKeys].sort()).toEqual(requiredKeys(entry!));
    expect(mcp.needs === null).toBe(mcp.configKeys.length === 0);
    if (mcp.needs) {
      for (const key of mcp.configKeys) {
        expect(mcp.needs.en).toContain(key);
        expect(mcp.needs.fr).toContain(key);
      }
    }
    expect(mcp.description.fr.length).toBeGreaterThan(0);
  });

  it("only uses MCP copy that a pack needs", () => {
    const used = new Set(SOLUTIONS.flatMap((s) => solutionMcps(s).map((m) => m.slug)));
    expect(Object.keys(SOLUTION_MCPS).sort()).toEqual([...used].sort());
  });

  it("example prompts only rely on tools of the pack, and cover every MCP", () => {
    for (const s of SOLUTIONS) {
      const slugs = new Set(solutionMcps(s).map((m) => m.slug));
      for (const locale of LOCALES) {
        const prompts = s[locale].prompts;
        expect(prompts.length).toBeGreaterThanOrEqual(3);
        const covered = new Set<string>();
        for (const p of prompts) {
          expect(p.uses.length).toBeGreaterThan(0);
          for (const u of p.uses) {
            expect(slugs.has(u), `${s.bundleId}/${locale}: ${u}`).toBe(true);
            covered.add(u);
          }
        }
        expect([...covered].sort()).toEqual([...slugs].sort());
      }
      // The two languages carry the same examples.
      expect(s.fr.prompts.map((p) => p.uses)).toEqual(s.en.prompts.map((p) => p.uses));
      expect(s.fr.prompts.map((p) => !!p.needsFiles)).toEqual(
        s.en.prompts.map((p) => !!p.needsFiles)
      );
      expect(s.fr.faq).toHaveLength(s.en.faq.length);
      expect(s.fr.notes).toHaveLength(s.en.notes.length);
    }
  });

  it("flags every prompt that needs a repository or files already in the box", () => {
    for (const s of SOLUTIONS) {
      for (const locale of LOCALES) {
        for (const p of s[locale].prompts) {
          const needs = /\/workspace\//.test(p.text) || p.uses.includes("git");
          if (needs) expect(p.needsFiles, `${s.bundleId}/${locale}: ${p.text}`).toBe(true);
        }
      }
    }
    // Every pack still offers examples that work on a fresh install.
    for (const s of SOLUTIONS) {
      expect(s.en.prompts.filter((p) => !p.needsFiles).length).toBeGreaterThanOrEqual(2);
    }
  });

  it("lists the packs that need settings", () => {
    const needing = Object.fromEntries(
      SOLUTIONS.map((s) => [s.bundleId, mcpsNeedingInput(s).map((m) => m.slug)])
    );
    expect(needing).toEqual({
      essentiel: [],
      dev: ["git", "filesystem"],
      recherche: [],
      data: ["postgres"],
      finance: [],
    });
  });

  it.each(LOCALES)("copy in %s promises nothing that is not sold and has no emoji", (locale) => {
    const text = allCopy(locale);
    expect(text).not.toMatch(BANNED);
    expect(text).not.toMatch(EMOJI);
  });

  it("keeps meta titles and descriptions to search-friendly lengths", () => {
    for (const s of SOLUTIONS) {
      for (const locale of LOCALES) {
        const c = s[locale];
        expect(c.metaTitle.length, c.metaTitle).toBeLessThanOrEqual(80);
        expect(c.metaDescription.length, c.metaDescription).toBeLessThanOrEqual(260);
        expect(c.metaDescription.length).toBeGreaterThanOrEqual(80);
      }
    }
  });
});

describe("solutions paths", () => {
  it("has unique, URL-safe slugs per locale and resolves them", () => {
    for (const locale of LOCALES) {
      const slugs = solutionSlugs(locale);
      expect(new Set(slugs).size).toBe(slugs.length);
      for (const slug of slugs) {
        expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
        expect(getSolutionBySlug(slug, locale)?.[locale].slug).toBe(slug);
      }
    }
    expect(getSolutionBySlug("essentiel", "en")).toBeUndefined();
    expect(getSolutionBySlug("nope", "fr")).toBeUndefined();
  });

  it("builds page, guided-setup and sign-up links", () => {
    const dev = SOLUTIONS.find((s) => s.bundleId === "dev")!;
    expect(solutionPath(dev, "en")).toBe("/solutions/developers");
    expect(solutionPath(dev, "fr")).toBe("/fr/solutions/developpeurs");
    expect(guidedSetupHref(dev, "en")).toBe("/demo?bundle=dev");
    expect(guidedSetupHref(dev, "fr")).toBe("/fr/demo?bundle=dev");
    expect(signUpHref("en", "free")).toBe("/sign-up?plan=free");
    expect(signUpHref("fr", "pro")).toBe("/fr/inscription?plan=pro");
  });

  it("gives symmetric hreflang pairs with an English x-default", () => {
    for (const s of [null, ...SOLUTIONS]) {
      const en = solutionAlternates(s, "en");
      const fr = solutionAlternates(s, "fr");
      expect(en.languages).toEqual(fr.languages);
      expect(en.canonical).toBe(en.languages.en);
      expect(fr.canonical).toBe(fr.languages.fr);
      expect(en.languages["x-default"]).toBe(en.languages.en);
    }
    expect(solutionAlternates(null, "fr").canonical).toBe(SOLUTIONS_INDEX_PATHS.fr);
    // The index has the same slug in both languages, like hreflangAlternates builds.
    const index = hreflangAlternates("/solutions");
    expect(solutionAlternates(null, "en").languages).toEqual({
      en: index.en,
      fr: index.fr,
      "x-default": index["x-default"],
    });
  });

  it("is registered in the i18n registry, so the language switcher reaches every twin", () => {
    for (const s of [null, ...SOLUTIONS]) {
      const { en, fr } = solutionAlternates(s, "en").languages;
      expect(localizedPath(en, "fr")).toBe(fr);
      expect(localizedPath(fr, "en")).toBe(en);
      expect(localeSwitchTargets(en)).toEqual({ en, fr });
      expect(localeSwitchTargets(fr)).toEqual({ en, fr });
    }
  });
});

describe("guided-setup pack (?bundle=)", () => {
  it("maps every guided-setup link back to its solution", () => {
    for (const s of SOLUTIONS) {
      const id = new URL(guidedSetupHref(s, "en"), "https://x").searchParams.get("bundle");
      expect(solutionForBundle(id ?? undefined)).toBe(s);
    }
    expect(solutionForBundle("nope")).toBeUndefined();
    expect(solutionForBundle(undefined)).toBeUndefined();
  });

  it("summarises the pack in the visitor's language", () => {
    const dev = SOLUTIONS.find((s) => s.bundleId === "dev")!;
    expect(demoPackSummary("dev", "fr")).toEqual({
      id: "dev",
      name: dev.fr.name,
      mcps: solutionMcps(dev).map((m) => m.name),
    });
    expect(demoPackSummary("dev", "en")?.name).toBe(dev.en.name);
    expect(demoPackSummary("nope", "en")).toBeUndefined();
  });
});
