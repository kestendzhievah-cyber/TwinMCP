import Link from "next/link";
import type { Route } from "next";
// next typed-routes doesn't pick up newly added /blog index immediately;
// cast static hrefs to Route to satisfy strict link checking.
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { Prose } from "./prose";
import { PostCta } from "./post-cta";
import type { BlogPost } from "@/lib/blog/posts";
import { getRelatedPosts } from "@/lib/blog/posts";
import { getRelatedServers } from "@/lib/servers/catalog";

interface PostLayoutProps {
  post: BlogPost;
  children: React.ReactNode;
  extraSchemas?: object[];
}

// Running head over a footer block, with its "see all" link on the same line.
const RUNNING_HEAD = "mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1";

// Related items are interactive cards (docs/DESIGN.md, Card recipes).
const RELATED_CARD =
  "group block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md";

export function PostLayout({ post, children, extraSchemas = [] }: PostLayoutProps) {
  const related = getRelatedPosts(post.slug, 2);
  const relatedServers = getRelatedServers(post.slug, 4);
  const publishedDate = new Date(post.publishedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
            { name: post.title, url: `/blog/${post.slug}` },
          ]),
          articleSchema({
            headline: post.title,
            description: post.description,
            url: `/blog/${post.slug}`,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt,
          }),
          ...extraSchemas,
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-20">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={"/blog" as Route} className="hover:text-foreground">
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
              <span className="tabular-nums">{post.readingTimeMinutes}</span> min read
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
          <PostCta />

          <div className="mt-14">
            <div className={RUNNING_HEAD}>
              <h2 className="font-display text-2xl font-bold tracking-tight">
                Related MCP servers
              </h2>
              <Link
                href={"/servers" as Route}
                className="shrink-0 text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Browse all servers →
              </Link>
            </div>
            {relatedServers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedServers.map((s) => (
                  <Link key={s.slug} href={`/servers/${s.slug}` as Route} className={RELATED_CARD}>
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
                Explore the full{" "}
                <Link
                  href={"/servers" as Route}
                  className="font-medium text-brand underline-offset-4 hover:underline"
                >
                  MCP server catalog
                </Link>{" "}
                — install any of them on a hosted runtime in one click.
              </p>
            )}
          </div>

          {related.length > 0 && (
            <div className="mt-14">
              <div className={RUNNING_HEAD}>
                <h2 className="font-display text-2xl font-bold tracking-tight">Keep reading</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link key={r.slug} href={`/blog/${r.slug}` as Route} className={RELATED_CARD}>
                    <p className="text-xs text-muted-foreground">
                      <span className="tabular-nums">{r.readingTimeMinutes}</span> min read
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
