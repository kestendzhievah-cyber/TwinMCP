import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Routes that require an authenticated session. Anything else is public.
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];

// Routes an authenticated user should not see (sign-in, sign-up, etc.) —
// they bounce straight to the dashboard.
export const GUEST_ONLY_PREFIXES = ["/sign-in", "/sign-up", "/fr/inscription", "/fr/connexion"];

export function startsWithAny(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export const updateSession = async (request: NextRequest) => {
  let supabaseResponse = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Required: revalidates the JWT and refreshes it via Set-Cookie when needed.
  // Without this call the session silently expires after ~1h and users get
  // logged out mid-flow.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && startsWithAny(pathname, PROTECTED_PREFIXES)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?returnTo=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (user && startsWithAny(pathname, GUEST_ONLY_PREFIXES)) {
    const url = request.nextUrl.clone();
    const params = request.nextUrl.searchParams;
    const plan = params.get("plan");
    if (plan === "pro" || plan === "team") {
      // A signed-in visitor clicking "Start Pro" on the pricing page lands on
      // sign-up: keep the paid intent and let Billing open the checkout
      // (dashboard/billing/actions.tsx auto-starts it for a Free account).
      const cadenceParam = params.get("cadence");
      const promo = params.get("promo");
      const next = new URLSearchParams({
        plan: "pro",
        cadence: cadenceParam === "yearly" || cadenceParam === "annual" ? "yearly" : "monthly",
      });
      if (promo && /^(promo_[A-Za-z0-9]{1,64}|[a-z0-9-]{1,64})$/.test(promo)) {
        next.set("promo", promo);
      }
      url.pathname = "/dashboard/billing";
      url.search = `?${next.toString()}`;
      return NextResponse.redirect(url);
    }
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
};
