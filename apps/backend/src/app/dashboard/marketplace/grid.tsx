"use client";

import { useMemo, useState } from "react";
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
import { Search } from "lucide-react";
import { InstallDialog, type CatalogEntry, type ServerOption } from "./install-dialog";

type Source = "all" | "official" | "community";
type Runs = "all" | "box" | "local";

export function McpCatalogGrid({
  catalog,
  userServers,
}: {
  catalog: CatalogEntry[];
  userServers: ServerOption[];
}) {
  const [picking, setPicking] = useState<CatalogEntry | null>(null);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Source>("all");
  const [runs, setRuns] = useState<Runs>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((mcp) => {
      if (source === "official" && !mcp.isOfficial) return false;
      if (source === "community" && mcp.isOfficial) return false;
      const local = mcp.hostMode === "local";
      if (runs === "local" && !local) return false;
      if (runs === "box" && local) return false;
      if (q && !`${mcp.name} ${mcp.description} ${mcp.slug}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [catalog, query, source, runs]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
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
          <SelectTrigger className="w-full sm:w-40" aria-label="Filter by source">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="official">Official</SelectItem>
            <SelectItem value="community">Community</SelectItem>
          </SelectContent>
        </Select>
        <Select value={runs} onValueChange={(v) => setRuns(v as Runs)}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by where it runs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Runs anywhere</SelectItem>
            <SelectItem value="box">Cloud box</SelectItem>
            <SelectItem value="local">Local (agent)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {filtered.length} of {catalog.length} MCP{catalog.length === 1 ? "" : "s"}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-2 rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
          No MCPs match your search.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((mcp) => {
            const local = mcp.hostMode === "local";
            return (
              <Card key={mcp.id} className="flex flex-col">
                <CardHeader className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{mcp.name}</CardTitle>
                    <div className="flex shrink-0 gap-1">
                      {local && (
                        <Badge
                          variant="outline"
                          className="border-sky-500/40 text-xs text-sky-700 dark:text-sky-400"
                        >
                          local
                        </Badge>
                      )}
                      {mcp.isOfficial && (
                        <Badge variant="outline" className="text-xs">
                          official
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {mcp.runtime}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      v{mcp.version}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 line-clamp-3">{mcp.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {userServers.length === 0 ? (
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <Link href={"/dashboard/servers" as Route}>Create a server first</Link>
                    </Button>
                  ) : (
                    <Button size="sm" className="w-full" onClick={() => setPicking(mcp)}>
                      Install
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <InstallDialog mcp={picking} userServers={userServers} onClose={() => setPicking(null)} />
    </>
  );
}
