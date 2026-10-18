"use client";

import Link from "next/link";
import type { Route } from "next";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent("/reset-password")}`,
    });
    if (err) {
      setError(friendlyAuthError(err));
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center">
        {/* The stamp: a hairline icon square between two short rules. */}
        <div className="flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
          <span
            aria-hidden
            className="grid h-12 w-12 place-items-center border border-border text-muted-foreground"
          >
            <Mail className="h-5 w-5" />
          </span>
        </div>
        <h1 className="smallcaps tracking-sc mt-6 text-2xl font-medium">Check your email</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          If an account exists for <span className="font-medium text-foreground">{email}</span>, a
          reset link has just been sent.
        </p>
        <div className="mt-8 flex flex-col gap-2 self-stretch">
          <Button asChild variant="outline">
            <Link href={"/sign-in" as Route}>
              <ArrowLeft />
              Back to sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={"/sign-in" as Route}
        className="smallcaps tracking-sc mb-4 inline-flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to sign in
      </Link>

      <div className="mb-8">
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Forgot your password?</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          Enter your email and we&apos;ll send you a link to choose a new one.
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && (
            <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <Button type="submit" disabled={loading || !email}>
          {loading ? "Sending…" : "Send link"}
        </Button>
      </form>
    </div>
  );
}
