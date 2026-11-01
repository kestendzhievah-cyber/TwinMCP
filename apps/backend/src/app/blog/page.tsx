import type { Metadata, Route } from "next";
import Link from "next/link";
import { Rss } from "lucide-react";
import { getSortedPosts } from "@/lib/blog/posts";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Blog — TwinMCP",
  description:
    "Deep dives, tutorials, and field notes on Model Context Protocol, AI coding agents, and the runtimes that power them.",
  alternates: {
    canonical: "/blog",
    languages: { en: "/blog", fr: "/fr/blog", "x-default": "/blog" },
  },
  openGraph: {
    title: "TwinMCP Blog",
    description:
      "Deep dives, tutorials, and field notes on MCP, AI coding agents, and the runtimes that power them.",
    url: `${SITE_URL}/blog`,
  },
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "TwinMCP Blog",
  url: `${SITE_URL}/blog`,
  description:
    "Articles on Model Context Protocol, AI coding agents, and the runtimes that power them.",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export default function BlogIndexPage() {
  const posts = getSortedPosts();
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Home", url: "/" },
            { name: "Blog", url: "/blog" },
          ]),
          collectionSchema,
          itemListSchema(posts.map((p) => ({ name: p.title, url: `/blog/${p.slug}` }))),
        ]}
      />

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-20">
        {/* Top line: breadcrumb left, the feed top-right. */}
        <div className="mb-10 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="font-medium text-foreground">
                Blog
              </li>
            </ol>
          </nav>
          <Link
            href={"/blog/feed.xml" as Route}
            className="inline-flex items-center gap-1.5 font-medium text-brand underline-offset-4 hover:underline"
          >
            <Rss className="h-4 w-4" aria-hidden />
            RSS feed
          </Link>
        </div>

        <header className="mb-10 max-w-2xl">
          <p className="eyebrow">Field notes</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Blog
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Deep dives, tutorials, and field notes on Model Context Protocol, AI coding agents, and
            the runtimes that power them.
          </p>
        </header>

        {/* One card per post: the dateline, then the title, abstract and tags. */}
        <ul className="grid gap-4 md:gap-6">
          {posts.map((post) => {
            const date = new Date(post.publishedAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            return (
              <li key={post.slug}>
                <article className="group">
                  <Link
                    href={`/blog/${post.slug}` as Route}
                    className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md sm:p-6"
                  >
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:text-sm">
                      <time dateTime={post.publishedAt}>{date}</time>
                      <span aria-hidden>·</span>
                      <span>
                        <span className="tabular-nums">{post.readingTimeMinutes}</span> min read
                      </span>
                    </p>
                    <h2 className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight group-hover:text-brand sm:text-2xl">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-base leading-7 text-muted-foreground">
                      {post.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {post.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
