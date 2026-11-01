import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { Prose } from "./prose";
import { PostCta } from "./post-cta";
import { getRelatedServers } from "@/lib/servers/catalog";

export interface FrPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingTimeMinutes: number;
  tags: string[];
}

interface FrPostLayoutProps {
  post: FrPost;
  related?: { slug: string; title: string; description: string; readingTimeMinutes: number }[];
  children: React.ReactNode;
  extraSchemas?: object[];
}

// Running head over a footer block, with its "see all" link on the same line.
const RUNNING_HEAD = "mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";

// Related items are interactive cards (docs/DESIGN.md, Card recipes).
const RELATED_CARD =
  "group block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md";

export function FrPostLayout({
  post,
  related = [],
  children,
  extraSchemas = [],
}: FrPostLayoutProps) {
  const relatedServers = getRelatedServers(post.slug, 4);
  const publishedDate = new Date(post.publishedAt).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Blog", url: "/fr/blog" },
            { name: post.title, url: `/fr/blog/${post.slug}` },
          ]),
          articleSchema({
            headline: post.title,
            description: post.description,
            url: `/fr/blog/${post.slug}`,
            datePublished: post.publishedAt,
            inLanguage: "fr",
          }),
          ...extraSchemas,
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={"/fr/blog" as Route} className="hover:text-foreground">
                Blog
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="line-clamp-1 min-w-0 text-foreground">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* Dateline, title, standfirst and tags, closed by one hairline. */}
        <header className="mb-10 border-b border-border pb-10">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{publishedDate}</time>
            <span aria-hidden>·</span>
            <span>
              <span className="tabular-nums">{post.readingTimeMinutes}</span> min de lecture
            </span>
          </p>
          <h1 className="mt-4 text-balance font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl sm:leading-[1.1]">
            {post.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground md:text-xl">
            {post.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
        </header>

        <Prose>{children}</Prose>

        <footer className="mt-16">
          <PostCta locale="fr" />

          <div className="mt-14">
            <div className={RUNNING_HEAD}>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Serveurs MCP associés
              </h2>
              <Link
                href={"/fr/serveurs" as Route}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Voir tous les serveurs
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {relatedServers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedServers.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/fr/serveurs/${s.slug}` as Route}
                    className={RELATED_CARD}
                  >
                    <div className="flex items-center gap-3">
                      {hasBrandLogo(s.slug) ? (
                        <BrandLogo slug={s.slug} size={24} decorative />
                      ) : null}
                      <h3 className="font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-brand">
                        {s.name}
                      </h3>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.tagline}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Explorez le{" "}
                <Link
                  href={"/fr/serveurs" as Route}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  catalogue de serveurs MCP
                </Link>{" "}
                — installez-en un sur un runtime hébergé en un clic.
              </p>
            )}
          </div>

          {related.length > 0 && (
            <div className="mt-14">
              <div className={RUNNING_HEAD}>
                <h2 className="font-display text-2xl font-bold tracking-tight">
                  Continuer la lecture
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link key={r.slug} href={`/fr/blog/${r.slug}` as Route} className={RELATED_CARD}>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{r.readingTimeMinutes}</span> min de lecture
                    </p>
                    <h3 className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight group-hover:text-brand">
                      {r.title}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {r.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </footer>
      </article>
    </>
  );
}
