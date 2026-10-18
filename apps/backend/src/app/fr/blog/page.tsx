import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema } from "@/lib/seo/schema";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
      "Vous cherchez une alternative à Smithery ? Comparez les runtimes MCP gérés, les registres publics, l'auto-hébergement et le serverless — avec un tableau de décision : code privé, isolation, secrets, accès équipe.",
    publishedAt: "2026-10-01",
    readingTimeMinutes: 10,
    tags: ["mcp", "smithery", "alternatives", "hébergement", "comparaison"],
  },
  {
    slug: "managed-vs-self-hosted-mcp",
    title: "Serveur MCP géré vs auto-hébergé : les vrais compromis (2026)",
    description:
      "Vos serveurs MCP doivent-ils tourner sur une plateforme gérée ou sur votre propre infrastructure ? Comparaison lucide du coût, de l'exploitation, de l'isolation, de la sécurité et du passage à l'échelle — et le point de bascule où chacun l'emporte.",
    publishedAt: "2026-10-01",
    readingTimeMinutes: 10,
    tags: ["mcp", "hébergement", "auto-hébergé", "géré", "comparaison"],
  },
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

// Section eyebrow sitting between two short hairlines (DESIGN.md §4.7).
const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";

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

      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <nav
          aria-label="Fil d'Ariane"
          className="smallcaps tracking-sc mb-10 text-xs text-muted-foreground"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              Blog
            </li>
          </ol>
        </nav>

        <header className="mb-12 text-center">
          <p className={EYEBROW_RULES}>Notes de terrain</p>
          <h1 className="display letterpress mt-5 text-5xl sm:text-6xl">Blog</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Plongées techniques, tutoriels, et retours d&apos;expérience sur Model Context Protocol,
            les agents de codage IA, et les runtimes qui les font tourner.
          </p>
          <Separator variant="double" className="mt-10" />
        </header>

        {/* The index is a ledger: one hairline between entries, the date in the
            left column like a register, the title and abstract on the right. */}
        <ul className="divide-y divide-border">
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
                    className="grid gap-3 py-8 sm:grid-cols-[9rem_1fr] sm:gap-8"
                  >
                    <div className="smallcaps tracking-sc text-xs text-muted-foreground">
                      <time dateTime={post.publishedAt} className="block">
                        {date}
                      </time>
                      <span className="mt-1 block">
                        <span className="lining">{post.readingTimeMinutes}</span> min de lecture
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
