import Link from "next/link";
import type { Route } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Prose } from "./prose";
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
          }),
          ...extraSchemas,
        ]}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
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
            <li aria-current="page" className="line-clamp-1 text-foreground">
              {post.title}
            </li>
          </ol>
        </nav>

        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{publishedDate}</time>
            <span aria-hidden>·</span>
            <span>{post.readingTimeMinutes} min de lecture</span>
            <span aria-hidden>·</span>
            <span className="flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-foreground"
                >
                  #{t}
                </span>
              ))}
            </span>
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{post.description}</p>
        </header>

        <Prose>{children}</Prose>

        <footer className="mt-16 border-t border-border pt-10">
          <div className="rounded-2xl border border-border/80 bg-card p-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">
              Prêt à lancer un serveur MCP en 2 minutes ?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Offre gratuite — sans carte bancaire. Un serveur, le catalogue MCP, logs en direct.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={"/sign-up?plan=free" as Route}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
              >
                Démarrer gratuitement →
              </Link>
              <Link
                href={"/plans" as Route}
                className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>

          <div className="mt-12">
            <div className="mb-6 flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">Serveurs MCP associés</h2>
              <Link
                href={"/servers" as Route}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Voir tous les serveurs →
              </Link>
            </div>
            {relatedServers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedServers.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/servers/${s.slug}` as Route}
                    className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
                  >
                    <h3 className="text-base font-semibold leading-snug group-hover:underline">
                      {s.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.tagline}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Explorez le{" "}
                <Link href={"/servers" as Route} className="text-foreground underline">
                  catalogue de serveurs MCP
                </Link>{" "}
                — installez-en un sur un runtime hébergé en un clic.
              </p>
            )}
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Continuer la lecture</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/fr/blog/${r.slug}` as Route}
                    className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {r.readingTimeMinutes} min de lecture
                    </p>
                    <h3 className="mt-2 text-base font-semibold leading-snug group-hover:underline">
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
