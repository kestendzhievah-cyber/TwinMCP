import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import type { UseCase } from "@/lib/use-cases/registry";
import { getServersBySlugs } from "@/lib/servers/catalog";
import { getPostsBySlugs } from "@/lib/blog/posts";
import { OfferTerms, offerCopy } from "@/components/marketing/offer-badge";

export interface BenefitBlock {
  title: string;
  body: string;
}

export interface HowItWorksStep {
  title: string;
  body: string;
}

export interface UseCaseFaqItem {
  q: string;
  a: string;
}

interface UseCaseLayoutProps {
  useCase: UseCase;
  benefits: BenefitBlock[];
  steps: HowItWorksStep[];
  faq: UseCaseFaqItem[];
  extraSchemas?: object[];
  children?: React.ReactNode; // optional extra middle section
}

// "Clear sky" recipes (docs/DESIGN.md): plain eyebrow, display H2/H3.
const H2 = "mt-3 text-balance font-display text-3xl font-bold tracking-tight md:text-4xl";
const H3 = "font-display text-lg font-semibold tracking-tight";

export function UseCaseLayout({
  useCase,
  benefits,
  steps,
  faq,
  extraSchemas = [],
  children,
}: UseCaseLayoutProps) {
  const relatedServers = getServersBySlugs(useCase.relatedServerSlugs);
  const relatedPosts = getPostsBySlugs(useCase.relatedBlogSlugs);
  const offer = offerCopy("en");
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Use cases", url: "/use-cases" },
            { name: useCase.title, url: `/use-cases/${useCase.slug}` },
          ]),
          faqPageSchema(faq),
          ...extraSchemas,
        ]}
      />

      <div className="mx-auto max-w-5xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-10 text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={"/use-cases" as Route} className="hover:text-foreground">
                Use cases
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              {useCase.title}
            </li>
          </ol>
        </nav>

        {/* Hero */}
        <section className="pb-16 text-center md:pb-24">
          <p className="eyebrow">{useCase.heroEyebrow}</p>
          <h1 className="mt-3 text-balance font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {useCase.heroHeadline}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            {useCase.heroSubheadline}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up?plan=free" as Route}>
                {offer.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/plans">See pricing</Link>
            </Button>
          </div>
          <OfferTerms className="mt-6" />
        </section>

        {/* Benefits */}
        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Benefits</p>
            <h2 className={H2}>Why teams use TwinMCP for {useCase.title.toLowerCase()}</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {benefits.map((b, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6"
              >
                <h3 className={H3}>{b.title}</h3>
                <p className="mt-2 text-base text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works — numbered ledger */}
        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">How it works</p>
            <h2 className={H2}>From signup to connected agent</h2>
          </div>
          <ol className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-6 py-6">
                <span
                  aria-hidden
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold tabular-nums text-brand-foreground"
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className={H3}>{s.title}</h3>
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Optional extra content from each page */}
        {children}

        {/* FAQ */}
        <section className="border-t border-border py-16 md:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">Questions</p>
            <h2 className={H2}>Common questions about {useCase.title.toLowerCase()}</h2>
          </div>
          <dl className="mx-auto mt-12 max-w-3xl divide-y divide-border border-y border-border">
            {faq.map((item, i) => (
              <div key={i} className="py-6">
                <dt className="text-lg font-semibold">{item.q}</dt>
                <dd className="mt-2 text-base leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Related MCP servers + reading (internal linking) */}
        {(relatedServers.length > 0 || relatedPosts.length > 0) && (
          <section className="grid gap-12 border-t border-border py-16 md:grid-cols-2 md:py-20">
            {relatedServers.length > 0 && (
              <div>
                <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-3">
                  <h2 className={H3}>Related MCP servers</h2>
                  <Link href={"/servers" as Route} className="text-sm text-brand hover:underline">
                    All servers →
                  </Link>
                </div>
                <ul className="divide-y divide-border">
                  {relatedServers.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/servers/${s.slug}` as Route}
                        className="group block py-4 transition-colors hover:text-brand"
                      >
                        <span className="font-medium group-hover:underline">{s.name}</span>
                        <span className="mt-1 line-clamp-1 block text-sm text-muted-foreground">
                          {s.tagline}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {relatedPosts.length > 0 && (
              <div>
                <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-3">
                  <h2 className={H3}>Related reading</h2>
                  <Link href={"/blog" as Route} className="text-sm text-brand hover:underline">
                    All posts →
                  </Link>
                </div>
                <ul className="divide-y divide-border">
                  {relatedPosts.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/blog/${p.slug}` as Route}
                        className="group block py-4 transition-colors hover:text-brand"
                      >
                        <span className="font-medium leading-snug group-hover:underline">
                          {p.title}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">
                          {p.description}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Final CTA — a band panel, never navy */}
        <section className="mx-auto max-w-3xl rounded-3xl bg-surface-band p-8 text-center md:p-14">
          <p className="eyebrow">Get started</p>
          <h2 className="mt-3 text-balance font-display text-2xl font-bold tracking-tight md:text-3xl">
            Ready to run {useCase.title.toLowerCase()} on TwinMCP?
          </h2>
          <p className="mt-3 text-muted-foreground">{offer.termsLine}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up?plan=free" as Route}>
                {offer.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href={"/docs" as Route}>Read the docs</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
