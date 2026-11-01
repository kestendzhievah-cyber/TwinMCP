// Which OAuth providers are switched on in the Supabase project.
//
// The "Continue with Google" button only renders once the owner has enabled
// the Google provider in Supabase (Authentication → Providers), so visitors
// never click a button that ends on a Supabase "provider is not enabled"
// error page. Read from the public GoTrue settings endpoint, cached for five
// minutes; any failure (network, missing env, unexpected shape) means "off".
// Server-only (fetch with Next's revalidate cache).

export interface OAuthProviders {
  google: boolean;
}

const OFF: OAuthProviders = { google: false };

/** Pure: the providers the GoTrue /auth/v1/settings payload reports as enabled. */
export function parseProviderSettings(payload: unknown): OAuthProviders {
  if (!payload || typeof payload !== "object") return OFF;
  const external = (payload as { external?: unknown }).external;
  if (!external || typeof external !== "object") return OFF;
  return { google: (external as Record<string, unknown>).google === true };
}

export async function getOAuthProviders(): Promise<OAuthProviders> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return OFF;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return OFF;
    return parseProviderSettings(await res.json());
  } catch {
    return OFF;
  }
}
