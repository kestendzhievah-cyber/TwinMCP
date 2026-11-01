"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AUTH_LINK,
  AUTH_QUIET_ACTION,
  AUTH_TITLE,
  AuthError,
  AuthStatusIcon,
} from "@/components/auth/auth-ui";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { createClient } from "@/utils/supabase/client";
import { track } from "@/lib/analytics/funnel";
import { friendlyAuthError } from "@/lib/auth/errors";
import { readProIntent, safeReturnTo } from "@/lib/auth/return-to";
import { authPath } from "@/lib/i18n/auth-paths";
import type { Locale } from "@/lib/i18n/locales";

type Mode = "password" | "magic-link";

const RESEND_COOLDOWN_S = 60;

// The sign-up credit, for the "new here?" link (lib/wallet/pricing.ts).
const W = { en: walletFacts("en"), fr: walletFacts("fr") };

// Every visible string, per locale. French uses "vous", like the French sign-up
// and landing pages. The Supabase calls, redirects and analytics are shared;
// after sign-in the dashboard is English for everyone (by design).
const COPY = {
  en: {
    checkTitle: "Check your inbox",
    checkLead: "A sign-in link has been sent to",
    sending: "Sending…",
    resendLink: "Resend link",
    otherMethod: "Use a different method",
    title: "Sign in to TwinMCP",
    subtitle: "Choose the method that works for you.",
    email: "Email",
    emailPlaceholder: "you@company.com",
    password: "Password",
    forgot: "Forgot?",
    resendIn: (s: number) => `Resend in ${s}s`,
    resendConfirmation: "Resend confirmation email",
    confirmationSent: (email: string) => `A new confirmation link is on its way to ${email}.`,
    spamHint:
      "Nothing in your inbox? Check your spam or promotions folder, then open the most recent link.",
    signingIn: "Signing in…",
    signIn: "Sign in",
    sendMagicLink: "Send me a magic link",
    useMagicLink: "Use a magic link instead",
    usePassword: "Use a password instead",
    noAccount: "New here?",
    createAccount: `Get ${W.en.signupCredit} free`,
  },
  fr: {
    checkTitle: "Vérifiez votre boîte mail",
    checkLead: "Un lien de connexion a été envoyé à",
    sending: "Envoi…",
    resendLink: "Renvoyer le lien",
    otherMethod: "Utiliser une autre méthode",
    title: "Connexion à TwinMCP",
    subtitle: "Choisissez la méthode qui vous convient.",
    email: "E-mail",
    emailPlaceholder: "vous@entreprise.fr",
    password: "Mot de passe",
    forgot: "Oublié ?",
    resendIn: (s: number) => `Renvoyer dans ${s} s`,
    resendConfirmation: "Renvoyer l’e-mail de confirmation",
    confirmationSent: (email: string) =>
      `Un nouveau lien de confirmation est en route vers ${email}.`,
    spamHint:
      "Rien reçu ? Regardez dans vos spams ou l’onglet Promotions, puis ouvrez le lien le plus récent.",
    signingIn: "Connexion…",
    signIn: "Se connecter",
    sendMagicLink: "Recevoir un lien de connexion",
    useMagicLink: "Recevoir plutôt un lien par e-mail",
    usePassword: "Utiliser plutôt un mot de passe",
    noAccount: "Nouveau ?",
    createAccount: `${W.fr.signupCredit} offerts`,
  },
} as const;

export function SignInForm({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const router = useRouter();
  const searchParams = useSearchParams();
  // Never trust returnTo outside the site (router.push, links, emailRedirectTo).
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  // A Pro intent (pricing page to sign-in, or an auth link that failed) is kept
  // through every path: email links carry it to /auth/callback, a password
  // sign-in lands on Billing, which opens the checkout.
  const proIntent = readProIntent(searchParams);
  const intentQuery = proIntent
    ? `plan=pro&cadence=${proIntent.cadence}${proIntent.promo ? `&promo=${encodeURIComponent(proIntent.promo)}` : ""}`
    : "";
  // locale=fr: a link that fails comes back to the French sign-in, and the
  // first session records the language (lib/auth/post-auth.ts).
  const callbackUrl = () =>
    `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(returnTo)}${intentQuery ? `&${intentQuery}` : ""}${locale !== "en" ? `&locale=${locale}` : ""}`;

  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  // Surface an auth error the callback bounced us here with (OAuth denied,
  // expired reset/magic link, failed exchange).
  const [error, setError] = useState(() => {
    const code = searchParams.get("error");
    return code ? friendlyAuthError({ message: "", code }, locale) : "";
  });
  // The Supabase error code behind `error`: email_not_confirmed offers a
  // resend of the confirmation email right here.
  const [errorCode, setErrorCode] = useState<string | null>(() => searchParams.get("error"));
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);

  // An auth link that bounced here (expired, already used, denied OAuth).
  const callbackFailureTracked = useRef(false);
  useEffect(() => {
    const code = searchParams.get("error");
    if (!code || callbackFailureTracked.current) return;
    callbackFailureTracked.current = true;
    track({ name: "auth_callback_failed", properties: { code } });
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  async function handleResendConfirmation() {
    if (resendCooldown > 0 || resending || !email) return;
    setResending(true);
    track({ name: "resend_confirmation_clicked", properties: { locale } });
    const supabase = createClient();
    const { error: err } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: callbackUrl() },
    });
    setResending(false);
    if (err) {
      setError(friendlyAuthError(err, locale));
      setErrorCode(err.code ?? null);
      setResendSent(false);
      return;
    }
    setResendSent(true);
    setResendCooldown(RESEND_COOLDOWN_S);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setErrorCode(null);
    setResendSent(false);
    setLoading(true);

    const supabase = createClient();

    if (mode === "password") {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(friendlyAuthError(err, locale));
        setErrorCode(
          err.code ?? (/email not confirmed/i.test(err.message) ? "email_not_confirmed" : null)
        );
        setLoading(false);
        return;
      }
      // A password sign-in never goes through /auth/callback, which is where
      // unfinished accounts are sent to the wizard. Route the default landing
      // through /onboarding instead: it redirects straight to /dashboard once
      // onboarding is complete, so finished accounts only pay one redirect.
      // A Pro intent goes to Billing, which opens the checkout for a Free account.
      const destination = proIntent
        ? `/dashboard/billing?${intentQuery}`
        : returnTo === "/dashboard"
          ? "/onboarding"
          : returnTo;
      // /oauth/authorize is a route handler (sets a CSRF cookie, redirects to
      // the consent page): it needs a full page load, not a client navigation.
      if (destination.startsWith("/oauth/")) {
        window.location.assign(destination);
        return;
      }
      router.push(destination as Route);
      router.refresh();
      return;
    }

    // Magic link — let Supabase create a user if needed so the message
    // "no account exists" doesn't trip up first-time visitors who happened
    // to click "magic link" instead of "create account".
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
        shouldCreateUser: true,
      },
    });
    if (err) {
      setError(friendlyAuthError(err, locale));
      setErrorCode(err.code ?? null);
      setLoading(false);
      return;
    }
    setMagicLinkSent(true);
    setLoading(false);
  }

  async function handleResendMagicLink() {
    if (loading) return;
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callbackUrl(),
        shouldCreateUser: true,
      },
    });
    if (err) setError(friendlyAuthError(err, locale));
    setLoading(false);
  }

  if (magicLinkSent) {
    return (
      <div className="flex flex-col items-center text-center">
        <AuthStatusIcon>
          <Mail />
        </AuthStatusIcon>
        <h1 className={`${AUTH_TITLE} mt-5`}>{t.checkTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.checkLead} <span className="font-medium text-foreground">{email}</span>.
        </p>

        <div role="status" aria-live="polite" className="mt-4 min-h-[2.5rem] self-stretch">
          {error && <AuthError>{error}</AuthError>}
        </div>

        <div className="mt-6 flex flex-col gap-2 self-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={handleResendMagicLink}
            disabled={loading}
          >
            {loading ? t.sending : t.resendLink}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMagicLinkSent(false);
              setMode("password");
              setError("");
            }}
            className={AUTH_QUIET_ACTION}
          >
            {t.otherMethod}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className={AUTH_TITLE}>{t.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.subtitle}</p>
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

        {mode === "password" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">{t.password}</Label>
              <Link
                href={authPath("forgotPassword", locale, { email }) as Route}
                className="-my-2.5 inline-flex min-h-10 items-center text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                {t.forgot}
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
              autoFocus={Boolean(email) && !password}
            />
          </div>
        )}

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && <AuthError>{error}</AuthError>}
          {errorCode === "email_not_confirmed" && (
            // Unconfirmed account: resend the confirmation email from here
            // instead of leaving the user stuck on an error.
            <div className="mt-3 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendConfirmation}
                disabled={resending || resendCooldown > 0 || !email}
                className="tabular-nums"
              >
                {resending
                  ? t.sending
                  : resendCooldown > 0
                    ? t.resendIn(resendCooldown)
                    : t.resendConfirmation}
              </Button>
              {resendSent && (
                <p className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  {t.confirmationSent(email)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t.spamHint}</p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading || !email || (mode === "password" && !password)}
        >
          {loading ? t.signingIn : mode === "password" ? t.signIn : t.sendMagicLink}
        </Button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "password" ? "magic-link" : "password"));
            setError("");
          }}
          className={AUTH_QUIET_ACTION}
        >
          {mode === "password" ? t.useMagicLink : t.usePassword}
        </button>
      </form>

      <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
        {t.noAccount}{" "}
        <Link
          href={
            authPath("signUp", locale, {
              returnTo,
              email,
              ...Object.fromEntries(new URLSearchParams(intentQuery)),
            }) as Route
          }
          className={AUTH_LINK}
        >
          {t.createAccount}
        </Link>
      </p>
    </div>
  );
}
