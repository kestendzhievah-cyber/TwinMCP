"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PasswordStrength, passwordScore } from "@/components/auth/password-strength";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // A reset only works with the recovery session the email link establishes. If
  // it's missing (link expired, opened in another browser), say so up front
  // instead of letting the user fill the form and fail on submit.
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setHasSession(!!data.user);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const mismatch = confirm.length > 0 && confirm !== password;
  const tooWeak = passwordScore(password) < 2;
  const canSubmit = !mismatch && !tooWeak && password.length >= 8 && confirm.length >= 8;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
      return;
    }
    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/dashboard" as Route), 1200);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        {/* The stamp: a tinted hairline icon square between two short rules. */}
        <div className="flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center border border-success/40 bg-success/10 text-success"
          >
            <CheckCircle2 className="h-5 w-5" />
          </span>
        </div>
        <h1 className="smallcaps tracking-sc mt-6 text-2xl font-medium">Password updated</h1>
        <p className="mt-3 text-sm italic text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm italic text-muted-foreground">Checking your reset link…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col items-center text-center">
        {/* The stamp: a tinted hairline icon square between two short rules. */}
        <div className="flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center border border-destructive/40 bg-destructive/10 text-destructive"
          >
            <AlertCircle className="h-5 w-5" />
          </span>
        </div>
        <h1 className="smallcaps tracking-sc mt-6 text-2xl font-medium">Link invalid or expired</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This password reset link is no longer valid. Request a new one to continue.
        </p>
        <div className="mt-8 flex flex-col gap-2 self-stretch">
          <Button asChild>
            <Link href={"/forgot-password" as Route}>Request a new link</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="smallcaps tracking-sc text-2xl font-medium">New password</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Pick a strong one — at least 8 characters, ideally with numbers and capitals.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoFocus
            aria-describedby="password-strength"
          />
          <div id="password-strength">
            <PasswordStrength password={password} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            aria-invalid={mismatch}
            className={mismatch ? "border-destructive" : undefined}
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
        </div>

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && (
            <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <Button type="submit" disabled={loading || !canSubmit}>
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="mt-8 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        Remembered it after all?{" "}
        <Link
          href={"/sign-in" as Route}
          className="text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
