"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons, OAuthDivider } from "@/components/auth/oauth-buttons";
import { createClient } from "@/utils/supabase/client";

type Mode = "password" | "magic-link";

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "password") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      router.push(returnTo as Route);
      return;
    }

    // Magic link
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
        shouldCreateUser: false,
      },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMagicLinkSent(true);
    setLoading(false);
  }

  if (magicLinkSent) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a one-time sign-in link to <span className="font-medium text-foreground">{email}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            setMagicLinkSent(false);
            setMode("password");
          }}
          className="mt-6 text-sm font-medium text-foreground underline-offset-4 hover:underline"
        >
          Use a different method
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to TwinMCP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome back. Pick the method you prefer.
        </p>
      </div>

      <OAuthButtons returnTo={returnTo} />
      <OAuthDivider>or with email</OAuthDivider>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {mode === "password" && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href={"/forgot-password" as Route}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="h-10">
          {loading
            ? "Signing in…"
            : mode === "password"
              ? "Sign in"
              : "Email me a magic link"}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "password" ? "magic-link" : "password"));
            setError("");
          }}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {mode === "password"
            ? "Use a magic link instead"
            : "Use a password instead"}
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to TwinMCP?{" "}
        <Link
          href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}` as Route}
          className="font-medium text-foreground hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
