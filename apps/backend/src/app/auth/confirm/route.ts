import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import {
  completePostAuth,
  DEFAULT_RETURN_TO,
  postAuthRedirect,
  proIntentQuery,
  readFreeIntent,
  readProIntent,
  safeReturnTo,
} from "@/lib/auth/post-auth";
import { authFailurePath, authLocaleParam, authPath } from "@/lib/i18n/auth-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email links verified by token hash: works on ANY device or browser, unlike
// the PKCE code of /auth/callback, whose verifier only exists in the browser
// that started the sign-up. The Supabase "Confirm signup" template points here:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&returnTo=/dashboard
// (TODO.md has the exact template). Same redirect rules as /auth/callback.

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  // `next` is the name Supabase's own templates use; `returnTo` is ours.
  const requested = safeReturnTo(url.searchParams.get("returnTo") ?? url.searchParams.get("next"));
  const localeParam = url.searchParams.get("locale");
  // A recovery link with no explicit destination lands on the reset form, in
  // the language of the form that asked for it (locale=fr → the French reset
  // page, app/(auth-fr)/fr/nouveau-mot-de-passe; otherwise the English one).
  const returnTo =
    type === "recovery" && requested === DEFAULT_RETURN_TO
      ? authPath("resetPassword", authLocaleParam(localeParam))
      : requested;
  const intent = readProIntent(url.searchParams);
  const locale = localeParam === "fr" || localeParam === "en" ? localeParam : undefined;

  // A French auth form (locale=fr) gets the French sign-in screen back.
  const failTo = (errorCode: string) =>
    NextResponse.redirect(
      new URL(
        authFailurePath({
          errorCode,
          locale: authLocaleParam(localeParam),
          returnTo: returnTo !== DEFAULT_RETURN_TO && type !== "recovery" ? returnTo : null,
          intentQuery: intent ? proIntentQuery(intent) : "",
        }),
        url.origin
      ),
      303
    );

  if (!tokenHash || !isOtpType(type)) return failTo("auth_failed");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  const user = data?.user ?? data?.session?.user ?? null;
  if (error || !user) return failTo(error?.code ?? "otp_expired");

  const state = await completePostAuth({ user, locale, request: req });
  const destination = postAuthRedirect({
    returnTo,
    intent,
    state,
    freeIntent: readFreeIntent(url.searchParams),
  });
  return NextResponse.redirect(new URL(destination, url.origin), 303);
}
