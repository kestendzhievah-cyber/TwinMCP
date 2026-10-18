import Link from "next/link";
import type { Route } from "next";
// next typed-routes doesn't pick up newly added /blog index immediately;
// cast static hrefs to Route to satisfy strict link checking.
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Prose } from "./prose";
import type { BlogPost } from "@/lib/blog/posts";
import { getRelatedPosts } from "@/lib/blog/posts";
import { getRelatedServers } from "@/lib/servers/catalog";

interface PostLayoutProps {
  post: BlogPost;
  children: React.ReactNode;
  extraSchemas?: object[];
}

// Small-caps running head over a footer block, with its "see all" link on the
// same hairline.
const RUNNING_HEAD = "mb-6 flex items-baseline justify-between gap-4 border-b border-border pb-3";

// Related items are feature cards: hairline, bone stock, ink hairline on hover
// (DESIGN.md §5).
const RELATED_CARD =
  "group border border-border bg-card p-5 transition-colors hover:border-foreground/60";

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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <nav
          aria-label="Breadcrumb"
          className="smallcaps tracking-sc mb-10 text-xs text-muted-foreground"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li>
              <Link href={"/blog" as Route} className="hover:text-foreground">
                Blog
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="line-clamp-1 min-w-0 text-foreground">
              {post.title}
            </li>
          </ol>
        </nav>

        {/* The centred name: a small-caps dateline, the title engraved in the
            middle, a short hairline, the standfirst, then the double rule. */}
        <header className="mb-12 text-center">
          <p className="smallcaps tracking-sc flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <time dateTime={post.publishedAt}>{publishedDate}</time>
            <span aria-hidden>·</span>
            <span>
              <span className="lining">{post.readingTimeMinutes}</span> min read
            </span>
          </p>
          <h1 className="letterpress mt-5 text-balance text-4xl font-medium sm:text-5xl">
            {post.title}
          </h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {post.description}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-1.5">
            {post.tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
          <Separator variant="double" className="mt-10" />
        </header>

        <Prose>{children}</Prose>

        <footer className="mt-16">
          <Separator variant="double" />

          <div className="mt-10 border border-foreground/60 bg-card p-8 text-center sm:p-10">
            <h2 className="text-2xl font-medium sm:text-3xl">
              Ready to run an MCP server in 2 minutes?
            </h2>
            <p className="mt-3 text-base italic text-muted-foreground">
              Free tier — no credit card. One server, the marketplace, live logs.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={"/sign-up?plan=free" as Route}>Start free →</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/plans">See pricing</Link>
              </Button>
            </div>
          </div>

          <div className="mt-14">
            <div className={RUNNING_HEAD}>
              <h2 className="text-2xl font-medium">Related MCP servers</h2>
              <Link
                href={"/servers" as Route}
                className="smallcaps tracking-sc shrink-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Browse all servers →
              </Link>
            </div>
            {relatedServers.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedServers.map((s) => (
                  <Link key={s.slug} href={`/servers/${s.slug}` as Route} className={RELATED_CARD}>
                    <h3 className="smallcaps tracking-sc text-lg font-medium leading-snug">
                      {s.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.tagline}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                Explore the full{" "}
                <Link
                  href={"/servers" as Route}
                  className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
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
                <h2 className="text-2xl font-medium">Keep reading</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link key={r.slug} href={`/blog/${r.slug}` as Route} className={RELATED_CARD}>
                    <p className="smallcaps tracking-sc text-xs text-muted-foreground">
                      <span className="lining">{r.readingTimeMinutes}</span> min read
                    </p>
                    <h3 className="mt-2 text-lg font-medium leading-snug">{r.title}</h3>
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
