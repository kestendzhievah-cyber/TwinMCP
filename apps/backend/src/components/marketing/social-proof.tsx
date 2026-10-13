import { Section } from "./section";

// Verifiable product facts only — no testimonials until we have real,
// consented customer quotes (fabricated quotes are a deceptive practice).
const stats = [
  { value: "70+", label: "MCPs in the catalog" },
  { value: "<10s", label: "Median provisioning" },
  { value: "0", label: "Dockerfiles to write" },
];

export function SocialProof() {
  return (
    <Section bordered>
      <div className="grid gap-6 rounded-xl border border-border/80 bg-card p-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border/60 md:p-0">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center px-6 py-4 text-center md:py-7">
            <span className="text-3xl font-semibold tracking-tight md:text-4xl">{s.value}</span>
            <span className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
