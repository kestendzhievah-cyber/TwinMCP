"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { InstallDialog, type CatalogEntry, type ServerOption } from "./install-dialog";
import { DetailDialog } from "./detail-dialog";

type Source = "all" | "official" | "community";
type Runs = "all" | "box" | "local";
type Sort = "featured" | "name" | "newest";

/** Where each catalog MCP is installed for this user (mcpServerId → servers). */
export type InstalledMap = Record<string, { serverId: string; serverName: string }[]>;

const ALL = "all";
const PAGE_SIZE = 24;

/** Human label for a category slug (null → "Other"). */
function categoryLabel(cat: string | null): string {
  if (!cat) return "Other";
  if (cat === "ai") return "AI";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// A category chip is a square hairline tab set in small capitals; the chosen
// one is inked like a stamp. Counts sit in lining figures (DESIGN.md §2, §3).
function CategoryChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "smallcaps tracking-sc inline-flex min-h-10 items-center gap-2 border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-px",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/60 hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn("lining text-xs", active ? "text-background/75" : "text-muted-foreground")}
      >
        {count}
      </span>
    </button>
  );
}

export function McpCatalogGrid({
  catalog,
  userServers,
  installed,
}: {
  catalog: CatalogEntry[];
  userServers: ServerOption[];
  installed: InstalledMap;
}) {
  const [picking, setPicking] = useState<CatalogEntry | null>(null);
  const [detail, setDetail] = useState<CatalogEntry | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [runs, setRuns] = useState<Runs>("all");
  const [runtime, setRuntime] = useState<string>(ALL);
  const [category, setCategory] = useState<string>(ALL);
  const [sort, setSort] = useState<Sort>("featured");
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Debounce the search box so filtering doesn't run on every keystroke (matters
  // as the catalog grows).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  // Distinct runtimes / categories present in the catalog, for the filters.
  const runtimes = useMemo(
    () => Array.from(new Set(catalog.map((m) => m.runtime))).sort(),
    [catalog]
  );
  // Categories present in the catalog + how many MCPs each holds, for the
  // browse-by-category chip row.
  const { categories, categoryCounts } = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of catalog) {
      const cat = m.category ?? "other";
      counts[cat] = (counts[cat] ?? 0) + 1;
    }
    const list = Object.keys(counts).sort((a, b) => {
      if (a === "other") return 1; // keep "Other" last
      if (b === "other") return -1;
      return a.localeCompare(b);
    });
    return { categories: list, categoryCounts: counts };
  }, [catalog]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const rows = catalog.filter((mcp) => {
      if (source === "official" && !mcp.isOfficial) return false;
      if (source === "community" && mcp.isOfficial) return false;
      const local = mcp.hostMode === "local";
      if (runs === "local" && !local) return false;
      if (runs === "box" && local) return false;
      if (runtime !== ALL && mcp.runtime !== runtime) return false;
      if (category !== ALL) {
        const cat = mcp.category ?? "other";
        if (cat !== category) return false;
      }
      if (q && !`${mcp.name} ${mcp.description} ${mcp.slug}`.toLowerCase().includes(q))
        return false;
      return true;
    });

    if (sort === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "newest") {
      rows.sort((a, b) => b.createdAt - a.createdAt);
    } else {
      // Featured: official first, then newest — mirrors the server ordering.
      rows.sort((a, b) => Number(b.isOfficial) - Number(a.isOfficial) || b.createdAt - a.createdAt);
    }
    return rows;
  }, [catalog, debouncedQuery, source, runs, runtime, category, sort]);

  // Reset pagination whenever the result set changes (new search/filter/sort).
  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [debouncedQuery, source, runs, runtime, category, sort]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search MCPs…"
            className="pl-9"
            aria-label="Search MCPs"
          />
        </div>
        <Select value={source} onValueChange={(v) => setSource(v as Source)}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="official">Official</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
        <Select value={runtime} onValueChange={setRuntime}>
          <SelectTrigger className="w-full sm:w-36" aria-label="Filter by runtime">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All runtimes</SelectItem>
            {runtimes.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={runs} onValueChange={(v) => setRuns(v as Runs)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by where it runs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Runs anywhere</SelectItem>
            <SelectItem value="box">Cloud box</SelectItem>
            <SelectItem value="local">Local (agent)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
          <SelectTrigger className="w-full sm:w-40" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="name">Name (A–Z)</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Browse by category: an index of square hairline chips. */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <CategoryChip
          label="All"
          count={catalog.length}
          active={category === ALL}
          onClick={() => setCategory(ALL)}
        />
        {categories.map((c) => (
          <CategoryChip
            key={c}
            label={categoryLabel(c === "other" ? null : c)}
            count={categoryCounts[c] ?? 0}
            active={category === c}
            onClick={() => setCategory(c)}
          />
        ))}
      </div>

      <p className="lining mt-4 text-xs italic text-muted-foreground" aria-live="polite">
        {filtered.length} of {catalog.length} MCP{catalog.length === 1 ? "" : "s"}
        {filtered.length > visible ? ` · showing ${visible}` : ""}
      </p>

      {filtered.length === 0 ? (
        // Empty slot (DESIGN.md §5): dashed ink hairline, bare icon, italic line.
        <div className="mt-4 flex flex-col items-center gap-3 border border-dashed border-foreground/40 px-4 py-12 text-center">
          <Search aria-hidden className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm italic text-muted-foreground">No MCPs match your filters.</p>
        </div>
      ) : (
        // Catalogue cards: bone stock, one hairline (ink on hover), the name in
        // small capitals, runtime and version in Courier, the action under a rule.
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, visible).map((mcp) => {
            const local = mcp.hostMode === "local";
            const on = installed[mcp.id] ?? [];
            const isInstalled = on.length > 0;
            return (
              <Card
                key={mcp.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetail(mcp)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetail(mcp);
                  }
                }}
                className="flex cursor-pointer flex-col transition-colors hover:border-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <CardHeader className="flex-1 space-y-0">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base leading-snug">{mcp.name}</CardTitle>
                    {/* Seals stay plain hairline here; the gilt "official" is
                        kept for the detail card (one seal per view, §4.8). */}
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {isInstalled && (
                        <Badge variant="success">
                          <Check aria-hidden className="h-3 w-3" />
                          installed
                        </Badge>
                      )}
                      {local && <Badge variant="info">local</Badge>}
                      {mcp.isOfficial && <Badge variant="outline">official</Badge>}
                    </div>
                  </div>
                  {/* Meta line: category in small caps, runtime and version in
                      Courier, set off by middle dots (DESIGN.md §3). */}
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                    {mcp.category && (
                      <>
                        <span className="smallcaps tracking-sc">{categoryLabel(mcp.category)}</span>
                        <span aria-hidden>·</span>
                      </>
                    )}
                    <span className="font-mono">{mcp.runtime}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono">v{mcp.version}</span>
                  </p>
                  <CardDescription className="mt-3 line-clamp-3 not-italic">
                    {mcp.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="border-t border-border px-6 py-4">
                  {/* Stop card-level clicks from firing when using the footer. */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {isInstalled ? (
                      <Button asChild variant="outline" className="lining w-full">
                        <Link href={`/dashboard/servers/${on[0].serverId}` as Route}>
                          {on.length > 1 ? `Installed · ${on.length} servers` : "Installed · View"}
                        </Link>
                      </Button>
                    ) : userServers.length === 0 ? (
                      <Button asChild variant="outline" className="w-full">
                        <Link href={"/dashboard/servers" as Route}>Create a server first</Link>
                      </Button>
                    ) : (
                      <Button className="w-full" onClick={() => setPicking(mcp)}>
                        Install
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length > visible && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            className="lining"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Load more ({filtered.length - visible} more)
          </Button>
        </div>
      )}

      <DetailDialog
        mcp={detail}
        userServers={userServers}
        installed={detail ? (installed[detail.id] ?? []) : []}
        onClose={() => setDetail(null)}
        onInstall={(mcp) => {
          setDetail(null);
          setPicking(mcp);
        }}
      />
      <InstallDialog mcp={picking} userServers={userServers} onClose={() => setPicking(null)} />
    </>
  );
}
