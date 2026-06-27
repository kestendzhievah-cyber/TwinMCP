import type { Metadata, Route } from "next";
import Link from "next/link";
import { getSortedPosts } from "@/lib/blog/posts";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Blog — TwinMCP",
  description:
    "Deep dives, tutorials, and field notes on Model Context Protocol, AI coding agents, and the runtimes that power them.",
  alternates: { canonical: "/blog" },
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
        ]}
      />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              Blog
            </li>
          </ol>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Blog</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Deep dives, tutorials, and field notes on Model Context Protocol, AI coding agents, and
            the runtimes that power them.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            <Link
              href={"/blog/feed.xml" as Route}
              className="underline underline-offset-4 hover:text-foreground"
            >
              RSS feed
            </Link>
          </p>
        </header>

        <ul className="space-y-8">
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
                    className="block rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/40"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <time dateTime={post.publishedAt}>{date}</time>
                      <span aria-hidden>·</span>
                      <span>{post.readingTimeMinutes} min read</span>
                      <span className="flex flex-wrap gap-1.5">
                        {post.tags.slice(0, 3).map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-secondary px-2 py-0.5 font-medium text-foreground"
                          >
                            #{t}
                          </span>
                        ))}
                      </span>
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight group-hover:underline">
                      {post.title}
                    </h2>
                    <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                      {post.description}
                    </p>
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
