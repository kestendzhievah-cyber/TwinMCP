"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CodeSnippet } from "@/components/marketing/code-snippet";
import { Check, ExternalLink } from "lucide-react";
import {
  API_KEY_PLACEHOLDER,
  IDE_LABELS,
  buildClientConfig,
  proxyUrl,
  type IdeKey,
} from "@/lib/mcp/client-config";
import { parseSchema, type CatalogEntry, type ServerOption } from "./install-dialog";

const IDE_KEYS = Object.keys(IDE_LABELS) as IdeKey[];

function categoryLabel(cat: string | null): string {
  if (!cat) return "Other";
  if (cat === "ai") return "AI";
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

export function DetailDialog({
  mcp,
  userServers,
  installed,
  onClose,
  onInstall,
}: {
  mcp: CatalogEntry | null;
  userServers: ServerOption[];
  installed: { serverId: string; serverName: string }[];
  onClose: () => void;
  onInstall: (mcp: CatalogEntry) => void;
}) {
  const [ide, setIde] = useState<IdeKey>("cursor");
  const [origin, setOrigin] = useState("https://twinmcp.fr");

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const fields = useMemo(
    () => (mcp ? Object.entries(parseSchema(mcp.configSchema).properties) : []),
    [mcp]
  );

  // A representative snippet with placeholders — the real URL/key are minted on
  // the server page after install. This just "reduces doubt before installing".
  const preview = useMemo(() => {
    if (!mcp) return null;
    const url = proxyUrl(origin, "your-server", mcp.slug);
    return buildClientConfig(ide, { url, apiKey: API_KEY_PLACEHOLDER, label: mcp.slug });
  }, [mcp, ide, origin]);

  if (!mcp) return null;

  const local = mcp.hostMode === "local";
  const isInstalled = installed.length > 0;

  return (
    <Dialog open={!!mcp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{mcp.name}</DialogTitle>
          <div className="flex flex-wrap gap-1 pt-1">
            {mcp.isOfficial && (
              <Badge variant="outline" className="text-xs">
                official
              </Badge>
            )}
            {local && (
              <Badge
                variant="outline"
                className="border-sky-500/40 text-xs text-sky-700 dark:text-sky-400"
              >
                local
              </Badge>
            )}
            {mcp.category && (
              <Badge variant="secondary" className="text-xs">
                {categoryLabel(mcp.category)}
              </Badge>
            )}
            <Badge variant="secondary" className="font-mono text-xs">
              {mcp.runtime}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              v{mcp.version}
            </Badge>
          </div>
          <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground/80">
            {mcp.description || "No description provided."}
          </DialogDescription>
        </DialogHeader>

        {isInstalled && (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
            <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
              <Check aria-hidden className="h-3.5 w-3.5" />
              Installed on {installed.length} server{installed.length === 1 ? "" : "s"}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {installed.map((s) => (
                <Button
                  key={s.serverId}
                  asChild
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <Link href={`/dashboard/servers/${s.serverId}` as Route}>{s.serverName}</Link>
                </Button>
              ))}
            </div>
          </div>
        )}

        {local && (
          <p className="rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-700 dark:text-sky-400">
            Runs on your machine via <code className="font-mono">ctx7 connect</code> — install it on
            a <strong>Local (agent)</strong> server.
          </p>
        )}

        {/* Configuration */}
        <section className="space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Configuration
          </h4>
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No configuration needed — install and connect.
            </p>
          ) : (
            <ul className="space-y-2">
              {fields.map(([key, def]) => (
                <li key={key} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm">{key}</code>
                    <Badge variant="secondary" className="text-[10px]">
                      {def.type}
                    </Badge>
                    {def.required && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-[10px] text-destructive"
                      >
                        required
                      </Badge>
                    )}
                    {def.secret && (
                      <Badge variant="outline" className="text-[10px]">
                        secret
                      </Badge>
                    )}
                  </div>
                  {def.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{def.description}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Repo link */}
        {mcp.repoUrl && (
          <a
            href={mcp.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            Source / documentation
          </a>
        )}

        {/* Connection preview */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Connection snippet
            </h4>
            <Select value={ide} onValueChange={(v) => setIde(v as IdeKey)}>
              <SelectTrigger className="h-8 w-44 text-xs" aria-label="Preview client">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {IDE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {preview && (
            <CodeSnippet
              code={preview.code}
              language={preview.language}
              filename={preview.filename}
            />
          )}
          <p className="text-xs text-muted-foreground">
            Preview with placeholders. After installing, your real URL and a{" "}
            <code className="font-mono">ctx7sk_</code> key appear on the server page.
          </p>
        </section>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {userServers.length === 0 ? (
            <Button asChild>
              <Link href={"/dashboard/servers" as Route}>Create a server first</Link>
            </Button>
          ) : (
            <Button onClick={() => onInstall(mcp)}>
              {isInstalled ? "Install again" : "Install"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
