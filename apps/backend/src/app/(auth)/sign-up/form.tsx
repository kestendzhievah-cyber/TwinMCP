"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { OAuthButtons, OAuthDivider } from "@/components/auth/oauth-buttons";
import { createClient } from "@/utils/supabase/client";
import { track } from "@/lib/analytics/funnel";

const SELECTED_PLAN_KEY = "tmcp_signup_plan";
const allowedPlans = new Set(["free", "pro", "team"]);
const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
};

export function SignUpForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/dashboard";
  const planParam = searchParams.get("plan");
  const selectedPlan = planParam && allowedPlans.has(planParam) ? planParam : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Persist selected plan for the post-signup onboarding flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedPlan) {
      window.localStorage.setItem(SELECTED_PLAN_KEY, selectedPlan);
    }
  }, [selectedPlan]);

  // Fire signup_started once when the form mounts.
  useEffect(() => {
    track({ name: "signup_started" });
  }, []);

  // Resend cooldown ticker.
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function submitSignUp(): Promise<{ error?: string }> {
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    return err ? { error: err.message } : {};
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await submitSignUp();
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    track({ name: "signup_completed", properties: { method: "password", via: "client" } });
    setDone(true);
    setResendCooldown(60);
    setLoading(false);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");
    const result = await submitSignUp();
    if (result.error) {
      setError(result.error);
      return;
    }
    setResendCooldown(60);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
          <Mail className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to{" "}
          <span className="font-medium text-foreground">{email}</span>. Click it to activate your
          account.
        </p>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        <div className="mt-8 flex flex-col gap-2 self-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="h-10"
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setEmail("");
              setPassword("");
              setError("");
            }}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Wrong email? Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Create your TwinMCP account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free forever, no credit card. Set up your first server in under 2 minutes.
        </p>
        {selectedPlan && (
          <Badge variant="secondary" className="mt-4 inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Signing up for {planLabels[selectedPlan]}</span>
          </Badge>
        )}
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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={loading} className="h-10">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        By creating an account you agree to our{" "}
        <a href="/#" className="underline-offset-4 hover:underline">
          Terms
        </a>{" "}
        and{" "}
        <a href="/#" className="underline-offset-4 hover:underline">
          Privacy Policy
        </a>
        .
      </p>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}` as Route}
          className="font-medium text-foreground hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
