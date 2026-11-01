"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Trash2 } from "lucide-react";
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
import { fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { IDE_LABELS, type IdeKey } from "@/lib/mcp/client-config";

const IDE_KEYS = Object.keys(IDE_LABELS) as IdeKey[];

export function SettingsPanel({
  email,
  idePreference,
  emailNudges: initialEmailNudges = true,
}: {
  email: string;
  idePreference: string;
  /** users.metadata.emailNudges !== false (absent means on). */
  emailNudges?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ide, setIde] = useState(idePreference);
  const [savingIde, setSavingIde] = useState(false);
  const [emailNudges, setEmailNudges] = useState(initialEmailNudges);
  const [savingNudges, setSavingNudges] = useState(false);

  // PATCH /api/v2/users/me/preferences merges { emailNudges } into
  // users.metadata; the lifecycle emails skip anyone who turned it off.
  async function saveEmailNudges(next: boolean) {
    const previous = emailNudges;
    setEmailNudges(next);
    setSavingNudges(true);
    try {
      const res = await fetch("/api/v2/users/me/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ emailNudges: next }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success(
        next
          ? "Credit tips and reminder emails turned on"
          : "Credit tips and reminder emails turned off"
      );
    } catch {
      setEmailNudges(previous);
      toast.error("Could not save preference");
    }
    setSavingNudges(false);
  }

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
    <div className="space-y-6 md:space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account and preferences.</p>
      </header>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Your profile and the default IDE used for connect snippets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium leading-none">Email</span>
            {/* Read-only field: shaped like an input, on the quiet light-blue fill. */}
            <div className="flex min-h-10 items-center break-all rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
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
              className={cn(
                fieldClasses,
                "h-10 max-w-xs [&>option]:bg-card [&>option]:text-foreground"
              )}
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

      {/* Email notifications: the one preference the lifecycle emails honour
          (every nudge email links here under "Manage email preferences"). */}
      <Card id="email-notifications" className="max-w-2xl">
        <CardHeader>
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>Receipts and subscription changes are always sent.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* A native checkbox kept for the keyboard and screen readers (sr-only),
              drawn as a rounded square that fills with brand blue when checked. */}
          <label htmlFor="email-nudges" className="flex cursor-pointer items-start gap-3 text-sm">
            <input
              id="email-nudges"
              type="checkbox"
              className="peer sr-only"
              checked={emailNudges}
              disabled={savingNudges}
              onChange={(e) => saveEmailNudges(e.target.checked)}
            />
            <span
              aria-hidden
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-input bg-card text-transparent transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
            <span>
              Email me setup tips, low-balance alerts and reminders before my free credit expires.
              Receipts and out-of-credit warnings are always sent.
            </span>
          </label>
        </CardContent>
      </Card>

      {/* Danger zone: red hairline, an icon with the title (never colour alone),
          an outline destructive button; the solid red one lives in the dialog. */}
      <Card className="max-w-2xl border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle aria-hidden className="size-5 shrink-0" />
            Delete account
          </CardTitle>
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
                className="border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10"
              >
                <Trash2 aria-hidden />
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
