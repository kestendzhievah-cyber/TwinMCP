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
import { Plus } from "lucide-react";
import type { Plan } from "@/db/schema/core";
import { allowedBoxSizes, minPlanForBoxSize, PLAN_LABELS } from "@/lib/plan-features";

const BOX_SIZES = [
  { value: "small", label: "Small — 2 vCPU / 4 GB RAM" },
  { value: "medium", label: "Medium — 4 vCPU / 8 GB RAM" },
  { value: "large", label: "Large — 8 vCPU / 16 GB RAM" },
] as const;

interface CreateServerDialogProps {
  plan: Plan;
  disabled?: boolean;
  trigger?: React.ReactNode;
}

export function CreateServerDialog({ plan, disabled, trigger }: CreateServerDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [boxSize, setBoxSize] = useState("small");
  const [region, setRegion] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/v2/servers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        boxSize,
        region: region.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      toast.success(`Server "${name}" created — provisioning…`);
      setOpen(false);
      setName("");
      setRegion("");
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
          <Button disabled={disabled}>
            <Plus className="h-4 w-4" /> New server
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a new server</DialogTitle>
          <DialogDescription>
            A new Upstash Box runtime will be provisioned. TwinMCP Docs is auto-installed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              minLength={1}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My MCP Server"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="size">Box size</Label>
            <Select value={boxSize} onValueChange={setBoxSize}>
              <SelectTrigger id="size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOX_SIZES.map((s) => {
                  const allowed = allowedBoxSizes(plan).includes(s.value);
                  const required = minPlanForBoxSize(s.value);
                  return (
                    <SelectItem key={s.value} value={s.value} disabled={!allowed}>
                      {s.label}
                      {!allowed && required ? ` · ${PLAN_LABELS[required]}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {allowedBoxSizes(plan).length < BOX_SIZES.length && (
              <p className="text-xs text-muted-foreground">
                Larger boxes are available on higher plans.{" "}
                <a href="/dashboard/billing" className="underline underline-offset-2">
                  Upgrade
                </a>
                .
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">Region (optional)</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="e.g. us-east-1"
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
