// "Connect your IDE" data for the docs pages, generated from the same
// buildClientConfig() the dashboard Connect panel and onboarding use, so the
// documented file paths and snippets cannot drift from what users are given.
// Pure module: no React, safe to unit-test.

import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  MATRIX_CLIENTS,
  buildClientConfig,
  proxyUrl,
  type IdeKey,
} from "@/lib/mcp/client-config";
import type { Locale } from "@/lib/i18n/locales";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

/** Example slugs shown in the snippets; the URL shape is the real one. */
export const DOCS_EXAMPLE = {
  en: { server: "my-server", mcp: "notion" },
  fr: { server: "mon-serveur", mcp: "notion" },
} as const satisfies Record<Locale, { server: string; mcp: string }>;

/**
 * French wording for the few `filename` values that are an instruction rather
 * than a path. Everything else (real file paths, the client's own English menu
 * names) is shown exactly as buildClientConfig() returns it.
 */
const FR_LOCATION: Partial<Record<IdeKey, string>> = {
  "claude-code": "Claude Code — à lancer dans votre terminal",
};

export interface DocsClientEntry {
  ide: IdeKey;
  /** Client name as the dashboard shows it. */
  name: string;
  /** Where the snippet goes: config file path, or the command to run. */
  location: string;
  /** "json" | "bash" — from buildClientConfig(). */
  language: string;
  /** The exact snippet, with the example URL and the key placeholder. */
  code: string;
  /** True when the client only loads stdio servers and goes through mcp-remote. */
  bridged: boolean;
  /** True when the snippet is a terminal command rather than a file. */
  command: boolean;
}

/** The example MCP URL used in the docs snippets for a locale. */
export function docsExampleUrl(locale: Locale, siteUrl: string = SITE_URL): string {
  const e = DOCS_EXAMPLE[locale];
  return proxyUrl(siteUrl, e.server, e.mcp);
}

/** Every named MCP client the dashboard supports, in dashboard order. */
export function docsClientEntries(locale: Locale, siteUrl: string = SITE_URL): DocsClientEntry[] {
  const url = docsExampleUrl(locale, siteUrl);
  const label = DOCS_EXAMPLE[locale].mcp;
  return MATRIX_CLIENTS.map((ide) => {
    const cfg = buildClientConfig(ide, { url, apiKey: API_KEY_PLACEHOLDER, label });
    return {
      ide,
      name: IDE_LABELS[ide],
      location: (locale === "fr" && FR_LOCATION[ide]) || cfg.filename,
      language: cfg.language,
      code: cfg.code,
      bridged: cfg.code.includes("mcp-remote"),
      command: cfg.language === "bash",
    };
  });
}
