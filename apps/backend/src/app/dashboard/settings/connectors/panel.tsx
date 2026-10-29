"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Plug } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";

/** GET /api/v2/oauth/connections row (lib/oauth.ts OAuthConnection). */
interface Connection {
  id: string;
  clientName: string;
  clientUri: string | null;
  serverId: string | null;
  serverName: string | null;
  serverSlug: string | null;
  authorizedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

interface ServerOption {
  id: string;
  name: string;
  slug: string;
}

/** The aggregated per-server MCP endpoint (contract D3): one URL for every MCP on it. */
function serverUrl(origin: string, slug: string): string {
  return `${origin}/api/mcp/${encodeURIComponent(slug)}`;
}

export function ConnectorsPanel({
  initialConnections,
  servers,
  origin,
  enabled,
}: {
  initialConnections: Connection[];
  servers: ServerOption[];
  origin: string;
  enabled: boolean;
}) {
  const [connections, setConnections] = useState(initialConnections);
  const [pending, setPending] = useState<Connection | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [slug, setSlug] = useState(servers[0]?.slug ?? "");
  const [copied, setCopied] = useState(false);

  const url = slug ? serverUrl(origin, slug) : `${origin}/api/mcp/<server-slug>`;

  async function revoke(c: Connection) {
    setRevoking(true);
    try {
      const res = await fetch(`/api/v2/oauth/connections/${encodeURIComponent(c.id)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setConnections((list) => list.filter((x) => x.id !== c.id));
      toast.success(`${c.clientName} can no longer reach your servers`);
      setPending(null);
    } catch {
      toast.error("Could not revoke the connector. Try again.");
    }
    setRevoking(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Connectors</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Apps you signed in to TwinMCP with OAuth. They can call the tools of your MCPs, never
          manage your account.{" "}
          <Link
            href={"/dashboard/settings" as Route}
            className="not-italic text-brand underline underline-offset-4"
          >
            Back to settings
          </Link>
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      {!enabled && (
        <p className="border border-info/40 bg-info/10 px-3 py-2 text-sm text-info">
          OAuth sign-in for connectors is currently turned off. Existing connectors stop working
          until it is turned back on; API keys are unaffected.
        </p>
      )}

      {connections.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No connector authorized"
          description="When an app such as Claude or ChatGPT connects to a TwinMCP server, it appears here."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Authorized apps</CardTitle>
            <CardDescription>
              Revoking ends access at once. The app will ask you to sign in again.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Authorized</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.clientName}
                      {c.clientUri && (
                        <span className="block font-mono text-xs text-muted-foreground">
                          {safeHost(c.clientUri)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.serverId ? (
                        <Badge variant="secondary">{c.serverName ?? "One server"}</Badge>
                      ) : (
                        <Badge variant="warning">All servers</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(c.authorizedAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lastUsedAt ? formatDateTime(c.lastUsedAt) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setPending(c)}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Add to Claude or ChatGPT as a custom connector</CardTitle>
          <CardDescription>
            One URL per server gives the app every MCP on it. No API key to paste: the app opens a
            TwinMCP sign-in and you pick what it may reach.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {servers.length > 1 && (
            <label className="flex flex-wrap items-center gap-2">
              <span className="smallcaps tracking-sc text-xs text-muted-foreground">Server</span>
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-9 border border-input bg-card px-2 text-sm shadow-inner"
              >
                {servers.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="flex items-stretch gap-2">
            <code className="flex-1 break-all border border-border bg-secondary/60 px-3 py-2 font-mono text-sm">
              {url}
            </code>
            <button
              type="button"
              onClick={copy}
              disabled={!slug}
              aria-label="Copy URL"
              className="grid w-10 place-items-center border border-border bg-card text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {copied ? (
                <Check aria-hidden className="h-4 w-4 text-success" />
              ) : (
                <Copy aria-hidden className="h-4 w-4" />
              )}
            </button>
          </div>
          {servers.length === 0 && (
            <p className="text-xs italic text-muted-foreground">
              Create a server first:{" "}
              <Link
                href={"/dashboard/servers" as Route}
                className="not-italic text-brand underline underline-offset-4"
              >
                Servers
              </Link>
              .
            </p>
          )}
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              <span className="font-medium">Claude</span> (claude.ai or Claude Desktop): Settings,
              Connectors, Add custom connector. Paste the URL, then Connect.
            </li>
            <li>
              <span className="font-medium">ChatGPT</span>: turn on Developer mode in Settings, Apps
              &amp; Connectors, Advanced settings, then create a connector with the URL and OAuth
              authentication. Custom connectors depend on your ChatGPT plan.
            </li>
            <li>
              <span className="font-medium">Claude Code</span>:{" "}
              <code className="font-mono text-xs">
                claude mcp add --transport http twinmcp {url}
              </code>
              , then run <code className="font-mono text-xs">/mcp</code> to sign in.
            </li>
            <li>
              Sign in to TwinMCP when the app asks, choose the server, and allow access. It then
              appears in the list above.
            </li>
          </ol>
          <p className="text-xs italic text-muted-foreground">
            Menu names can differ between app versions. Tool calls made by a connector count against
            your plan&apos;s daily quota, like calls made with an API key.
          </p>
        </CardContent>
      </Card>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke {pending?.clientName}?</DialogTitle>
            <DialogDescription>
              Its access and refresh tokens stop working immediately. To use it again, connect it
              again from the app.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={revoking}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => pending && revoke(pending)}
              disabled={revoking}
            >
              {revoking ? "Revoking…" : "Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function safeHost(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return "";
  }
}
