"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PoliciesForm({
  teamspaceId,
  minTrustScore,
  blockedLibraryIds,
}: {
  teamspaceId: string;
  minTrustScore: number;
  blockedLibraryIds: string[];
}) {
  const router = useRouter();
  const [trust, setTrust] = useState(minTrustScore);
  const [blocked, setBlocked] = useState(blockedLibraryIds.join(", "));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/v2/policies", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamspaceId,
        minTrustScore: trust,
        blockedLibraryIds: blocked
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Policies saved");
      router.refresh();
    } else {
      toast.error("Failed to save policies");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="trust">Minimum trust score (0–10)</Label>
        <Input
          id="trust"
          type="number"
          min={0}
          max={10}
          step={0.5}
          value={trust}
          onChange={(e) => setTrust(Number(e.target.value))}
          className="w-32"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="blocked">Blocked library IDs (comma-separated)</Label>
        <Input
          id="blocked"
          value={blocked}
          onChange={(e) => setBlocked(e.target.value)}
          placeholder="/owner/repo, /other/lib"
        />
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save policies"}
      </Button>
    </form>
  );
}
