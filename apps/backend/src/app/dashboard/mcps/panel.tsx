"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Globe, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

// Mirrors mcpRuntimes in db/schema/platform.ts. Boxes run node + python today;
// the others are accepted by the schema for forward-compatibility.
const RUNTIMES = [
  { value: "node", label: "Node.js — npx (supported)" },
  { value: "python", label: "Python — uvx (supported)" },
  { value: "node-alpine", label: "Node.js (alpine)" },
  { value: "python-alpine", label: "Python (alpine)" },
  { value: "go", label: "Go" },
  { value: "golang-alpine", label: "Go (alpine)" },
  { value: "ruby", label: "Ruby" },
  { value: "rust", label: "Rust" },
] as const;

interface PublishedMcp {
  id: string;
  slug: string;
  name: string;
  runtime: string;
  version: string;
  isPublic: boolean;
}

interface ConfigField {
  key: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  secret: boolean;
  description: string;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function PublishMcpPanel({
  mcps,
  canPublish,
}: {
  mcps: PublishedMcp[];
  canPublish: boolean;
}) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [runtime, setRuntime] = useState<string>("node");
  const [version, setVersion] = useState("latest");
  const [installCmd, setInstallCmd] = useState("true");
  const [startCmd, setStartCmd] = useState("");
  const [description, setDescription] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [fields, setFields] = useState<ConfigField[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PublishedMcp | null>(null);
  const [deleting, setDeleting] = useState(false);

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  function addField() {
    setFields((f) => [
      ...f,
      { key: "", type: "string", required: false, secret: false, description: "" },
    ]);
  }
  function updateField(i: number, patch: Partial<ConfigField>) {
    setFields((f) => f.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removeField(i: number) {
    setFields((f) => f.filter((_, idx) => idx !== i));
  }

  function reset() {
    setName("");
    setSlug("");
    setSlugEdited(false);
    setRuntime("node");
    setVersion("latest");
    setInstallCmd("true");
    setStartCmd("");
    setDescription("");
    setRepoUrl("");
    setFields([]);
  }

  async function publish(e: FormEvent) {
    e.preventDefault();
    if (!slug.trim() || !name.trim() || !startCmd.trim()) {
      toast.error("Name, slug and start command are required.");
      return;
    }

    // Build configSchema from the field rows (skip blank keys).
    const properties: Record<
      string,
      { type: ConfigField["type"]; required: boolean; secret: boolean; description?: string }
    > = {};
    for (const f of fields) {
      const key = f.key.trim();
      if (!key) continue;
      properties[key] = {
        type: f.type,
        required: f.required,
        secret: f.secret,
        ...(f.description.trim() ? { description: f.description.trim() } : {}),
      };
    }

    const body: Record<string, unknown> = {
      slug: slug.trim(),
      name: name.trim(),
      runtime,
      version: version.trim() || "latest",
      installCmd: installCmd.trim() || "true",
      startCmd: startCmd.trim(),
    };
    if (description.trim()) body.description = description.trim();
    if (repoUrl.trim()) body.repoUrl = repoUrl.trim();
    if (Object.keys(properties).length) body.configSchema = { properties };

    setSubmitting(true);
    const res = await fetch("/api/v2/mcp-servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);

    if (res.ok) {
      toast.success(`Published ${name.trim()}`);
      reset();
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Could not publish. Check the fields and try again.");
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/v2/mcp-servers/${pendingDelete.slug}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      toast.success(`Deleted ${pendingDelete.name}`);
      setPendingDelete(null);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Could not delete this MCP.");
    }
  }

  // The textarea is set like the Input primitive: a debossed rectangle on the
  // card, hairline turning to ink on focus, italic placeholder.
  const inputCls =
    "flex min-h-[72px] w-full border border-input bg-card px-3 py-2 text-sm text-foreground shadow-inner transition-colors placeholder:italic placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-0";

  return (
    <div className="space-y-8">
      {canPublish && (
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle>New MCP</CardTitle>
            <CardDescription>
              Wrap a stdio MCP server. TwinMCP bridges it to Streamable HTTP inside your box — just
              give the commands to install and start it.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={publish} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My Weather MCP"
                    value={name}
                    onChange={(e) => onNameChange(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input
                    id="slug"
                    placeholder="my-weather-mcp"
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugEdited(true);
                    }}
                    className="font-mono"
                    required
                  />
                  <p className="text-xs italic text-muted-foreground">
                    Lowercase, hyphens only. Used in the connection URL.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="runtime">Runtime</Label>
                  <Select value={runtime} onValueChange={setRuntime}>
                    <SelectTrigger id="runtime">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RUNTIMES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    placeholder="latest"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startCmd">Start command</Label>
                <Input
                  id="startCmd"
                  placeholder="npx -y my-weather-mcp-server"
                  value={startCmd}
                  onChange={(e) => setStartCmd(e.target.value)}
                  className="font-mono"
                  required
                />
                <p className="text-xs italic text-muted-foreground">
                  The stdio command TwinMCP runs. Reference config values as{" "}
                  <code className="font-mono not-italic">$MY_KEY</code>.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="installCmd">Install command</Label>
                <Input
                  id="installCmd"
                  placeholder="true"
                  value={installCmd}
                  onChange={(e) => setInstallCmd(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs italic text-muted-foreground">
                  Runs once before start. Use <code className="font-mono not-italic">true</code> if
                  npx/uvx fetches it on demand.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="repoUrl">Repository URL (optional)</Label>
                  <Input
                    id="repoUrl"
                    type="url"
                    placeholder="https://github.com/you/my-weather-mcp"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <textarea
                    id="description"
                    placeholder="What does this MCP do?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={inputCls}
                    maxLength={2000}
                  />
                </div>
              </div>

              {/* Config fields editor: a sub-panel on a shade darker stock, its
                  title as an eyebrow with a leading rule, one hairline row per field. */}
              <div className="space-y-4 border border-border bg-secondary/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                      Configuration fields
                    </p>
                    <p className="text-xs italic text-muted-foreground">
                      Values the installer must supply (API keys, paths). Mark secrets so
                      they&apos;re write-only.
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={addField}>
                    <Plus className="h-4 w-4" />
                    Add field
                  </Button>
                </div>

                {fields.length > 0 && (
                  <div className="divide-y divide-border border-t border-border">
                    {fields.map((f, i) => (
                      <div
                        key={i}
                        className="grid items-end gap-2 py-3 sm:grid-cols-[1fr_7rem_1fr_auto]"
                      >
                        <div className="space-y-2">
                          <Label htmlFor={`cfg-key-${i}`}>Key</Label>
                          <Input
                            id={`cfg-key-${i}`}
                            placeholder="API_KEY"
                            value={f.key}
                            onChange={(e) => updateField(i, { key: e.target.value })}
                            className="font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cfg-type-${i}`}>Type</Label>
                          <Select
                            value={f.type}
                            onValueChange={(v) =>
                              updateField(i, { type: v as ConfigField["type"] })
                            }
                          >
                            <SelectTrigger id={`cfg-type-${i}`} className="font-mono">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="string">string</SelectItem>
                              <SelectItem value="number">number</SelectItem>
                              <SelectItem value="boolean">boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`cfg-desc-${i}`}>Description</Label>
                          <Input
                            id={`cfg-desc-${i}`}
                            placeholder="What is this?"
                            value={f.description}
                            onChange={(e) => updateField(i, { description: e.target.value })}
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <label className="smallcaps tracking-sc flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={f.required}
                              onChange={(e) => updateField(i, { required: e.target.checked })}
                              className="h-4 w-4 accent-foreground"
                            />
                            req
                          </label>
                          <label className="smallcaps tracking-sc flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={f.secret}
                              onChange={(e) => updateField(i, { secret: e.target.checked })}
                              className="h-4 w-4 accent-foreground"
                            />
                            secret
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeField(i)}
                            aria-label="Remove field"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* A memo, not a warning: the neutral info tint with a left rule. */}
              <p className="border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
                Published MCPs are <span className="font-medium">private to your account</span> —
                only you can install them on your boxes. Listing an MCP in the public marketplace is
                reviewed manually (it runs its install/start commands in other users&apos; boxes).
                To request a public listing, email{" "}
                <a
                  href="mailto:hello@twinmcp.fr?subject=Public%20MCP%20listing%20request"
                  className="font-medium underline decoration-info/40 underline-offset-4 transition-colors hover:decoration-info"
                >
                  hello@twinmcp.fr
                </a>
                .
              </p>

              <div className="flex justify-end border-t border-border pt-6">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Publishing…" : "Publish MCP"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Your MCPs</CardTitle>
          <CardDescription className="lining">
            {mcps.length === 0
              ? "Nothing published yet."
              : `${mcps.length} published MCP${mcps.length > 1 ? "s" : ""}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {mcps.length === 0 ? (
            // Empty slot (DESIGN.md §5): dashed ink hairline, one italic line.
            <p className="border border-dashed border-foreground/40 px-4 py-8 text-center text-sm italic text-muted-foreground">
              Publish your first MCP with the form above — it appears here and in the marketplace
              (if public).
            </p>
          ) : (
            // The ledger (§4.5): small-capital heads on a firmer rule, hairline
            // rows, the name over its mono slug@version, the runtime in Courier.
            <div className="border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MCP</TableHead>
                    <TableHead className="w-28">Runtime</TableHead>
                    <TableHead className="w-28">Visibility</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mcps.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <div className="font-medium">{m.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {m.slug}@{m.version}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{m.runtime}</TableCell>
                      <TableCell>
                        {m.isPublic ? (
                          <Badge variant="outline">
                            <Globe className="h-3.5 w-3.5" /> Public
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Lock className="h-3.5 w-3.5" /> Private
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(m)}
                          aria-label={`Delete ${m.name}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              This removes the MCP from your catalog and the marketplace. Servers where it&apos;s
              already installed keep running; you just can&apos;t install it again. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
