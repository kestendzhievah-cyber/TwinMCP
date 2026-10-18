import type { Metadata, Route } from "next";
import Link from "next/link";
import { getSortedPosts } from "@/lib/blog/posts";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, itemListSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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

// Section eyebrow sitting between two short hairlines (DESIGN.md §4.7).
const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";

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

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        {/* Top line of the card: breadcrumb left, the feed top-right. */}
        <div className="smallcaps tracking-sc mb-10 flex items-center justify-between gap-4 text-xs text-muted-foreground">
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>·</li>
              <li aria-current="page" className="text-foreground">
                Blog
              </li>
            </ol>
          </nav>
          <Link href={"/blog/feed.xml" as Route} className="hover:text-foreground">
            RSS feed
          </Link>
        </div>

        <header className="mb-12 text-center">
          <p className={EYEBROW_RULES}>Field notes</p>
          <h1 className="display letterpress mt-5 text-5xl sm:text-6xl">Blog</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Deep dives, tutorials, and field notes on Model Context Protocol, AI coding agents, and
            the runtimes that power them.
          </p>
          <Separator variant="double" className="mt-10" />
        </header>

        {/* The index is a ledger: one hairline between entries, the date in the
            left column like a register, the title and abstract on the right. */}
        <ul className="divide-y divide-border">
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
                    className="grid gap-3 py-8 sm:grid-cols-[9rem_1fr] sm:gap-8"
                  >
                    <div className="smallcaps tracking-sc text-xs text-muted-foreground">
                      <time dateTime={post.publishedAt} className="block">
                        {date}
                      </time>
                      <span className="mt-1 block">
                        <span className="lining">{post.readingTimeMinutes}</span> min read
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-medium leading-snug decoration-brand underline-offset-4 group-hover:underline">
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
