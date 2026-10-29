import type { Locale } from "@/lib/i18n/locales";

// Every client the dashboard generates a config block for (lib/mcp/client-config.ts).
const ides = [
  { name: "Cursor", wordmark: "Cursor" },
  { name: "Claude Code", wordmark: "Claude Code" },
  { name: "Claude Desktop", wordmark: "Claude Desktop" },
  { name: "VS Code", wordmark: "VS Code" },
  { name: "Windsurf", wordmark: "Windsurf" },
  { name: "Cline", wordmark: "Cline" },
  { name: "Zed", wordmark: "Zed" },
];

const EYEBROW: Record<Locale, string> = {
  en: "One URL, in the AI client you already use",
  fr: "Une URL, dans le client IA que vous utilisez déjà",
};

// The "clients" line of the card: an eyebrow between two hairlines, then the
// IDE names set as letterspaced small capitals on one rule-bound band.
export function IdeLogosBar({ locale = "en" }: { locale?: Locale }) {
  return (
    <div className="border-y border-border">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="eyebrow flex items-center justify-center gap-4 text-center before:hidden before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:hidden after:h-px after:w-10 after:shrink-0 after:bg-border after:content-[''] sm:before:block sm:after:block">
          {EYEBROW[locale]}
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 md:gap-x-12">
          {ides.map((ide) => (
            <li
              key={ide.name}
              className="smallcaps tracking-sc text-base font-medium text-muted-foreground transition-colors hover:text-foreground md:text-lg"
              aria-label={ide.name}
            >
              {ide.wordmark}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
