import { Badge } from "@/components/ui/badge";
import type { Locale } from "@/lib/i18n/locales";
import {
  CHANGELOG,
  dayLabel,
  groupChangelogByMonth,
  type ChangeKind,
} from "@/lib/marketing/changelog";
import { Section } from "./section";

const KIND: Record<ChangeKind, { variant: "brand" | "info" | "success"; en: string; fr: string }> =
  {
    new: { variant: "brand", en: "New", fr: "Nouveau" },
    improved: { variant: "info", en: "Improved", fr: "Amélioré" },
    fixed: { variant: "success", en: "Fixed", fr: "Corrigé" },
  };

const COPY: Record<Locale, { eyebrow: string; title: string; description: string }> = {
  en: {
    eyebrow: "Changelog",
    title: "What shipped in TwinMCP",
    description:
      "Features and fixes that are live today, newest first. Nothing here is a promise of what comes next.",
  },
  fr: {
    eyebrow: "Nouveautés",
    title: "Ce qui a changé dans TwinMCP",
    description:
      "Les fonctionnalités et corrections en ligne aujourd’hui, des plus récentes aux plus anciennes. Rien ici n’annonce ce qui viendra ensuite.",
  },
};

// One month per card, each entry a dated row with a semantic tint for its
// kind (docs/DESIGN.md, Badge).
export function ChangelogView({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const months = groupChangelogByMonth(CHANGELOG, locale);
  return (
    <Section eyebrow={t.eyebrow} title={t.title} description={t.description}>
      <div className="mx-auto max-w-3xl space-y-10 md:space-y-12">
        {months.map((month) => (
          <section key={month.key} aria-labelledby={`month-${month.key}`}>
            <h2
              id={`month-${month.key}`}
              className="mb-4 font-display text-xl font-bold tracking-tight"
            >
              {month.label}
            </h2>
            <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              {month.entries.map((entry) => {
                const kind = KIND[entry.kind];
                const text = entry[locale];
                return (
                  <li
                    key={`${entry.date}-${entry.en.title}`}
                    className="grid gap-2 p-5 sm:grid-cols-[8rem_1fr] sm:gap-6 sm:p-6"
                  >
                    <div className="flex items-center gap-3 sm:flex-col sm:items-start">
                      <time
                        dateTime={entry.date}
                        className="text-sm tabular-nums text-muted-foreground"
                      >
                        {dayLabel(entry.date, locale)}
                      </time>
                      <Badge variant={kind.variant}>{kind[locale]}</Badge>
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-lg font-semibold tracking-tight">
                        {text.title}
                      </h3>
                      <p className="mt-1 text-base leading-7 text-muted-foreground">{text.body}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </Section>
  );
}
