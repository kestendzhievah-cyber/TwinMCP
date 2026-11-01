import { BrandLogo, MCP_LOGO_KEY } from "@/components/brand/brand-logo";
import type { Locale } from "@/lib/i18n/locales";

// Every client the dashboard generates a config block for
// (lib/mcp/client-config.ts), in "works with" order. These are compatible
// clients, never "customers". VS Code is text only: Microsoft does not allow
// its icon here, so a plain word chip holds its place (no Copilot mark either).
const CLIENTS: { key: string; name: string; logo: string | null }[] = [
  { key: "cursor", name: "Cursor", logo: "cursor" },
  { key: "claude-code", name: "Claude Code", logo: "claude-code" },
  { key: "claude-desktop", name: "Claude Desktop", logo: "claude-desktop" },
  { key: "vscode", name: "VS Code", logo: null },
  { key: "windsurf", name: "Windsurf", logo: "windsurf" },
  { key: "cline", name: "Cline", logo: "cline" },
  { key: "zed", name: "Zed", logo: "zed" },
];

const COPY: Record<Locale, { eyebrow: string; list: string; any: string }> = {
  en: { eyebrow: "Works with", list: "Compatible MCP clients", any: "Any MCP client" },
  fr: { eyebrow: "Compatible avec", list: "Clients MCP compatibles", any: "Tout client MCP" },
};

export function IdeLogosBar({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const items = [...CLIENTS, { key: "other", name: t.any, logo: MCP_LOGO_KEY }];
  return (
    <section aria-label={t.eyebrow} className="bg-surface-band py-8">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="eyebrow text-center">{t.eyebrow}</p>
        <ul
          aria-label={t.list}
          className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-x-4 gap-y-4 sm:flex sm:max-w-none sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-8 md:gap-x-10"
        >
          {items.map((c) => (
            <li
              key={c.key}
              className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"
            >
              {c.logo ? (
                <>
                  <BrandLogo slug={c.logo} size={24} decorative className="shrink-0" />
                  <span className="truncate">{c.name}</span>
                </>
              ) : (
                // Text only, styled as a word chip: no substitute mark.
                <span className="truncate rounded-md border border-border bg-card px-2 py-0.5">
                  {c.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
