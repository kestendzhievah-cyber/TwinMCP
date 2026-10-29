import type { Locale } from "@/lib/i18n/locales";
import { docsClientEntries } from "@/components/docs/client-setup";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";

// One collapsible entry per supported MCP client, generated from
// lib/mcp/client-config.ts (see client-setup.ts). Native <details>: no JS, and
// browsers open a closed entry when Ctrl+F lands inside it.

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
    native: "Streamable HTTP natif : le client se connecte directement à l’URL.",
    bridged:
      "Client stdio uniquement : le bloc lance le pont mcp-remote via npx, Node.js 18+ doit donc être installé. Redémarrez complètement le client après avoir enregistré le fichier.",
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function ClientSetupList({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const entries = docsClientEntries(locale);

  return (
    <div className="mt-6 divide-y divide-border border-y border-border">
      {entries.map((e) => (
        <details key={e.ide} id={`client-${e.ide}`} className="group py-1">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 [&::-webkit-details-marker]:hidden">
            <strong className="smallcaps tracking-sc">{e.name}</strong>
            <span
              aria-hidden
              className="text-sm text-muted-foreground transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="space-y-3 pb-5">
            <p className="break-words text-base leading-7">
              <span className="smallcaps tracking-sc text-sm text-muted-foreground">
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
      ))}
    </div>
  );
}
