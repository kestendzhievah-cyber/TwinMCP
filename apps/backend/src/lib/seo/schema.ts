// JSON-LD schema.org helpers for SEO rich snippets.
// Each helper returns a plain object ready to be stringified inside a
// <script type="application/ld+json"> tag (use the JsonLd component).

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const ORG_NAME = "TwinMCP";
const ORG_LOGO = `${SITE_URL}/icon-512.png`;
const ORG_SAME_AS = [
  "https://twitter.com/twinmcp",
  "https://github.com/twinmcp",
  "https://github.com/kestendzhievah-cyber/TwinMCP",
];

function abs(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: ORG_NAME,
    url: SITE_URL,
    logo: ORG_LOGO,
    sameAs: ORG_SAME_AS,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@twinmcp.fr",
        availableLanguage: ["English"],
      },
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: "sales@twinmcp.fr",
        availableLanguage: ["English"],
      },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: ORG_NAME,
    inLanguage: "en",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/docs?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export interface SoftwareOffer {
  name: string;
  price: string;
  priceCurrency?: string;
  url?: string;
}

export interface SoftwareApplicationOptions {
  name?: string;
  description?: string;
  offers?: SoftwareOffer[];
  rating?: { value: number; count: number };
}

export function softwareApplicationSchema(opts: SoftwareApplicationOptions = {}) {
  const offers = (opts.offers ?? []).map((o) => ({
    "@type": "Offer",
    name: o.name,
    price: o.price,
    priceCurrency: o.priceCurrency ?? "USD",
    ...(o.url ? { url: abs(o.url) } : {}),
  }));

  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: opts.name ?? ORG_NAME,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      opts.description ??
      "TwinMCP runs Model Context Protocol servers in isolated runtimes for AI coding agents (Cursor, Claude Code, Windsurf, Cline).",
    publisher: { "@id": `${SITE_URL}/#organization` },
    ...(offers.length > 0 ? { offers } : {}),
    ...(opts.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.rating.value,
            ratingCount: opts.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export interface FaqItemPlain {
  q: string;
  a: string;
}

export function faqPageSchema(items: FaqItemPlain[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export interface Breadcrumb {
  name: string;
  url: string;
}

export function breadcrumbListSchema(crumbs: Breadcrumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: abs(c.url),
    })),
  };
}

export interface ArticleSchemaOptions {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
}

export function articleSchema(opts: ArticleSchemaOptions) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.headline,
    description: opts.description,
    url: abs(opts.url),
    image: opts.image ? abs(opts.image) : undefined,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    inLanguage: "en",
    author: {
      "@type": "Organization",
      name: opts.authorName ?? ORG_NAME,
      url: SITE_URL,
    },
    publisher: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": abs(opts.url) },
  };
}

export interface HowToStep {
  name: string;
  text: string;
  url?: string;
}

export function howToSchema(opts: {
  name: string;
  description: string;
  totalTime?: string; // ISO 8601 duration, e.g. PT2M
  steps: HowToStep[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    ...(opts.totalTime ? { totalTime: opts.totalTime } : {}),
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: abs(s.url) } : {}),
    })),
  };
}

export interface ProductTier {
  id: string;
  name: string;
  description: string;
  priceMonthlyUsd: number | null;
  priceAnnualMonthlyUsd?: number | null;
  url: string;
}

export function productPricingSchema(opts: {
  name: string;
  description: string;
  tiers: ProductTier[];
}) {
  const offers = opts.tiers
    .filter((t) => t.priceMonthlyUsd !== null)
    .map((t) => ({
      "@type": "Offer",
      name: t.name,
      description: t.description,
      price: String(t.priceMonthlyUsd),
      priceCurrency: "USD",
      priceSpecification: [
        {
          "@type": "UnitPriceSpecification",
          price: t.priceMonthlyUsd,
          priceCurrency: "USD",
          unitText: "MONTH",
          billingDuration: 1,
          billingIncrement: 1,
        },
        ...(t.priceAnnualMonthlyUsd !== undefined && t.priceAnnualMonthlyUsd !== null
          ? [
              {
                "@type": "UnitPriceSpecification",
                price: t.priceAnnualMonthlyUsd,
                priceCurrency: "USD",
                unitText: "MONTH",
                billingDuration: 12,
                billingIncrement: 12,
              },
            ]
          : []),
      ],
      url: abs(t.url),
      availability: "https://schema.org/InStock",
    }));

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    description: opts.description,
    brand: { "@id": `${SITE_URL}/#organization` },
    offers,
  };
}
