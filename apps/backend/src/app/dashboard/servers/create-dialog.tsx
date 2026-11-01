"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Plan } from "@/db/schema/core";
import { allowedBoxSizes } from "@/lib/plan-features";
import { TopUpLink } from "@/components/billing/top-up-inline";
import { cliCommand, localAgentCommand } from "@/lib/cli";

const BOX_SIZES = [
  { value: "small", label: "Small — 2 vCPU / 4 GB RAM" },
  { value: "medium", label: "Medium — 4 vCPU / 8 GB RAM" },
  { value: "large", label: "Large — 8 vCPU / 16 GB RAM" },
] as const;

type HostType = "upstash_box" | "local_agent";

interface CreateServerDialogProps {
  plan: Plan;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function CreateServerDialog({ plan, disabled, trigger }: CreateServerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [hostType, setHostType] = useState<HostType>("upstash_box");
  const [boxSize, setBoxSize] = useState("small");
  const [submitting, setSubmitting] = useState(false);
  const isLocal = hostType === "local_agent";
  // No region field: the API stores a region column but nothing provisions by
  // it, and no plan sells a region choice (PLAN_CAPABILITIES.regionSelection).

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/v2/servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        hostType,
        ...(isLocal ? {} : { boxSize }),
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(
        isLocal
          ? `Server "${name}" created — run ${localAgentCommand(data.slug)} to bring it online.`
          : `Server "${name}" created — provisioning…`
      );
      setOpen(false);
      setName("");
      router.push(`/dashboard/servers/${data.id}` as Route);
    } else {
      const err = await res.json().catch(() => ({}));
      toast.error(err.message ?? "Failed to create server");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          // At the server limit the top-up is the next step, so a disabled
          // trigger is not the page's rose primary.
          <Button disabled={disabled} variant={disabled ? "outline" : "default"}>
            <Plus className="h-4 w-4" /> Create server
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a server</DialogTitle>
          <DialogDescription>
            {isLocal ? (
              <>
                A local server hosts tools that run on your own machine (e.g. Blender) — bring it
                online with the TwinMCP local agent (
                <code className="font-mono text-xs">{cliCommand("connect")}</code>).
              </>
            ) : (
              "A new Upstash Box runtime will be provisioned. TwinMCP Docs is auto-installed."
            )}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="host-type">Type</Label>
            <Select value={hostType} onValueChange={(v) => setHostType(v as HostType)}>
              <SelectTrigger id="host-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upstash_box">Cloud box — hosted MCP runtime</SelectItem>
                <SelectItem value="local_agent">
                  Local — tools on your machine (via agent)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              minLength={1}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isLocal ? "My local tools" : "My MCP Server"}
            />
          </div>

          {!isLocal && (
            <>
              <div className="space-y-2">
                <Label htmlFor="size">Box size</Label>
                <Select value={boxSize} onValueChange={setBoxSize}>
                  <SelectTrigger id="size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOX_SIZES.map((s) => {
                      // Free credit (wallet never funded): small only. A first
                      // top-up unlocks every size (the API enforces this too).
                      const allowed = allowedBoxSizes(plan).includes(s.value);
                      return (
                        <SelectItem key={s.value} value={s.value} disabled={!allowed}>
                          <span className="flex flex-wrap items-center gap-2">
                            {s.label}
                            {!allowed && (
                              <Badge variant="offer">
                                <Lock aria-hidden className="h-3 w-3" />
                                After first top-up
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {allowedBoxSizes(plan).length < BOX_SIZES.length && (
                  <p className="text-xs text-muted-foreground">
                    Medium and large boxes unlock with your first top-up.{" "}
                    <TopUpLink source="servers" level="offer" reason="box_size" label="Top up" />
                  </p>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create server"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
