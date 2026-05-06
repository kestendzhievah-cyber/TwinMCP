"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InstallDialog, type CatalogEntry, type ServerOption } from "./install-dialog";

export function McpCatalogGrid({
  catalog,
  userServers,
}: {
  catalog: CatalogEntry[];
  userServers: ServerOption[];
}) {
  const [picking, setPicking] = useState<CatalogEntry | null>(null);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {catalog.map((mcp) => (
          <Card key={mcp.id} className="flex flex-col">
            <CardHeader className="flex-1">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{mcp.name}</CardTitle>
                {mcp.isOfficial && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    official
                  </Badge>
                )}
              </div>
              <div className="flex gap-1 mt-1">
                <Badge variant="secondary" className="text-xs font-mono">
                  {mcp.runtime}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  v{mcp.version}
                </Badge>
              </div>
              <CardDescription className="mt-2 line-clamp-3">{mcp.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                size="sm"
                className="w-full"
                onClick={() => setPicking(mcp)}
                disabled={userServers.length === 0}
              >
                {userServers.length === 0 ? "Create a server first" : "Install"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <InstallDialog
        mcp={picking}
        userServers={userServers}
        onClose={() => setPicking(null)}
      />
    </>
  );
}
