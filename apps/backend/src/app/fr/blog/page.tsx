import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

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
    slug: "smithery-alternatives",
    title: "Les meilleures alternatives à Smithery pour héberger un serveur MCP (2026)",
    description:
      "Vous cherchez une alternative à Smithery ? Comparez les runtimes MCP gérés, les registres publics, l'auto-hébergement et le serverless — avec un tableau de décision : code privé, isolation, secrets, clés API.",
    publishedAt: "2026-10-01",
    readingTimeMinutes: 10,
    tags: ["mcp", "smithery", "alternatives", "hébergement", "comparaison"],
  },
  {
    slug: "managed-vs-self-hosted-mcp",
    title: "Serveur MCP géré vs auto-hébergé : les vrais compromis (2026)",
    description:
      "Vos serveurs MCP doivent-ils tourner sur une plateforme gérée ou sur votre propre infrastructure ? Comparaison lucide du coût, de l'exploitation, de l'isolation, de la sécurité et du passage à l'échelle — et le point de bascule où chacun l'emporte.",
    publishedAt: "2026-10-01",
    readingTimeMinutes: 10,
    tags: ["mcp", "hébergement", "auto-hébergé", "géré", "comparaison"],
  },
  {
    slug: "what-is-mcp",
    title: "Qu'est-ce que Model Context Protocol ? Le guide complet 2026",
    description:
      "MCP expliqué depuis zéro — ce que c'est, pourquoi Anthropic l'a construit, comment clients et serveurs communiquent, et ce que vous pouvez en faire aujourd'hui.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 14,
    tags: ["mcp", "anthropic", "agents-ia", "fondamentaux"],
  },
  {
    slug: "mcp-server-hosting",
    title: "Hébergement de serveurs MCP en 2026 : auto-hébergé vs géré, comparaison",
    description:
      "Où devraient réellement tourner vos serveurs Model Context Protocol ? Comparaison entre stdio local, Docker sur VPS, Cloudflare Workers, Smithery, et runtimes gérés comme TwinMCP.",
    publishedAt: "2026-05-10",
    readingTimeMinutes: 16,
    tags: ["mcp", "hébergement", "déploiement", "comparaison"],
  },
  {
    slug: "build-mcp-server",
    title: "Comment construire un serveur Model Context Protocol (étape par étape)",
    description:
      "Construisez un serveur MCP fonctionnel depuis zéro en TypeScript : outils, ressources, prompts, transport, déploiement, et connexion à Cursor et Claude Code. Code complet, aucun raccourci.",
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

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 md:py-20">
        <nav aria-label="Fil d'Ariane" className="mb-10 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="font-medium text-foreground">
              Blog
            </li>
          </ol>
        </nav>

        <header className="mb-10 max-w-2xl">
          <p className="eyebrow">Notes de terrain</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            Blog
          </h1>
          <p className="mt-4 text-lg text-muted-foreground md:text-xl">
            Plongées techniques, tutoriels, et retours d&apos;expérience sur Model Context Protocol,
            les agents de codage IA, et les runtimes qui les font tourner.
          </p>
        </header>

        {/* Une carte par article : la date, puis le titre, le résumé et les tags. */}
        <ul className="grid gap-4 md:gap-6">
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
                    className="block rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-input hover:shadow-md sm:p-6"
                  >
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:text-sm">
                      <time dateTime={post.publishedAt}>{date}</time>
                      <span aria-hidden>·</span>
                      <span>
                        <span className="tabular-nums">{post.readingTimeMinutes}</span> min de
                        lecture
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
