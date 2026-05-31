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
import { PasswordStrength, passwordScore } from "@/components/auth/password-strength";
import { createClient } from "@/utils/supabase/client";
import { track } from "@/lib/analytics/funnel";
import { friendlyAuthError } from "@/lib/auth/errors";

const SELECTED_PLAN_KEY = "tmcp_signup_plan";
const SELECTED_CADENCE_KEY = "tmcp_signup_cadence";
const SELECTED_PROMO_KEY = "tmcp_signup_promo";
const allowedPlans = new Set(["free", "pro", "team"]);
const allowedCadences = new Set(["monthly", "yearly"]);
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
  const cadenceParam = searchParams.get("cadence");
  const selectedCadence =
    cadenceParam && allowedCadences.has(cadenceParam) ? cadenceParam : null;
  // Creator landing → carry the slug through the email-confirm round trip
  // so the post-signup checkout can pre-apply the discount.
  const promoParam = searchParams.get("promo");
  const selectedPromo = promoParam && /^[a-z0-9-]{1,64}$/.test(promoParam) ? promoParam : null;

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Persist selected plan + cadence so the post-confirm redirect (in
  // /auth/callback or in the onAuthStateChange handler below) can jump
  // straight to Stripe Checkout without re-asking what the user picked.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedPlan) {
      window.localStorage.setItem(SELECTED_PLAN_KEY, selectedPlan);
    }
    if (selectedCadence) {
      window.localStorage.setItem(SELECTED_CADENCE_KEY, selectedCadence);
    }
    if (selectedPromo) {
      window.localStorage.setItem(SELECTED_PROMO_KEY, selectedPromo);
    }
  }, [selectedPlan, selectedCadence, selectedPromo]);

  useEffect(() => {
    track({ name: "signup_started" });
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // Auto-detect when the user clicks the confirmation link in another tab —
  // Supabase fires onAuthStateChange in this tab too. If a paid plan was
  // pre-selected, jump straight to the Stripe Checkout instead of the
  // dashboard so the buying intent isn't lost.
  useEffect(() => {
    if (!done) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "SIGNED_IN") return;
      const plan = window.localStorage.getItem(SELECTED_PLAN_KEY);
      const cadence = window.localStorage.getItem(SELECTED_CADENCE_KEY) ?? "monthly";
      const promo = window.localStorage.getItem(SELECTED_PROMO_KEY);
      if (plan === "pro" || plan === "team") {
        try {
          const res = await fetch("/api/v2/billing/checkout", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              plan,
              cadence,
              ...(promo ? { creatorSlug: promo } : {}),
            }),
          });
          const body = await res.json();
          if (body.url) {
            // Clear the promo flag so a stale slug can't haunt the next signup
            // attempt from the same browser.
            window.localStorage.removeItem(SELECTED_PROMO_KEY);
            window.location.assign(body.url);
            return;
          }
        } catch {
          // fall through to default redirect on any failure
        }
      }
      window.location.assign(returnTo);
    });
    return () => data.subscription.unsubscribe();
  }, [done, returnTo]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    if (err) {
      setError(friendlyAuthError(err));
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
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}`,
      },
    });
    if (err) {
      setError(friendlyAuthError(err));
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
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Vérifie tes emails</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un lien de confirmation a été envoyé à{" "}
          <span className="font-medium text-foreground">{email}</span>. Clique dessus pour activer
          ton compte.
        </p>

        <div role="alert" aria-live="assertive" className="mt-4 min-h-[2.5rem]">
          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2 self-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="h-10"
          >
            {resendCooldown > 0 ? `Renvoyer dans ${resendCooldown}s` : "Renvoyer le lien"}
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
            Mauvaise adresse ? Recommencer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Crée ton compte TwinMCP</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Gratuit à vie, sans carte bancaire. Premier serveur en moins de 2 minutes.
        </p>
        {selectedPlan && (
          <Badge variant="secondary" className="mt-4 inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Inscription pour {planLabels[selectedPlan]}</span>
          </Badge>
        )}
      </div>

      <OAuthButtons returnTo={returnTo} />
      <OAuthDivider>ou par email</OAuthDivider>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
            autoFocus={!email}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Au moins 8 caractères"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            aria-describedby="password-strength"
          />
          <div id="password-strength">
            <PasswordStrength password={password} />
          </div>
        </div>

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && (
            <p className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || !email || passwordScore(password) < 2}
          className="h-10"
        >
          {loading ? "Création…" : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-6 text-xs text-muted-foreground">
        En créant un compte tu acceptes nos{" "}
        <Link href={"/legal/terms" as Route} className="underline-offset-4 hover:underline">
          Conditions
        </Link>{" "}
        et notre{" "}
        <Link href={"/legal/privacy" as Route} className="underline-offset-4 hover:underline">
          Politique de confidentialité
        </Link>
        .
      </p>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href={
            `/sign-in?returnTo=${encodeURIComponent(returnTo)}${email ? `&email=${encodeURIComponent(email)}` : ""}` as Route
          }
          className="font-medium text-foreground hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  );
}
