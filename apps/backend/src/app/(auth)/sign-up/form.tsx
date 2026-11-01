"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Mail, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  AUTH_LINK,
  AUTH_QUIET_ACTION,
  AUTH_TITLE,
  AuthError,
  AuthStatusIcon,
} from "@/components/auth/auth-ui";
import { OfferBadge } from "@/components/marketing/offer-badge";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { SIGNUP_OFFER, walletFacts } from "@/components/pricing/wallet-copy";
import { createClient } from "@/utils/supabase/client";
import { track } from "@/lib/analytics/funnel";
import { readAttribution } from "@/lib/analytics/attribution";
import { friendlyAuthError } from "@/lib/auth/errors";
// The sign-up rule, enforced on the button and stated by the weak-password
// message: shared with the reset form (lib/auth/password-rule.ts).
import { passwordAccepted } from "@/lib/auth/password-rule";
import { normalizePromo, safeReturnTo } from "@/lib/auth/return-to";
import type { Locale } from "@/lib/i18n/locales";
import { authPath } from "@/lib/i18n/auth-paths";

type SignupPlan = "free" | "pro";
type SignupCadence = "monthly" | "yearly";

// Subscriptions are retired (prepaid wallet since 2026-10-29). An old link
// carrying plan=pro / plan=team is a "pay as you go" intent: the account still
// gets the sign-up credit, then lands on the Credits page to top up.
function normalizePlan(plan: string | null): SignupPlan | null {
  if (plan === "pro" || plan === "team") return "pro";
  if (plan === "free") return "free";
  return null;
}
const planLabels: Record<SignupPlan, string> = {
  free: "Free credit",
  pro: "Pay as you go",
};
// The plan seal follows the dashboard's plan badge (DESIGN.md §5 sidebar):
// secondary for free, success for paid.
const planSeals: Record<SignupPlan, "secondary" | "success"> = {
  free: "secondary",
  pro: "success",
};

// Sign-up credit facts, from the wallet price list (lib/wallet/pricing.ts).
const W = { en: walletFacts("en"), fr: walletFacts("fr") };

/**
 * Where the confirmation email sends the user back. The paid intent (plan,
 * cadence, promo) rides in the URL so it survives the email round trip on any
 * device: /auth/callback opens Stripe Checkout straight away for plan=pro.
 */
function callbackUrl(opts: {
  returnTo: string;
  plan: SignupPlan | null;
  cadence: SignupCadence;
  promo: string | null;
  locale: Locale;
}): string {
  const q = new URLSearchParams({ returnTo: opts.returnTo });
  if (opts.plan === "pro") {
    q.set("plan", "pro");
    q.set("cadence", opts.cadence);
    if (opts.promo) q.set("promo", opts.promo);
  } else if (opts.plan === "free") {
    q.set("plan", "free");
  }
  if (opts.locale !== "en") q.set("locale", opts.locale);
  return `${window.location.origin}/auth/callback?${q.toString()}`;
}

// Every visible string, per locale. French uses "vous", like the French landing
// the visitor comes from. Only strings and the legal links differ by locale:
// the Supabase calls, redirects and analytics are shared.
const COPY = {
  en: {
    title: "Create your TwinMCP account",
    subtitleFree: `${SIGNUP_OFFER.en}, valid ${W.en.signupDays} days. Your first server ready in about 2 minutes.`,
    subtitlePaid: (_cadence: SignupCadence) =>
      `Pay as you go, no subscription. Your account starts with ${W.en.signupCredit} of free credit; once you confirm your email you land on the Credits page to top up from ${W.en.minTopup}.`,
    subtitlePromo: `Pay as you go, no subscription. Your account starts with ${W.en.signupCredit} of free credit; once you confirm your email you land on the Credits page.`,
    planSeal: (plan: SignupPlan) => `Signing up for ${planLabels[plan]}`,
    freeLine: `1 server · up to ${FREE_MCP_LIMIT} MCPs + TwinMCP Docs · no subscription`,
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Password",
    passwordPlaceholder: "8+ characters",
    showPassword: "Show password",
    submitFree: `Create account & claim ${W.en.signupCredit}`,
    submitPaid: "Create my account",
    submitting: "Creating…",
    termsLead: "By creating an account you agree to our",
    terms: "Terms",
    termsHref: "/legal/en/terms",
    and: "and our",
    privacy: "Privacy Policy",
    privacyHref: "/legal/en/privacy",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    checkTitle: "Check your email",
    checkLead: "A confirmation link has been sent to",
    checkTail: "Click it to activate your account.",
    checkTailPaid: "Click it to activate your account and open the Credits page.",
    checkSpam: "Nothing yet? Check your spam or promotions folder.",
    resendIn: (s: number) => `Resend in ${s}s`,
    resend: "Resend link",
    startOver: "Wrong address? Start over",
    existsTitle: "You already have an account",
    existsLead: "An account already exists for",
    existsTail: "Sign in to continue, or reset your password if you forgot it.",
    resetPassword: "Reset password",
    useAnother: "Use another address",
  },
  fr: {
    title: "Créez votre compte TwinMCP",
    subtitleFree: `${SIGNUP_OFFER.fr}, valable ${W.fr.signupDays} jours. Votre premier serveur prêt en 2 minutes environ.`,
    subtitlePaid: (_cadence: SignupCadence) =>
      `Paiement à l’usage, sans abonnement. Votre compte démarre avec ${W.fr.signupCredit} de crédit offert ; une fois votre e-mail confirmé, vous arrivez sur la page Crédits pour recharger à partir de ${W.fr.minTopup}.`,
    subtitlePromo: `Paiement à l’usage, sans abonnement. Votre compte démarre avec ${W.fr.signupCredit} de crédit offert ; une fois votre e-mail confirmé, vous arrivez sur la page Crédits.`,
    planSeal: (plan: SignupPlan) => (plan === "free" ? "Crédit offert" : "Paiement à l’usage"),
    freeLine: `1 serveur · jusqu’à ${FREE_MCP_LIMIT} MCP + TwinMCP Docs · sans abonnement`,
    email: "E-mail",
    emailPlaceholder: "vous@entreprise.fr",
    password: "Mot de passe",
    passwordPlaceholder: "8 caractères minimum",
    showPassword: "Afficher le mot de passe",
    submitFree: `Créer mon compte et recevoir ${W.fr.signupCredit}`,
    submitPaid: "Créer mon compte",
    submitting: "Création…",
    termsLead: "En créant un compte, vous acceptez nos",
    terms: "Conditions générales",
    termsHref: "/legal/terms",
    and: "et notre",
    privacy: "Politique de confidentialité",
    privacyHref: "/legal/privacy",
    haveAccount: "Vous avez déjà un compte ?",
    signIn: "Se connecter",
    checkTitle: "Vérifiez votre boîte mail",
    checkLead: "Un lien de confirmation a été envoyé à",
    checkTail: "Cliquez dessus pour activer votre compte.",
    checkTailPaid: "Cliquez dessus pour activer votre compte et ouvrir la page Crédits.",
    checkSpam: "Rien reçu ? Regardez dans vos spams ou l’onglet Promotions.",
    resendIn: (s: number) => `Renvoyer dans ${s} s`,
    resend: "Renvoyer le lien",
    startOver: "Mauvaise adresse ? Recommencer",
    existsTitle: "Vous avez déjà un compte",
    existsLead: "Un compte existe déjà pour",
    existsTail:
      "Connectez-vous pour continuer, ou réinitialisez votre mot de passe si vous l’avez oublié.",
    resetPassword: "Réinitialiser le mot de passe",
    useAnother: "Utiliser une autre adresse",
  },
} as const;

export function SignUpForm({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const searchParams = useSearchParams();
  // Never trust returnTo outside the site: it ends up in window.location.assign
  // and in links, so an absolute or javascript: URL falls back to /dashboard.
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const selectedPlan = normalizePlan(searchParams.get("plan"));
  const cadenceParam = searchParams.get("cadence");
  const selectedCadence: SignupCadence =
    cadenceParam === "yearly" || cadenceParam === "annual" ? "yearly" : "monthly";
  // Creator landing → carry the slug through the email-confirm round trip
  // so the post-signup checkout can pre-apply the discount.
  // Creator slug or Stripe promo_… id, same rule as the server (normalizePromo).
  const selectedPromo = normalizePromo(searchParams.get("promo")) ?? null;
  // Paid intent (from the pricing page): changes the reassurance copy and
  // sends the confirmed account straight to Stripe Checkout.
  const paidIntent = selectedPlan === "pro";

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [existing, setExisting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  const emailRedirectTo = () =>
    callbackUrl({
      returnTo,
      plan: selectedPlan,
      cadence: selectedCadence,
      promo: selectedPromo,
      locale,
    });

  useEffect(() => {
    track({
      name: "signup_started",
      properties: { locale, ...(selectedPlan ? { plan: selectedPlan } : {}) },
    });
    // Once per mount: the plan comes from the URL the visitor landed on.
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  // The confirmation link opened in another tab of this browser signs this tab
  // in too. That other tab already runs the post-confirm redirect (onboarding,
  // or Stripe Checkout for a Pro intent), so this one must not open a second
  // checkout: a paid intent lands on Billing, everything else on the wizard.
  useEffect(() => {
    if (!done) return;
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN") return;
      if (paidIntent) {
        window.location.assign("/dashboard/billing");
        return;
      }
      window.location.assign(
        returnTo === "/dashboard"
          ? selectedPlan === "free"
            ? "/onboarding?plan=free"
            : "/onboarding"
          : returnTo
      );
    });
    return () => data.subscription.unsubscribe();
  }, [done, returnTo, paidIntent]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // First-touch attribution (utm_*, gclid, ref, landing path) rides on the
    // Supabase user metadata; /auth/callback copies it into users.metadata.
    const attribution = readAttribution(window.location.search, {
      path: window.location.pathname,
      locale,
      referrer: document.referrer,
    });
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailRedirectTo(),
        ...(attribution ? { data: { attribution } } : {}),
      },
    });
    if (err) {
      setError(friendlyAuthError(err, locale));
      setLoading(false);
      return;
    }
    setLoading(false);
    // With email confirmation on, Supabase answers an already-registered
    // address with a user that has no identities (and sends no email) instead
    // of an error. Say so, rather than "check your email" for a mail that
    // never comes.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setExisting(true);
      return;
    }
    track({
      name: "signup_submitted",
      properties: { locale, ...(selectedPlan ? { plan: selectedPlan } : {}) },
    });
    setDone(true);
    setResendCooldown(60);
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");
    track({ name: "resend_confirmation_clicked", properties: { locale } });
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: emailRedirectTo() },
    });
    if (err) {
      setError(friendlyAuthError(err, locale));
      return;
    }
    setResendCooldown(60);
  }

  const signInHref = (withEmail: boolean) => {
    const q = new URLSearchParams();
    if (returnTo !== "/dashboard") q.set("returnTo", returnTo);
    if (withEmail && email) q.set("email", email);
    if (paidIntent) {
      q.set("plan", "pro");
      q.set("cadence", selectedCadence);
      if (selectedPromo) q.set("promo", selectedPromo);
    }
    // The French sign-up sends French visitors to the French sign-in.
    return authPath("signIn", locale, q) as Route;
  };

  if (existing) {
    return (
      <div className="flex flex-col items-center text-center">
        <AuthStatusIcon>
          <UserCheck />
        </AuthStatusIcon>
        <h1 className={`${AUTH_TITLE} mt-5`}>{t.existsTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.existsLead} <span className="font-medium text-foreground">{email}</span>.{" "}
          {t.existsTail}
        </p>
        <div className="mt-6 flex flex-col gap-2 self-stretch">
          <Button asChild size="lg">
            <Link href={signInHref(true)}>{t.signIn}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={authPath("forgotPassword", locale, { email }) as Route}>
              {t.resetPassword}
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => {
              setExisting(false);
              setEmail("");
              setPassword("");
              setError("");
            }}
            className={AUTH_QUIET_ACTION}
          >
            {t.useAnother}
          </button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <AuthStatusIcon>
          <Mail />
        </AuthStatusIcon>
        <h1 className={`${AUTH_TITLE} mt-5`}>{t.checkTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.checkLead} <span className="font-medium text-foreground">{email}</span>.{" "}
          {paidIntent ? t.checkTailPaid : t.checkTail}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">{t.checkSpam}</p>

        <div role="alert" aria-live="assertive" className="mt-4 min-h-[2.5rem] self-stretch">
          {error && <AuthError>{error}</AuthError>}
        </div>

        <div className="mt-6 flex flex-col gap-2 self-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            className="tabular-nums"
          >
            {resendCooldown > 0 ? t.resendIn(resendCooldown) : t.resend}
          </Button>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setEmail("");
              setPassword("");
              setError("");
            }}
            className={AUTH_QUIET_ACTION}
          >
            {t.startOver}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* The offer leads on phones, where the side panel is hidden (≥lg shows
          it there). Not for a paid intent, where "no card" would mislead. */}
      <div className="mb-6">
        {!paidIntent && (
          <div className="mb-4 lg:hidden">
            <OfferBadge locale={locale} />
          </div>
        )}
        <h1 className={AUTH_TITLE}>{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {paidIntent
            ? selectedPromo
              ? t.subtitlePromo
              : t.subtitlePaid(selectedCadence)
            : t.subtitleFree}
        </p>
        {selectedPlan && (
          <Badge variant={planSeals[selectedPlan]} className="mt-4">
            <Sparkles className="h-3 w-3" />
            <span>{t.planSeal(selectedPlan)}</span>
          </Badge>
        )}
        {/* The free credit's terms in one line, for phones (the panel states
            them on wide screens). */}
        {!paidIntent && (
          <p className="mt-3 text-xs text-muted-foreground tabular-nums lg:hidden">{t.freeLine}</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={!email}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t.password}</Label>
          {/* Show/hide toggle: there is no "confirm password" field, so let
              people check what they typed (mostly on phones). */}
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder={t.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              aria-describedby="password-strength"
              className="pr-11 [&::-ms-reveal]:hidden"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={t.showPassword}
              aria-pressed={showPassword}
              aria-controls="password"
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
          <div id="password-strength">
            <PasswordStrength password={password} locale={locale} />
          </div>
        </div>

        {/* The live region stays mounted so errors are announced; while empty,
            a negative margin cancels its flex gap instead of reserving blank
            space between the fields and the button. */}
        <div role="alert" aria-live="assertive" className="empty:-mt-5">
          {error && <AuthError>{error}</AuthError>}
        </div>

        <Button
          type="submit"
          size="lg"
          className="h-auto min-h-12 w-full whitespace-normal py-2 text-center"
          disabled={loading || !email || !passwordAccepted(password)}
        >
          {loading ? t.submitting : paidIntent ? t.submitPaid : t.submitFree}
          {!loading && <ArrowRight aria-hidden />}
        </Button>
      </form>

      <p className="mt-5 text-xs text-muted-foreground">
        {t.termsLead}{" "}
        <Link href={t.termsHref as Route} className={AUTH_LINK}>
          {t.terms}
        </Link>{" "}
        {t.and}{" "}
        <Link href={t.privacyHref as Route} className={AUTH_LINK}>
          {t.privacy}
        </Link>
        .
      </p>

      <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
        {t.haveAccount}{" "}
        <Link href={signInHref(true)} className={AUTH_LINK}>
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
