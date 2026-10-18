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
import { useMcpConfigSchema } from "./use-config-schema";

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
  // Config schema loaded on demand + cached across opens.
  const { schema: rawSchema, loading: schemaLoading } = useMcpConfigSchema(mcp?.id ?? null);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const fields = useMemo(() => Object.entries(parseSchema(rawSchema).properties), [rawSchema]);

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
          <DialogTitle>{mcp.name}</DialogTitle>
          {/* Seal and meta line: an official MCP gets the one gilt seal of the
              view (§4.8); category in small caps, runtime and version in Courier. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1">
            {mcp.isOfficial && <Badge variant="gilt">official</Badge>}
            {local && <Badge variant="info">local</Badge>}
            <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
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
          </div>
          <DialogDescription className="pt-2 not-italic leading-relaxed text-foreground/80">
            {mcp.description || "No description provided."}
          </DialogDescription>
        </DialogHeader>

        {isInstalled && (
          // Success memo: green tint, ink-green left rule, the servers as links.
          <div className="border border-success/40 border-l-2 border-l-success bg-success/10 px-3 pt-2.5 text-sm">
            <p className="flex items-center gap-2 font-medium text-success">
              <Check aria-hidden className="h-4 w-4" />
              <span>
                Installed on <span className="lining">{installed.length}</span> server
                {installed.length === 1 ? "" : "s"}
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-x-4">
              {installed.map((s) => (
                <Link
                  key={s.serverId}
                  href={`/dashboard/servers/${s.serverId}` as Route}
                  className="inline-flex min-h-10 items-center text-foreground underline decoration-success/40 underline-offset-4 transition-colors hover:decoration-success"
                >
                  {s.serverName}
                </Link>
              ))}
            </div>
          </div>
        )}

        {local && (
          <p className="border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
            Runs on your machine via <code className="font-mono">ctx7 connect</code> — install it on
            a <strong className="font-medium">Local (agent)</strong> server.
          </p>
        )}

        {/* Configuration: a ledger of the fields the installer will ask for —
            mono keys and types, required/secret as small seals. */}
        <section className="space-y-3">
          <h4 className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
            Configuration
          </h4>
          {schemaLoading ? (
            <p className="text-sm italic text-muted-foreground">Loading…</p>
          ) : fields.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              No configuration needed — install and connect.
            </p>
          ) : (
            <ul className="divide-y divide-border border border-border">
              {fields.map(([key, def]) => (
                <li key={key} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm">{key}</code>
                    <span className="font-mono text-xs text-muted-foreground">{def.type}</span>
                    {def.required && <Badge variant="destructive">required</Badge>}
                    {def.secret && <Badge variant="outline">secret</Badge>}
                  </div>
                  {def.description && (
                    <p className="mt-1 text-xs italic text-muted-foreground">{def.description}</p>
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
            className="inline-flex min-h-10 w-fit items-center gap-2 text-sm text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
            Source / documentation
          </a>
        )}

        {/* Connection preview */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
              Connection snippet
            </h4>
            <Select value={ide} onValueChange={(v) => setIde(v as IdeKey)}>
              <SelectTrigger className="w-44" aria-label="Preview client">
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
          <p className="text-xs italic text-muted-foreground">
            Preview with placeholders. After installing, your real URL and a{" "}
            <code className="font-mono not-italic">ctx7sk_</code> key appear on the server page.
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
