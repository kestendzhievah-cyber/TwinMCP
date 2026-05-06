import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "./section";

export const revalidate = 3600;

type CatalogPreviewItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  runtime: string;
  version: string;
};

async function fetchOfficialPreview(): Promise<CatalogPreviewItem[]> {
  try {
    const db = getDb();
    return await db
      .select({
        id: mcpServers.id,
        slug: mcpServers.slug,
        name: mcpServers.name,
        description: mcpServers.description,
        runtime: mcpServers.runtime,
        version: mcpServers.version,
      })
      .from(mcpServers)
      .where(and(eq(mcpServers.isOfficial, true), eq(mcpServers.isPublic, true)))
      .orderBy(desc(mcpServers.createdAt))
      .limit(5);
  } catch {
    return [];
  }
}

export async function MarketplacePreview() {
  const items = await fetchOfficialPreview();

  // Graceful fallback: skip the section entirely if the catalog is unreachable or empty.
  // Pre-launch we still want a section, so render canned items as a teaser.
  const display: CatalogPreviewItem[] =
    items.length > 0
      ? items
      : [
          {
            id: "preview-fs",
            slug: "filesystem",
            name: "Filesystem",
            description: "Read, search, and edit files in a sandboxed root directory.",
            runtime: "node",
            version: "0.6.0",
          },
          {
            id: "preview-gh",
            slug: "github",
            name: "GitHub",
            description: "Issues, PRs, code search across repos you authorize.",
            runtime: "node",
            version: "0.5.1",
          },
          {
            id: "preview-fetch",
            slug: "fetch",
            name: "Fetch",
            description: "HTTP requests with HTML→Markdown conversion for any URL.",
            runtime: "python",
            version: "0.4.0",
          },
          {
            id: "preview-pg",
            slug: "postgres",
            name: "Postgres",
            description: "Read-only SQL against your database — schema introspection included.",
            runtime: "node",
            version: "0.3.2",
          },
          {
            id: "preview-twin",
            slug: "twinmcp-docs",
            name: "TwinMCP Docs",
            description: "Curated documentation context for popular libraries and frameworks.",
            runtime: "node",
            version: "1.0.0",
          },
        ];

  return (
    <Section
      id="marketplace"
      eyebrow="Marketplace"
      title="Curated MCPs you can install in one click"
      description="Five official MCPs ship with every account. Pro users can publish their own to the public catalog."
    >
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {display.map((mcp) => (
          <li
            key={mcp.id}
            className="group flex flex-col rounded-xl border border-border/80 bg-card p-5 transition-colors hover:border-foreground/20"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-secondary text-foreground/80">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 className="font-semibold tracking-tight">{mcp.name}</h3>
              </div>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                official
              </Badge>
            </div>
            <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
              {mcp.description}
            </p>
            <div className="mt-4 flex items-center gap-2 pt-2">
              <Badge variant="secondary" className="font-mono text-[10px]">
                {mcp.runtime}
              </Badge>
              <Badge variant="secondary" className="font-mono text-[10px]">
                v{mcp.version}
              </Badge>
              <code className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
                {mcp.slug}
              </code>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link href="/sign-up">
            Browse the full marketplace
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Section>
  );
}
