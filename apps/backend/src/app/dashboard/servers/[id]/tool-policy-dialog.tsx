"use client";

// "Tool access" for one installed MCP: choose which of its tools clients may
// see and call. Saved to PUT /api/v2/servers/[id]/mcps/[userServerId]/policy;
// enforced by the MCP proxy (lib/mcp/tool-policy.ts). The tool list comes from
// the playground endpoint (POST /api/v2/servers/[id]/try {method:"tools/list"});
// when the MCP is asleep or unreachable, names can still be typed by hand.

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  extractToolsFromTryResponse,
  isToolCallAllowed,
  MAX_TOOL_NAME_LENGTH,
  parseToolPolicy,
  type ToolPolicy,
  type ToolPolicyMode,
  type ToolSummary,
} from "@/lib/mcp/tool-policy";

const MODES: Array<{ value: ToolPolicyMode; label: string; help: string }> = [
  {
    value: "all",
    label: "All tools",
    help: "Every tool the MCP exposes, minus the ones you block below.",
  },
  {
    value: "read_only",
    label: "Read-only only",
    help: "Only tools the MCP author marked read-only (readOnlyHint). Tools that declare nothing are hidden.",
  },
  {
    value: "allow_list",
    label: "Custom allow-list",
    help: "Only the tools you tick. Anything new the MCP adds later stays hidden until you allow it.",
  },
];

function sortedNames(set: Set<string>): string[] {
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function ToolPolicyDialog({
  open,
  onOpenChange,
  serverId,
  userServerId,
  mcpSlug,
  mcpName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverId: string;
  userServerId: string;
  mcpSlug: string;
  mcpName: string;
}) {
  const router = useRouter();
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [loadingTools, setLoadingTools] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<ToolPolicyMode>("all");
  const [allow, setAllow] = useState<Set<string>>(new Set());
  const [deny, setDeny] = useState<Set<string>>(new Set());
  const [tools, setTools] = useState<ToolSummary[] | null>(null);
  const [toolsError, setToolsError] = useState<string | null>(null);
  const [manualName, setManualName] = useState("");
  // Parents pass an inline onOpenChange; keep it out of the effect deps so a
  // re-render does not refetch.
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // Current policy.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingPolicy(true);
    fetch(`/api/v2/servers/${serverId}/mcps/${userServerId}/policy`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { policy: unknown }) => {
        if (cancelled) return;
        const p = parseToolPolicy(d.policy);
        setMode(p?.mode ?? "all");
        setAllow(new Set(p?.allow ?? []));
        setDeny(new Set(p?.deny ?? []));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        toast.error(`Failed to load tool access: ${err.message}`);
        onOpenChangeRef.current(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingPolicy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, serverId, userServerId]);

  // The MCP's live tool list (may fail while the box wakes up), before the
  // saved policy: a tool hidden today must stay pickable.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingTools(true);
    setTools(null);
    setToolsError(null);
    fetch(`/api/v2/servers/${serverId}/try`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ method: "tools/list", mcpSlug, userServerId, ignorePolicy: true }),
      cache: "no-store",
    })
      .then(async (r) => {
        const body: unknown = await r.json().catch(() => null);
        if (!r.ok) {
          const msg =
            body && typeof body === "object" && "message" in body
              ? String((body as { message: unknown }).message)
              : `HTTP ${r.status}`;
          throw new Error(msg);
        }
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        const list = extractToolsFromTryResponse(body, mcpSlug);
        if (list) setTools(list);
        else setToolsError("The MCP did not return a tool list.");
      })
      .catch((err: Error) => {
        if (!cancelled) setToolsError(err.message || "Could not reach the MCP.");
      })
      .finally(() => {
        if (!cancelled) setLoadingTools(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, serverId, userServerId, mcpSlug]);

  const draft: ToolPolicy = useMemo(
    () => ({
      mode,
      ...(mode === "allow_list" ? { allow: sortedNames(allow) } : {}),
      ...(deny.size > 0 ? { deny: sortedNames(deny) } : {}),
    }),
    [mode, allow, deny]
  );

  const knownNames = useMemo(() => new Set((tools ?? []).map((t) => t.name)), [tools]);
  // Names in the policy that the live list does not show (typed by hand, or
  // tools the MCP no longer exposes) — kept visible so they can be removed.
  const extraAllow = sortedNames(allow).filter((n) => !knownNames.has(n));
  const extraDeny = sortedNames(deny).filter((n) => !knownNames.has(n));
  const exposedCount = tools
    ? tools.filter((t) => isToolCallAllowed(t.name, draft, tools)).length
    : null;

  function toggleIn(setter: typeof setAllow, name: string, on: boolean) {
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.add(name);
      else next.delete(name);
      return next;
    });
  }

  function addManual(target: "allow" | "deny") {
    const name = manualName.trim();
    if (!name || name.length > MAX_TOOL_NAME_LENGTH) return;
    toggleIn(target === "allow" ? setAllow : setDeny, name, true);
    setManualName("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/v2/servers/${serverId}/mcps/${userServerId}/policy`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ policy: draft }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Tool access saved");
      onOpenChange(false);
      router.refresh();
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to save tool access");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tool access · {mcpName}</DialogTitle>
          <DialogDescription>
            Choose which tools of this MCP your clients can see and call. Blocked tools are removed
            from tools/list and refused on tools/call.
          </DialogDescription>
        </DialogHeader>

        {loadingPolicy ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <fieldset className="space-y-3">
              <legend className="smallcaps tracking-sc mb-2 text-xs font-medium text-foreground/85">
                Mode
              </legend>
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className="flex cursor-pointer items-start gap-3 border border-border p-3 has-[:checked]:border-foreground"
                >
                  <input
                    type="radio"
                    name="tool-policy-mode"
                    value={m.value}
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                    className="mt-1 accent-foreground"
                  />
                  <span className="space-y-1 text-sm">
                    <span className="block font-medium">{m.label}</span>
                    <span className="block italic text-muted-foreground">{m.help}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {mode === "allow_list" && allow.size === 0 && (
              <p className="border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                The allow-list is empty: no tool of this MCP will be callable.
              </p>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="eyebrow flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
                  Tools
                </p>
                {exposedCount !== null && tools && (
                  <span className="text-xs text-muted-foreground">
                    <span className="lining">{exposedCount}</span> of{" "}
                    <span className="lining">{tools.length}</span> exposed
                  </span>
                )}
              </div>

              {loadingTools ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : toolsError ? (
                <p className="border border-info/40 bg-info/10 px-3 py-2 text-xs text-info">
                  Could not list this MCP&apos;s tools ({toolsError}). If the server is paused or
                  waking up, try again in a moment. You can still type tool names below.
                </p>
              ) : tools && tools.length === 0 ? (
                <p className="text-sm italic text-muted-foreground">This MCP exposes no tools.</p>
              ) : tools ? (
                <div className="max-h-72 divide-y divide-border overflow-y-auto border border-border">
                  {tools.map((t) => {
                    const ro = t.annotations?.readOnlyHint === true;
                    const destructive = t.annotations?.destructiveHint === true;
                    const openWorld = t.annotations?.openWorldHint === true;
                    const exposed = isToolCallAllowed(t.name, draft, tools);
                    const allowChecked =
                      mode === "allow_list" ? allow.has(t.name) : mode === "all" ? true : ro;
                    return (
                      <div
                        key={t.name}
                        className="flex items-start justify-between gap-3 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span
                              className={`font-mono text-xs ${exposed ? "text-foreground" : "text-muted-foreground line-through"}`}
                            >
                              {t.name}
                            </span>
                            {ro && <Badge variant="success">read-only</Badge>}
                            {destructive && <Badge variant="destructive">destructive</Badge>}
                            {openWorld && <Badge variant="info">open world</Badge>}
                          </div>
                          {(t.description || t.title) && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {t.description || t.title}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <label className="smallcaps tracking-sc flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={allowChecked}
                              disabled={mode !== "allow_list"}
                              onChange={(e) => toggleIn(setAllow, t.name, e.target.checked)}
                              className="h-4 w-4 accent-foreground"
                              aria-label={`Allow ${t.name}`}
                            />
                            allow
                          </label>
                          <label className="smallcaps tracking-sc flex min-h-8 items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={deny.has(t.name)}
                              onChange={(e) => toggleIn(setDeny, t.name, e.target.checked)}
                              className="h-4 w-4 accent-foreground"
                              aria-label={`Block ${t.name}`}
                            />
                            block
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {(extraAllow.length > 0 && mode === "allow_list") || extraDeny.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs italic text-muted-foreground">
                    Names not in the current tool list:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {mode === "allow_list" &&
                      extraAllow.map((n) => (
                        <Badge key={`a-${n}`} variant="outline" className="no-smallcaps font-mono">
                          allow {n}
                          <button
                            type="button"
                            onClick={() => toggleIn(setAllow, n, false)}
                            aria-label={`Remove ${n} from the allow-list`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    {extraDeny.map((n) => (
                      <Badge
                        key={`d-${n}`}
                        variant="destructive"
                        className="no-smallcaps font-mono"
                      >
                        block {n}
                        <button
                          type="button"
                          onClick={() => toggleIn(setDeny, n, false)}
                          aria-label={`Remove ${n} from the block list`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="tool-policy-manual">Add a tool by name</Label>
                <div className="flex flex-wrap gap-2">
                  <Input
                    id="tool-policy-manual"
                    className="min-w-0 flex-1 font-mono"
                    maxLength={MAX_TOOL_NAME_LENGTH}
                    value={manualName}
                    placeholder="tool_name"
                    onChange={(e) => setManualName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManual(mode === "allow_list" ? "allow" : "deny");
                      }
                    }}
                  />
                  {mode === "allow_list" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => addManual("allow")}
                      disabled={!manualName.trim()}
                    >
                      <Plus className="h-4 w-4" /> Allow
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addManual("deny")}
                    disabled={!manualName.trim()}
                  >
                    <Plus className="h-4 w-4" /> Block
                  </Button>
                </div>
                <p className="text-xs italic text-muted-foreground">
                  Blocking always wins. Read-only relies on the annotations the MCP author declares;
                  they are hints, so review destructive tools yourself.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
