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
      {/* A strip of figures between two hairlines, captions in small capitals. */}
      <div className="grid divide-y divide-border border-y border-border md:grid-cols-3 md:divide-x md:divide-y-0">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center px-6 py-8 text-center md:py-10">
            <span className="lining text-4xl font-medium md:text-5xl">{s.value}</span>
            <span className="smallcaps tracking-sc mt-2 text-xs text-muted-foreground">
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
