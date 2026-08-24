"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Password updated</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm text-muted-foreground">Checking your reset link…</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10">
          <AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Link invalid or expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This password reset link is no longer valid. Request a new one to continue.
        </p>
        <Link
          href={"/forgot-password" as Route}
          className="mt-6 text-sm font-medium text-foreground hover:underline"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">New password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pick a strong one — at least 8 characters, ideally with numbers and capitals.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
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

        <div className="flex flex-col gap-1.5">
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
          />
          {mismatch && <p className="text-xs text-destructive">Passwords don&apos;t match.</p>}
        </div>

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <Button type="submit" disabled={loading || !canSubmit} className="h-10">
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Remembered it after all?{" "}
        <Link href={"/sign-in" as Route} className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
