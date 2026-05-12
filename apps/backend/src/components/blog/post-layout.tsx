import Link from "next/link";
import type { Route } from "next";
// next typed-routes doesn't pick up newly added /blog index immediately;
// cast static hrefs to Route to satisfy strict link checking.
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Prose } from "./prose";
import type { BlogPost } from "@/lib/blog/posts";
import { getRelatedPosts } from "@/lib/blog/posts";

interface PostLayoutProps {
  post: BlogPost;
  children: React.ReactNode;
  extraSchemas?: object[];
}

export function PostLayout({ post, children, extraSchemas = [] }: PostLayoutProps) {
  const related = getRelatedPosts(post.slug, 2);
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

      <article className="mx-auto max-w-3xl px-6 py-16">
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
            <li aria-current="page" className="line-clamp-1 text-foreground">
              {post.title}
            </li>
          </ol>
        </nav>

        <header className="mb-10">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={post.publishedAt}>{publishedDate}</time>
            <span aria-hidden>·</span>
            <span>{post.readingTimeMinutes} min read</span>
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
              Ready to run an MCP server in 2 minutes?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Free tier — no credit card. One server, the marketplace, live logs.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={"/sign-up?plan=free" as Route}
                className="inline-flex items-center justify-center rounded-md bg-foreground px-6 py-3 text-sm font-medium text-background hover:bg-foreground/90"
              >
                Start free →
              </Link>
              <Link
                href="/plans"
                className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-sm font-medium hover:bg-accent"
              >
                See pricing
              </Link>
            </div>
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Keep reading</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/blog/${r.slug}` as Route}
                    className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/40"
                  >
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      {r.readingTimeMinutes} min read
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
