"use client";

import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";
import { authPath } from "@/lib/i18n/auth-paths";
import type { Locale } from "@/lib/i18n/locales";

// Every visible string, per locale ("vous" in French, like the other French
// auth screens).
const COPY = {
  en: {
    checkTitle: "Check your email",
    checkLead: "If an account exists for",
    checkTail: "a reset link has just been sent.",
    checkSpam: "Nothing yet? Check your spam or promotions folder.",
    back: "Back to sign in",
    title: "Forgot your password?",
    subtitle: "Enter your email and we’ll send you a link to choose a new one.",
    email: "Email",
    emailPlaceholder: "you@company.com",
    sending: "Sending…",
    send: "Send link",
  },
  fr: {
    checkTitle: "Vérifiez votre boîte mail",
    checkLead: "Si un compte existe pour",
    checkTail: "un lien de réinitialisation vient de vous être envoyé.",
    checkSpam: "Rien reçu ? Regardez dans vos spams ou l’onglet Promotions.",
    back: "Retour à la connexion",
    title: "Mot de passe oublié ?",
    subtitle:
      "Indiquez votre adresse e-mail : nous vous enverrons un lien pour en choisir un nouveau.",
    email: "E-mail",
    emailPlaceholder: "vous@entreprise.fr",
    sending: "Envoi…",
    send: "Envoyer le lien",
  },
} as const;

export function ForgotPasswordForm({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  const searchParams = useSearchParams();
  // Pre-filled from the sign-in and sign-up screens (?email=), so the visitor
  // who just typed their address does not type it again.
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const signInHref = authPath("signIn", locale, { email }) as Route;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // The reset link lands on the reset form of the visitor's language; with
    // locale=fr, a link that fails comes back to the French sign-in.
    const q = new URLSearchParams({ returnTo: authPath("resetPassword", locale) });
    if (locale !== "en") q.set("locale", locale);
    const supabase = createClient();
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?${q.toString()}`,
    });
    if (err) {
      setError(friendlyAuthError(err, locale));
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
        <h1 className="smallcaps tracking-sc mt-6 text-2xl font-medium">{t.checkTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t.checkLead} <span className="font-medium text-foreground">{email}</span>, {t.checkTail}
        </p>
        <p className="mt-2 text-xs italic text-muted-foreground">{t.checkSpam}</p>
        <div className="mt-8 flex flex-col gap-2 self-stretch">
          <Button asChild variant="outline">
            <Link href={signInHref}>
              <ArrowLeft />
              {t.back}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link
        href={signInHref}
        className="smallcaps tracking-sc mb-4 inline-flex min-h-10 items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t.back}
      </Link>

      <div className="mb-8">
        <h1 className="smallcaps tracking-sc text-2xl font-medium">{t.title}</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">{t.subtitle}</p>
        <Separator variant="double" className="mt-4" />
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
          {loading ? t.sending : t.send}
        </Button>
      </form>
    </div>
  );
}
