import { Check, X } from "lucide-react";
import type { Locale } from "@/lib/i18n/locales";
import { Section } from "./section";
import { cn } from "@/lib/utils";

const COPY = {
  en: {
    eyebrow: "The problem",
    title: "Your agent is only as good as its context",
    description:
      "A local MCP server works on one laptop. Sharing it means Docker, TLS and a VPS to babysit. TwinMCP runs that layer for you, so you keep the servers without keeping a machine warm.",
    withoutTitle: "Without TwinMCP",
    withTitle: "With TwinMCP",
    without: [
      "A Docker image or a VPS to maintain just to host one MCP",
      "Secrets pasted into the shell profile of every machine",
      "One config to redo per IDE, per machine",
      "No logs when a tool call fails",
    ],
    with: [
      "Pick an MCP from the catalog, live in about 2 minutes",
      "Secrets encrypted at rest (AES-256-GCM), access by API key",
      "The same URL in Cursor, Claude Code, VS Code or Windsurf",
      "Live logs for every server",
    ],
  },
  fr: {
    eyebrow: "Le problème",
    title: "Votre agent ne vaut que par son contexte",
    description:
      "En local, un serveur MCP fonctionne sur un seul poste. Pour le partager, il faut Docker, du TLS et un VPS à surveiller. TwinMCP prend en charge cette couche : vous gardez vos serveurs, sans machine à entretenir.",
    withoutTitle: "Sans TwinMCP",
    withTitle: "Avec TwinMCP",
    without: [
      "Une image Docker ou un VPS à maintenir pour héberger un seul MCP",
      "Des secrets collés dans le profil shell de chaque poste",
      "Une configuration à refaire par IDE et par machine",
      "Aucun log quand un appel d’outil échoue",
    ],
    with: [
      "Un MCP choisi dans le catalogue, en ligne en 2 minutes environ",
      "Secrets chiffrés au repos (AES-256-GCM), accès par clé API",
      "La même URL dans Cursor, Claude Code, VS Code ou Windsurf",
      "Des logs en direct pour chaque serveur",
    ],
  },
} as const;

export function ProblemSolution({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section
      id="features"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      className="scroll-mt-20"
    >
      {/* One sheet of card stock ruled down the middle: a two-column ledger. */}
      <div className="grid divide-y divide-border border border-border bg-card shadow-sm md:grid-cols-2 md:divide-x md:divide-y-0">
        <Column
          tone="negative"
          icon={<X className="h-4 w-4" />}
          title={t.withoutTitle}
          items={t.without}
          itemIcon={<X className="mt-1 h-4 w-4 shrink-0 text-destructive" />}
        />
        <Column
          tone="positive"
          icon={<Check className="h-4 w-4" />}
          title={t.withTitle}
          items={t.with}
          itemIcon={<Check className="mt-1 h-4 w-4 shrink-0 text-success" />}
        />
      </div>
    </Section>
  );
}

function Column({
  tone,
  icon,
  title,
  items,
  itemIcon,
}: {
  tone: "positive" | "negative";
  icon: React.ReactNode;
  title: string;
  items: readonly string[];
  itemIcon: React.ReactNode;
}) {
  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 border-b border-foreground/50 pb-4">
        <span
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center border",
            tone === "negative"
              ? "border-destructive/40 bg-destructive/10 text-destructive"
              : "border-success/40 bg-success/10 text-success"
          )}
        >
          {icon}
        </span>
        <h3 className="smallcaps tracking-sc text-lg font-medium">{title}</h3>
      </div>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 py-3.5 text-base text-muted-foreground">
            {itemIcon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
