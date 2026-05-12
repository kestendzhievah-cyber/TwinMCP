import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: "Blog — TwinMCP (Français)",
  description:
    "Plongées techniques, tutoriels, et retours d'expérience sur Model Context Protocol, les agents de codage IA, et les runtimes qui les font tourner.",
  alternates: {
    canonical: "/fr/blog",
    languages: { en: "/blog", fr: "/fr/blog", "x-default": "/blog" },
  },
  openGraph: {
    title: "Blog TwinMCP (FR)",
    description:
      "Plongées techniques, tutoriels, et retours d'expérience sur MCP et les agents de codage IA.",
    url: `${SITE_URL}/fr/blog`,
    locale: "fr_FR",
  },
};

const FR_POSTS = [
  {
    slug: "what-is-mcp",
    title: "Qu'est-ce que Model Context Protocol ? Le guide complet 2026",
    description:
      "MCP expliqué depuis zéro — ce que c'est, pourquoi Anthropic l'a construit, comment clients et serveurs communiquent, et ce que vous pouvez en faire aujourd'hui.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 14,
    tags: ["mcp", "anthropic", "agents-ia", "fondamentaux"],
  },
  {
    slug: "mcp-server-hosting",
    title: "Hébergement de serveurs MCP en 2026 : auto-hébergé vs géré, comparaison",
    description:
      "Où devraient réellement tourner vos serveurs Model Context Protocol ? Comparaison entre stdio local, Docker sur VPS, Cloudflare Workers, Smithery, et runtimes gérés comme TwinMCP.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 16,
    tags: ["mcp", "hébergement", "déploiement", "comparaison"],
  },
  {
    slug: "build-mcp-server",
    title: "Comment construire un serveur Model Context Protocol (étape par étape)",
    description:
      "Construisez un serveur MCP fonctionnel depuis zéro en TypeScript : outils, ressources, prompts, transport, déploiement, et connexion à Cursor et Claude Code. Code complet, aucun raccourci.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 18,
    tags: ["mcp", "tutoriel", "typescript", "sdk"],
  },
];

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Blog TwinMCP (Français)",
  url: `${SITE_URL}/fr/blog`,
  description:
    "Articles sur Model Context Protocol, les agents de codage IA, et les runtimes qui les font tourner.",
  inLanguage: "fr",
  publisher: { "@id": `${SITE_URL}/#organization` },
};

export default function FrBlogIndexPage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Blog", url: "/fr/blog" },
          ]),
          collectionSchema,
        ]}
      />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
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
            Plongées techniques, tutoriels, et retours d&apos;expérience sur Model Context Protocol,
            les agents de codage IA, et les runtimes qui les font tourner.
          </p>
        </header>

        <ul className="space-y-8">
          {FR_POSTS.map((post) => {
            const date = new Date(post.publishedAt).toLocaleDateString("fr-FR", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });
            return (
              <li key={post.slug}>
                <article className="group">
                  <Link
                    href={`/fr/blog/${post.slug}` as Route}
                    className="block rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/40"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <time dateTime={post.publishedAt}>{date}</time>
                      <span aria-hidden>·</span>
                      <span>{post.readingTimeMinutes} min de lecture</span>
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
