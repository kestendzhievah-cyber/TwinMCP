import { Section } from "./section";

const quotes = [
  {
    body: "I had a working postgres MCP wired into Cursor in under five minutes. The fact that I never touched Docker is the point.",
    name: "Léa M.",
    role: "Senior engineer · fintech",
  },
  {
    body: "We were running our own MCP gateway on a VPS — pager duty plus a dependency we didn't want. Migrated 4 servers in one afternoon.",
    name: "Tarek B.",
    role: "Staff engineer · infra",
  },
  {
    body: "Audit logs and per-server API keys made our security review a 30-min conversation instead of a sprint.",
    name: "Priya S.",
    role: "Tech lead · agency",
  },
];

const stats = [
  { value: "5", label: "Official MCPs at launch" },
  { value: "<10s", label: "Median provisioning" },
  { value: "0", label: "Dockerfiles to write" },
];

export function SocialProof() {
  return (
    <Section bordered>
      <div className="grid gap-5 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.name}
            className="flex h-full flex-col justify-between rounded-xl border border-border/80 bg-card p-6"
          >
            <blockquote className="text-sm leading-relaxed text-foreground/90">
              <span className="text-muted-foreground" aria-hidden>
                &ldquo;
              </span>
              {q.body}
              <span className="text-muted-foreground" aria-hidden>
                &rdquo;
              </span>
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 text-xs">
              <span
                aria-hidden
                className="grid h-8 w-8 place-items-center rounded-full bg-secondary font-mono text-[11px] font-semibold text-foreground"
              >
                {q.name
                  .split(" ")
                  .map((p) => p[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <span>
                <span className="block font-medium text-foreground">{q.name}</span>
                <span className="block text-muted-foreground">{q.role}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-12 grid gap-6 rounded-xl border border-border/80 bg-card p-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-border/60 md:p-0">
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
