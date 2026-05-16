"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
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
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Mot de passe mis à jour</h1>
        <p className="mt-2 text-sm text-muted-foreground">Redirection vers ton dashboard…</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau mot de passe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisis-en un solide — au moins 8 caractères, idéalement avec chiffres et majuscules.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Nouveau mot de passe</Label>
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
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
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
          {mismatch && (
            <p className="text-xs text-destructive">Les mots de passe ne correspondent pas.</p>
          )}
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
          {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Tu te souviens finalement ?{" "}
        <Link href={"/sign-in" as Route} className="font-medium text-foreground hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
