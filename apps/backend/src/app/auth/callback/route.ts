import { type NextRequest, NextResponse } from "next/server";
import { readAttribution } from "@/lib/analytics/attribution";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import {
  completePostAuth,
  postAuthRedirect,
  proIntentQuery,
  readFreeIntent,
  readProIntent,
  safeReturnTo,
} from "@/lib/auth/post-auth";
import { authFailurePath, authLocaleParam } from "@/lib/i18n/auth-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTP_TYPES = new Set<string>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

// PKCE code exchange: OAuth, magic links, password-reset links and email
// confirmations opened in the SAME browser as the sign-up (the code verifier
// lives in that browser's cookies). A confirmation opened elsewhere goes
// through /auth/confirm (token_hash) instead.
//
// The paid intent travels in the URL (plan=pro&cadence=…&promo=…), set by the
// sign-up / sign-in forms on emailRedirectTo, so it survives the email round
// trip on any device. plan=free rides the same way and lands on
// /onboarding?plan=free, past the wizard's Plan step.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));
  const intent = readProIntent(url.searchParams);
  const localeParam = url.searchParams.get("locale");
  const locale = localeParam === "fr" || localeParam === "en" ? localeParam : undefined;

  // Supabase reports OAuth denials and expired / already-used links via `error`.
  // Never redirect a failed auth onto a protected or action page (e.g. the reset
  // form) with no session: send the user to sign-in with a friendly error, and
  // keep the paid intent so signing in from there still reaches checkout.
  // A French auth form (locale=fr) gets the French sign-in screen back.
  const failTo = (errorCode: string) =>
    NextResponse.redirect(
      new URL(
        authFailurePath({
          errorCode,
          locale: authLocaleParam(localeParam),
          returnTo: returnTo !== "/dashboard" ? returnTo : null,
          intentQuery: intent ? proIntentQuery(intent) : "",
        }),
        url.origin
      ),
      303
    );

  const errorParam = url.searchParams.get("error_code") ?? url.searchParams.get("error");
  if (errorParam) return failTo(errorParam);

  // A template link built as `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email`
  // lands here with a token hash instead of a code: verify it like
  // /auth/confirm does, so the cross-device confirmation keeps the Pro intent
  // carried by emailRedirectTo.
  const tokenHash = url.searchParams.get("token_hash");
  const otpType = url.searchParams.get("type");
  if (!code && !(tokenHash && otpType && OTP_TYPES.has(otpType))) return failTo("auth_failed");

  const supabase = await createClient();
  let user: User | null = null;
  let errorCode: string | undefined;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    user = data?.user ?? null;
    errorCode = error?.code;
    if (error && !errorCode) errorCode = "auth_failed";
  } else {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType as EmailOtpType,
      token_hash: tokenHash!,
    });
    user = data?.user ?? data?.session?.user ?? null;
    errorCode = error ? (error.code ?? "otp_expired") : undefined;
  }
  if (errorCode || !user) return failTo(errorCode ?? "auth_failed");

  // An OAuth sign-up carries its first-touch attribution in this URL (the
  // Google button appends it): there is no form metadata to hold it.
  const urlAttribution = readAttribution(url.search, { locale });
  const state = await completePostAuth({
    user,
    locale,
    request: req,
    ...(urlAttribution ? { attribution: urlAttribution } : {}),
  });
  const destination = postAuthRedirect({
    returnTo,
    intent,
    state,
    freeIntent: readFreeIntent(url.searchParams),
  });
  return NextResponse.redirect(new URL(destination, url.origin), 303);
}
