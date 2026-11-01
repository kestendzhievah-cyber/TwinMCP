"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useEffect, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/auth/password-strength";
import { AUTH_LINK, AUTH_TITLE, AuthError, AuthStatusIcon } from "@/components/auth/auth-ui";
import { createClient } from "@/utils/supabase/client";
import { friendlyAuthError } from "@/lib/auth/errors";
// The sign-up rule (8+ characters and two of mixed case, a number, a symbol):
// a reset can never set a password the sign-up form would refuse.
import { passwordAccepted } from "@/lib/auth/password-rule";
import { authPath } from "@/lib/i18n/auth-paths";
import type { Locale } from "@/lib/i18n/locales";

// Every visible string, per locale ("vous" in French, like the other French
// auth screens). The dashboard it redirects to is English for everyone.
const COPY = {
  en: {
    doneTitle: "Password updated",
    doneLead: "Redirecting to your dashboard…",
    checking: "Checking your reset link…",
    invalidTitle: "Link invalid or expired",
    invalidLead: "This password reset link is no longer valid. Request a new one to continue.",
    requestNew: "Request a new link",
    title: "New password",
    subtitle:
      "At least 8 characters, with two of: upper- and lowercase letters, a number, a symbol.",
    password: "New password",
    confirm: "Confirm password",
    mismatch: "Passwords don’t match.",
    updating: "Updating…",
    update: "Update password",
    remembered: "Remembered it after all?",
    signIn: "Sign in",
  },
  fr: {
    doneTitle: "Mot de passe modifié",
    doneLead: "Redirection vers votre tableau de bord…",
    checking: "Vérification de votre lien…",
    invalidTitle: "Lien invalide ou expiré",
    invalidLead:
      "Ce lien de réinitialisation n’est plus valide. Demandez-en un nouveau pour continuer.",
    requestNew: "Demander un nouveau lien",
    title: "Nouveau mot de passe",
    subtitle:
      "Au moins 8 caractères, avec deux éléments parmi : majuscules et minuscules, un chiffre, un symbole.",
    password: "Nouveau mot de passe",
    confirm: "Confirmez le mot de passe",
    mismatch: "Les mots de passe ne correspondent pas.",
    updating: "Mise à jour…",
    update: "Modifier le mot de passe",
    remembered: "Finalement, il vous est revenu ?",
    signIn: "Se connecter",
  },
} as const;

export function ResetPasswordForm({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
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
  const canSubmit = passwordAccepted(password) && confirm === password;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError(friendlyAuthError(err, locale));
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
        <AuthStatusIcon tone="success">
          <CheckCircle2 />
        </AuthStatusIcon>
        <h1 className={`${AUTH_TITLE} mt-5`}>{t.doneTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.doneLead}</p>
      </div>
    );
  }

  if (checking) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm text-muted-foreground">{t.checking}</p>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col items-center text-center">
        <AuthStatusIcon tone="destructive">
          <AlertCircle />
        </AuthStatusIcon>
        <h1 className={`${AUTH_TITLE} mt-5`}>{t.invalidTitle}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t.invalidLead}</p>
        <div className="mt-8 flex flex-col gap-2 self-stretch">
          <Button asChild size="lg">
            <Link href={authPath("forgotPassword", locale) as Route}>{t.requestNew}</Link>
          </Button>
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
          <Label htmlFor="password">{t.password}</Label>
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
            <PasswordStrength password={password} locale={locale} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm">{t.confirm}</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            aria-invalid={mismatch}
            aria-describedby={mismatch ? "confirm-error" : undefined}
          />
          {mismatch && (
            <p id="confirm-error" className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle aria-hidden className="h-3.5 w-3.5 shrink-0" />
              {t.mismatch}
            </p>
          )}
        </div>

        <div role="alert" aria-live="assertive" className="min-h-[2.5rem]">
          {error && <AuthError>{error}</AuthError>}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading || !canSubmit}>
          {loading ? t.updating : t.update}
        </Button>
      </form>

      <p className="mt-6 border-t border-border pt-5 text-center text-sm text-muted-foreground">
        {t.remembered}{" "}
        <Link href={authPath("signIn", locale) as Route} className={AUTH_LINK}>
          {t.signIn}
        </Link>
      </p>
    </div>
  );
}
