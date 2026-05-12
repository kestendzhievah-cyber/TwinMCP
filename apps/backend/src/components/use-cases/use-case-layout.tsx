import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, faqPageSchema } from "@/lib/seo/schema";
import type { UseCase } from "@/lib/use-cases/registry";

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

export function UseCaseLayout({
  useCase,
  benefits,
  steps,
  faq,
  extraSchemas = [],
  children,
}: UseCaseLayoutProps) {
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
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
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
        <section className="mb-20">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {useCase.heroEyebrow}
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            {useCase.heroHeadline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {useCase.heroSubheadline}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/plans"
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              See pricing
            </Link>
          </div>
        </section>

        {/* Benefits */}
        <section className="mb-20">
          <h2 className="text-3xl font-semibold tracking-tight">
            Why teams use TwinMCP for {useCase.title.toLowerCase()}
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {benefits.map((b, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold tracking-tight">{b.title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{b.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mb-20">
          <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-semibold">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Optional extra content from each page */}
        {children}

        {/* FAQ */}
        <section className="mb-20">
          <h2 className="text-3xl font-semibold tracking-tight">
            Common questions about {useCase.title.toLowerCase()}
          </h2>
          <dl className="mt-10 space-y-6">
            {faq.map((item, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <dt className="text-base font-semibold tracking-tight">{item.q}</dt>
                <dd className="mt-2 leading-relaxed text-muted-foreground">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Final CTA */}
        <section className="rounded-2xl border border-border bg-card p-10 text-center md:p-14">
          <h2 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
            Ready to run {useCase.title.toLowerCase()} on TwinMCP?
          </h2>
          <p className="mt-3 text-muted-foreground">
            Free tier — one server, the marketplace, no credit card.
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={"/sign-up?plan=free" as Route}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={"/docs" as Route}
              className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
            >
              Read the docs
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
