"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

const IDE_KEYS = Object.keys(IDE_LABELS) as IdeKey[];

export function SettingsPanel({ email, idePreference }: { email: string; idePreference: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ide, setIde] = useState(idePreference);
  const [savingIde, setSavingIde] = useState(false);

  async function saveIde(next: string) {
    setIde(next);
    if (!next) return; // "Not set" — nothing to persist
    setSavingIde(true);
    const res = await fetch("/api/v2/users/me/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idePreference: next }),
    });
    setSavingIde(false);
    if (res.ok) toast.success("Preference saved");
    else toast.error("Could not save preference");
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch("/api/v2/account", { method: "DELETE" });
    if (res.ok) {
      router.push("/");
      return;
    }
    // Keep the dialog open on failure so the user knows the account still exists.
    setDeleting(false);
    const err = await res.json().catch(() => ({}));
    toast.error(
      err.message ?? "Couldn't delete your account. Please try again or contact support."
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header (DESIGN.md §5): small-caps name, italic line, double rule. */}
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Settings</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">Your account and preferences.</p>
        <Separator variant="double" className="mt-4" />
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your profile and the default IDE used for connect snippets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2">
            <span className="smallcaps tracking-sc text-xs font-medium leading-none text-foreground/85">
              Email
            </span>
            {/* Read-only field: debossed like an input, but on the darker stock. */}
            <div className="flex min-h-10 items-center break-all border border-border bg-secondary/60 px-3 py-2 text-sm">
              {email || "—"}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ide-pref">Default IDE</Label>
            <select
              id="ide-pref"
              value={ide}
              onChange={(e) => saveIde(e.target.value)}
              disabled={savingIde}
              className="h-10 w-full max-w-xs border border-input bg-card px-3 text-sm text-foreground shadow-inner transition-colors focus-visible:border-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>option]:bg-card [&>option]:text-foreground"
            >
              <option value="">Not set</option>
              {IDE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {IDE_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone: oxblood hairline and title, the button stamps in oxblood on hover. */}
      <Card className="max-w-xl border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            This permanently deletes your account, API keys, servers (their Upstash Box runtimes are
            torn down), usage history, and team memberships, and cancels any active subscription.
            This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
              >
                Delete my account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Are you absolutely sure?</DialogTitle>
                <DialogDescription>
                  This will delete everything tied to your account and sign you out immediately.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Deleting…" : "Yes, delete everything"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
