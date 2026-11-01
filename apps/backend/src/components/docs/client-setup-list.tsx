import { ChevronDown } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { docsClientEntries } from "@/components/docs/client-setup";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";

// One collapsible entry per supported MCP client, generated from
// lib/mcp/client-config.ts (see client-setup.ts). Native <details>: no JS, and
// browsers open a closed entry when Ctrl+F lands inside it. Each entry shows the
// client's own mark when it has one (VS Code is text only, by Microsoft's rules).

const COPY = {
  en: {
    file: "Config file",
    command: "Command",
    native: "Native Streamable HTTP: the client connects to the URL directly.",
    bridged:
      "Stdio-only client: the snippet runs the mcp-remote bridge through npx, so Node.js 18+ must be installed. Restart the client fully after saving the file.",
  },
  fr: {
    file: "Fichier de configuration",
    command: "Commande",
    native: "Streamable HTTP natif : le client se connecte directement à l’URL.",
    bridged:
      "Client stdio uniquement : le bloc lance le pont mcp-remote via npx, Node.js 18+ doit donc être installé. Redémarrez complètement le client après avoir enregistré le fichier.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function ClientSetupList({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const entries = docsClientEntries(locale);

  return (
    <div className="mt-6 space-y-3">
      {entries.map((e) => {
        const logo = e.ide;
        return (
          <details
            key={e.ide}
            id={`client-${e.ide}`}
            className="group scroll-mt-24 rounded-xl border border-border bg-card shadow-sm open:shadow-md"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-details-marker]:hidden">
              <span className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground"
                >
                  {hasBrandLogo(logo) ? (
                    <BrandLogo slug={logo} size={18} decorative />
                  ) : (
                    <span className="text-xs font-bold">{e.name.charAt(0)}</span>
                  )}
                </span>
                <strong className="truncate font-semibold">{e.name}</strong>
              </span>
              <ChevronDown
                aria-hidden
                className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>
            <div className="space-y-3 border-t border-border px-4 pb-5 pt-4">
              <p className="break-words text-base leading-7">
                <span className="text-sm font-semibold text-muted-foreground">
                  {e.command ? t.command : t.file}
                </span>{" "}
                — {e.command ? e.location : <code>{e.location}</code>}
              </p>
              <p className="text-sm leading-6 text-muted-foreground">
                {e.bridged ? t.bridged : t.native}
              </p>
              <DocsCodeBlock code={e.code} language={e.language} locale={locale} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
