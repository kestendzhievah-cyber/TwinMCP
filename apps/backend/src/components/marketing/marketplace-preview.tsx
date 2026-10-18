import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      {/* The catalogue is a ledger: one line per package, slug and version in typewriter. */}
      <div className="border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">Package</TableHead>
              <TableHead className="hidden md:table-cell">Slug</TableHead>
              <TableHead className="hidden sm:table-cell">Runtime</TableHead>
              <TableHead className="pr-5 text-right">Version</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {display.map((mcp) => (
              <TableRow key={mcp.id}>
                <TableCell className="py-4 pl-5 align-top">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
                      <Package className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h3 className="smallcaps tracking-sc text-base font-medium leading-5">
                          {mcp.name}
                        </h3>
                        <Badge variant="outline">official</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 max-w-md text-sm text-muted-foreground">
                        {mcp.description}
                      </p>
                      <code className="mt-1 block font-mono text-xs text-muted-foreground md:hidden">
                        {mcp.slug}
                      </code>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden py-4 align-top md:table-cell">
                  <code className="font-mono text-xs text-muted-foreground">{mcp.slug}</code>
                </TableCell>
                <TableCell className="hidden py-4 align-top font-mono text-xs text-muted-foreground sm:table-cell">
                  {mcp.runtime}
                </TableCell>
                <TableCell className="py-4 pr-5 text-right align-top font-mono text-xs">
                  v{mcp.version}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

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
