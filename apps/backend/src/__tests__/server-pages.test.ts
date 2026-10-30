import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FR_DESCRIPTIONS,
  FR_FIELD_DESCRIPTIONS,
  INTERNAL_SLUGS,
  SERVERS,
  getServerBySlug,
} from "@/lib/servers/catalog";
import { OFFICIAL_MCPS, RETIRED_SLUGS } from "@/lib/servers/seed-catalog";
import {
  DESCRIPTION_MAX,
  TITLE_MAX,
  buildClientPage,
  buildServerPage,
  clampText,
  clientPageParams,
  configFileName,
  clientSnippet,
  fitTitle,
  joinList,
  parseLaunch,
  relatedServers,
  resolveClientParams,
  resolveServerParams,
  serverPageParams,
  INDEXED_CLIENT_GUIDE_SLUGS,
  LOCAL_AGENT,
  indexedClientPageParams,
  isClientGuideIndexed,
} from "@/lib/seo/server-pages";
import { COPY } from "@/app/servers/_components/copy";
import { FR_SERVER_CLIENT_GUIDE_SLUGS, hasFrenchVersion, localizedPath } from "@/lib/i18n/locales";
import { localeSwitchTargets } from "@/lib/i18n/switch";
import { API_KEY_PLACEHOLDER, MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { PLAN_CAPABILITIES } from "@/lib/plan-features";

const LOCALES = ["en", "fr"] as const;
const publicSeed = OFFICIAL_MCPS.filter(
  (m) => !RETIRED_SLUGS.includes(m.slug) && !INTERNAL_SLUGS.includes(m.slug)
);

// Words the product cannot back (marketing-truth.test.ts): never in generated copy.
const BANNED =
  /\bSLA\b|\bSSO\b|SOC ?2|ISO ?27001|data residency|résidence des données|always-on|refund|rembours|guarantee|garanti/i;

describe("seed catalogue module", () => {
  it("is what the seed script writes to the database", () => {
    const script = readFileSync(join(__dirname, "..", "..", "scripts", "seed-mcps.ts"), "utf8");
    expect(script).toContain('from "../src/lib/servers/seed-catalog"');
    expect(script).not.toMatch(/const OFFICIAL_MCPS/);
  });
});

describe("public catalogue (read from the seed)", () => {
  it("has one page per installable seed entry, in seed order", () => {
    expect(SERVERS.map((s) => s.slug)).toEqual(publicSeed.map((m) => m.slug));
    expect(serverPageParams()).toHaveLength(publicSeed.length);
  });

  it("gives retired, internal and unknown slugs no page", () => {
    for (const slug of [...RETIRED_SLUGS, ...INTERNAL_SLUGS, "nope"]) {
      expect(resolveServerParams(slug), slug).toBeNull();
      expect(resolveClientParams(slug, "cursor", "en"), slug).toBeNull();
    }
    expect(resolveClientParams("fetch", "other", "en")).toBeNull();
    expect(resolveClientParams("fetch", "emacs", "en")).toBeNull();
  });

  it("translates every description and config hint to French", () => {
    for (const s of SERVERS) {
      expect(FR_DESCRIPTIONS[s.slug], s.slug).toBeTruthy();
      for (const key of Object.keys(s.seed.configSchema.properties)) {
        expect(FR_FIELD_DESCRIPTIONS[`${s.slug}.${key}`], `${s.slug}.${key}`).toBeTruthy();
      }
    }
    const known = new Set(SERVERS.map((s) => s.slug));
    for (const slug of Object.keys(FR_DESCRIPTIONS)) expect(known.has(slug), slug).toBe(true);
  });
});

describe("text helpers", () => {
  it("fitTitle takes the first candidate that fits", () => {
    expect(fitTitle(["a".repeat(61), "short"])).toBe("short");
    expect(fitTitle(["x".repeat(10)], 5).length).toBeLessThanOrEqual(5);
  });

  it("clampText cuts on a word and marks the cut", () => {
    expect(clampText("short text", 155)).toBe("short text");
    const out = clampText("word ".repeat(60), 50);
    expect(out.length).toBeLessThanOrEqual(50);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it("joinList reads naturally in both languages", () => {
    expect(joinList(["A"], "en")).toBe("A");
    expect(joinList(["A", "B", "C"], "en")).toBe("A, B and C");
    expect(joinList(["A", "B"], "fr")).toBe("A et B");
  });
});

describe("parseLaunch", () => {
  it("reads a pinned scoped npm package and keeps the arguments", () => {
    const l = parseLaunch("npx -y @stripe/mcp@0.3.3 --tools=all --api-key=$STRIPE_SECRET_KEY");
    expect(l).toMatchObject({
      runtime: "node",
      launcher: "npx",
      packageName: "@stripe/mcp",
      pinnedVersion: "0.3.3",
    });
    expect(l.command).toContain("--api-key=$STRIPE_SECRET_KEY");
  });

  it("reads an unscoped npm package", () => {
    expect(parseLaunch("npx -y airtable-mcp-server@1.14.0")).toMatchObject({
      packageName: "airtable-mcp-server",
      pinnedVersion: "1.14.0",
    });
  });

  it("reads a Python package run with uvx (unpinned)", () => {
    expect(parseLaunch("uvx postgres-mcp --access-mode=restricted")).toMatchObject({
      runtime: "python",
      launcher: "uvx",
      packageName: "postgres-mcp",
      pinnedVersion: null,
      fromGit: false,
    });
  });

  it("reads a uvx --from git source", () => {
    expect(
      parseLaunch("uvx --from git+https://example.com/repo.git@main#subdirectory=x revit-mcp")
    ).toMatchObject({ runtime: "python", packageName: "revit-mcp", fromGit: true });
  });

  it("parses every catalogue entry", () => {
    for (const s of SERVERS) {
      const l = parseLaunch(s.seed.startCmd);
      expect(l.runtime, s.slug).not.toBe("other");
      expect(l.packageName, s.slug).toBeTruthy();
      // An npm pin in the command matches the seed's version field.
      if (l.launcher === "npx") expect(l.pinnedVersion, s.slug).toBe(s.seed.version);
    }
  });
});

describe("per-MCP pages", () => {
  for (const locale of LOCALES) {
    it(`fit search limits and carry 3 steps + 3 FAQ (${locale})`, () => {
      const metas = new Set<string>();
      for (const s of SERVERS) {
        const d = buildServerPage(s, locale);
        expect(d.title.length, `${s.slug} title "${d.title}"`).toBeLessThanOrEqual(TITLE_MAX);
        expect(d.metaDescription.length, s.slug).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(d.h1).toContain(s.name);
        expect(d.steps).toHaveLength(3);
        expect(d.faq).toHaveLength(3);
        metas.add(d.metaDescription);
        expect(d.languages).toEqual({
          en: `/servers/${s.slug}`,
          fr: `/fr/serveurs/${s.slug}`,
          "x-default": `/servers/${s.slug}`,
        });
      }
      // No two pages share a description (no spun duplicates).
      expect(metas.size).toBe(SERVERS.length);
    });
  }

  it("names every required key in the install step and the FAQ", () => {
    for (const s of SERVERS) {
      const d = buildServerPage(s, "en");
      for (const key of d.requiredKeys) {
        expect(d.steps[1]!.text, s.slug).toContain(key);
        expect(d.faq[0]!.a, s.slug).toContain(key);
      }
      if (d.requiredKeys.length === 0) expect(d.faq[0]!.q).toMatch(/need an API key/);
    }
  });

  it("states the real runtime in the HowTo steps", () => {
    const stripe = buildServerPage(getServerBySlug("stripe")!, "en");
    expect(stripe.steps[1]!.text).toContain("npm package @stripe/mcp@0.3.3");
    expect(stripe.steps[1]!.text).toContain("with npx");
    const fetch = buildServerPage(getServerBySlug("fetch")!, "en");
    expect(fetch.steps[1]!.text).toContain("Python package mcp-server-fetch");
    expect(fetch.steps[1]!.text).toContain("with uvx");
  });

  it("explains local tools through the local agent, never a box", () => {
    const locals = SERVERS.filter((s) => s.hostMode === "local");
    expect(locals.map((s) => s.slug)).toEqual(["blender", "revit"]);
    for (const s of locals) {
      const d = buildServerPage(s, "en");
      expect(d.steps[0]!.text).toContain(LOCAL_AGENT.en);
      expect(d.faq[1]!.a).toContain(LOCAL_AGENT.en);
      expect(d.faq[1]!.a).not.toMatch(/Upstash Box/);
    }
  });

  it("never tells visitors to run `ctx7 connect` (npx ctx7 is Upstash's Context7 CLI)", () => {
    const STALE = /ctx7 connect/;
    for (const locale of LOCALES) {
      for (const s of SERVERS) {
        expect(JSON.stringify(buildServerPage(s, locale)), `${locale} ${s.slug}`).not.toMatch(
          STALE
        );
      }
      for (const { slug, client } of clientPageParams(locale)) {
        const d = buildClientPage(getServerBySlug(slug)!, client, locale);
        expect(JSON.stringify(d), `${locale} ${slug}/${client}`).not.toMatch(STALE);
      }
      expect(COPY[locale].localText("Blender")).not.toMatch(STALE);
      expect(COPY[locale].localText("Blender")).toContain(LOCAL_AGENT[locale]);
    }
  });

  it("quotes the sign-up credit and the wallet prices", () => {
    const w = walletFacts("en");
    const d = buildServerPage(getServerBySlug("memory")!, "en");
    const plan = d.faq[2]!.a;
    expect(plan).toMatch(/^Yes\./);
    expect(plan).toContain(`${PLAN_CAPABILITIES.free.servers} server`);
    expect(plan).toContain(`${w.signupCredit} of free credit, valid ${w.signupDays} days`);
    expect(plan).toContain(`${w.per1000Calls} per 1,000`);
    expect(plan).not.toMatch(/€14\.99|a day|Free plan/);
  });

  it("does not promise the sign-up credit for MCPs it excludes", () => {
    const shell = getServerBySlug("shell");
    if (!shell) return;
    const plan = buildServerPage(shell, "en").faq[2]!.a;
    expect(plan).toMatch(/^Not on the free credit alone/);
    const fr = buildServerPage(shell, "fr").faq[2]!.a;
    expect(fr).toMatch(/^Pas avec le crédit offert seul/);
  });

  it("promises nothing the product does not sell", () => {
    for (const locale of LOCALES) {
      for (const s of SERVERS) {
        const d = buildServerPage(s, locale);
        const text = [...d.steps.map((x) => x.text), ...d.faq.map((f) => `${f.q} ${f.a}`)].join(
          " "
        );
        expect(text, s.slug).not.toMatch(BANNED);
      }
    }
  });

  it("links related MCPs from the same category only", () => {
    for (const s of SERVERS) {
      for (const r of relatedServers(s)) {
        expect(r.slug).not.toBe(s.slug);
        expect(r.categoryKey).toBe(s.categoryKey);
      }
    }
  });
});

describe("per-MCP × client pages", () => {
  it("covers every MCP × named client in English", () => {
    expect(clientPageParams("en")).toHaveLength(SERVERS.length * MATRIX_CLIENTS.length);
  });

  it("limits French guides to a curated set of high-intent MCPs", () => {
    const known = new Set(publicSeed.map((m) => m.slug));
    for (const slug of FR_SERVER_CLIENT_GUIDE_SLUGS) expect(known.has(slug), slug).toBe(true);
    expect(new Set(FR_SERVER_CLIENT_GUIDE_SLUGS).size).toBe(FR_SERVER_CLIENT_GUIDE_SLUGS.length);
    expect(FR_SERVER_CLIENT_GUIDE_SLUGS).not.toContain("everything");
    expect(FR_SERVER_CLIENT_GUIDE_SLUGS).not.toContain("calculator");
    expect(clientPageParams("fr")).toHaveLength(
      FR_SERVER_CLIENT_GUIDE_SLUGS.length * MATRIX_CLIENTS.length
    );
    expect(resolveClientParams("notion", "cursor", "fr")).not.toBeNull();
    expect(resolveClientParams("everything", "cursor", "fr")).toBeNull();
    expect(resolveClientParams("fetch", "cursor", "fr")).not.toBeNull();
  });

  it("indexes the client guides of a pinned set of MCPs only", () => {
    expect([...INDEXED_CLIENT_GUIDE_SLUGS]).toEqual([
      "filesystem",
      "fetch",
      "notion",
      "slack",
      "postgres",
      "linear",
      "stripe",
      "supabase",
    ]);
    const known = new Set(publicSeed.map((m) => m.slug));
    for (const slug of INDEXED_CLIENT_GUIDE_SLUGS) expect(known.has(slug), slug).toBe(true);
    expect(indexedClientPageParams("en")).toHaveLength(
      INDEXED_CLIENT_GUIDE_SLUGS.length * MATRIX_CLIENTS.length
    );
    for (const p of indexedClientPageParams("fr")) {
      expect(FR_SERVER_CLIENT_GUIDE_SLUGS).toContain(p.slug);
    }
    expect(isClientGuideIndexed("everything")).toBe(false);
    expect(isClientGuideIndexed("notion")).toBe(true);
  });

  it("fit search limits, use the real snippet and stay distinct", () => {
    const metas = new Set<string>();
    let count = 0;
    for (const locale of LOCALES) {
      for (const { slug, client } of clientPageParams(locale)) {
        const d = buildClientPage(getServerBySlug(slug)!, client, locale);
        count++;
        metas.add(d.metaDescription);
        expect(d.title.length, `${slug}/${client} "${d.title}"`).toBeLessThanOrEqual(TITLE_MAX);
        expect(d.metaDescription.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
        expect(d.snippet.code).toContain(d.server.mcpUrl);
        expect(d.snippet.code).toContain(`Bearer ${API_KEY_PLACEHOLDER}`);
        expect(d.steps).toHaveLength(4);
        expect(d.troubleshooting.length).toBeGreaterThanOrEqual(3);
        expect(d.languages.fr === undefined).toBe(!FR_SERVER_CLIENT_GUIDE_SLUGS.includes(slug));
        const text = [...d.notes, ...d.troubleshooting.map((x) => x.text)].join(" ");
        expect(text).not.toMatch(BANNED);
      }
    }
    expect(metas.size).toBe(count);
  });

  it("bridges stdio-only clients through mcp-remote and says Node.js 18+", () => {
    for (const client of MATRIX_CLIENTS) {
      const d = buildClientPage(getServerBySlug("fetch")!, client, "en");
      const bridged = client === "claude-desktop" || client === "zed";
      expect(d.snippet.bridged, client).toBe(bridged);
      expect(d.notes.join(" ").includes("Node.js 18+"), client).toBe(bridged);
    }
  });

  it("keeps the MCP's own secrets out of the client config", () => {
    const d = buildClientPage(getServerBySlug("stripe")!, "cursor", "en");
    expect(d.snippet.code).not.toContain("STRIPE_SECRET_KEY");
    expect(d.notes.join(" ")).toContain("STRIPE_SECRET_KEY stays on TwinMCP");
  });

  it("points troubleshooting at the docs anchors", () => {
    const en = buildClientPage(getServerBySlug("fetch")!, "cursor", "en");
    expect(en.troubleshooting.map((x) => x.href)).toEqual(
      expect.arrayContaining(["/docs#error-401", "/docs#error-503", "/docs#error-402"])
    );
    const fr = buildClientPage(getServerBySlug("fetch")!, "cursor", "fr");
    for (const x of fr.troubleshooting) expect(x.href).toBe("/fr/docs#troubleshooting");
    const local = buildClientPage(getServerBySlug("blender")!, "zed", "en");
    expect(local.troubleshooting.map((x) => x.title)).toContain("Local agent offline");
  });

  it("names the client's config file", () => {
    expect(configFileName(clientSnippet("fetch", "cursor", "en"))).toBe("mcp.json");
    expect(configFileName(clientSnippet("fetch", "claude-desktop", "en"))).toBe(
      "claude_desktop_config.json"
    );
    expect(configFileName(clientSnippet("fetch", "cline", "en"))).toBe("cline_mcp_settings.json");
    expect(configFileName(clientSnippet("fetch", "claude-code", "en"))).toBeNull();
  });
});

describe("language switch between /servers and /fr/serveurs", () => {
  it("maps the index and every per-MCP page", () => {
    expect(localizedPath("/servers", "fr")).toBe("/fr/serveurs");
    expect(localizedPath("/fr/serveurs", "en")).toBe("/servers");
    expect(localizedPath("/servers/notion", "fr")).toBe("/fr/serveurs/notion");
    expect(localizedPath("/fr/serveurs/notion/", "en")).toBe("/servers/notion");
  });

  it("offers French client guides only where they exist", () => {
    expect(localizedPath("/servers/fetch/cursor", "fr")).toBe("/fr/serveurs/fetch/cursor");
    expect(localizedPath("/servers/linear/cursor", "fr")).toBeNull();
    expect(localeSwitchTargets("/servers/linear/cursor")).toBeNull();
    expect(localeSwitchTargets("/fr/serveurs/fetch/zed")).toEqual({
      en: "/servers/fetch/zed",
      fr: "/fr/serveurs/fetch/zed",
    });
  });

  it("leaves other paths and the prefix-twin allow-list alone", () => {
    expect(localizedPath("/serversfoo", "fr")).toBeNull();
    expect(hasFrenchVersion("/servers")).toBe(false);
    expect(localizedPath("/plans", "fr")).toBe("/fr/tarifs");
  });
});
