// External links the site may show: the status page and the social profiles.
//
// None of them is hard-coded. On 2026-10-29 status.twinmcp.fr did not resolve
// and x.com/twinmcp answered 404, so every one is opt-in through a public env
// var and is rendered (footer, onboarding layout, auth shell, Organization
// JSON-LD sameAs) only when set:
//
//   NEXT_PUBLIC_STATUS_URL    e.g. https://status.twinmcp.fr
//   NEXT_PUBLIC_TWITTER_URL   e.g. https://x.com/<handle>
//   NEXT_PUBLIC_GITHUB_URL    e.g. https://github.com/<org>/<repo> (public repos only)
//   NEXT_PUBLIC_LINKEDIN_URL  e.g. https://www.linkedin.com/company/<slug>
//
// NEXT_PUBLIC_* values are inlined at build time, so set them as build args
// (Dockerfile / Dokploy) as well as at runtime. Each process.env access below
// is a literal property read so Next.js can inline it in client bundles too.
//
// Pure helpers are unit-tested in src/__tests__/site-links.test.ts.

/** An absolute http(s) URL, trimmed, or null for anything else (unset, blank, malformed). */
export function parseExternalUrl(raw: string | null | undefined): string | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return value;
  } catch {
    return null;
  }
}

/** The host of a URL for display ("status.twinmcp.fr"), or the URL itself if it cannot be parsed. */
export function displayHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export interface SocialLinks {
  twitter: string | null;
  github: string | null;
  linkedin: string | null;
}

export interface SiteLinkEnv {
  NEXT_PUBLIC_STATUS_URL?: string;
  NEXT_PUBLIC_TWITTER_URL?: string;
  NEXT_PUBLIC_GITHUB_URL?: string;
  NEXT_PUBLIC_LINKEDIN_URL?: string;
}

/** Resolve the status page and social profiles from an env-like record. */
export function resolveSiteLinks(env: SiteLinkEnv): {
  status: string | null;
  social: SocialLinks;
} {
  return {
    status: parseExternalUrl(env.NEXT_PUBLIC_STATUS_URL),
    social: {
      twitter: parseExternalUrl(env.NEXT_PUBLIC_TWITTER_URL),
      github: parseExternalUrl(env.NEXT_PUBLIC_GITHUB_URL),
      linkedin: parseExternalUrl(env.NEXT_PUBLIC_LINKEDIN_URL),
    },
  };
}

/** The set social profiles, in a stable order: the Organization schema's sameAs. */
export function sameAsList(social: SocialLinks): string[] {
  return [social.twitter, social.github, social.linkedin].filter((u): u is string => u !== null);
}

const RESOLVED = resolveSiteLinks({
  NEXT_PUBLIC_STATUS_URL: process.env.NEXT_PUBLIC_STATUS_URL,
  NEXT_PUBLIC_TWITTER_URL: process.env.NEXT_PUBLIC_TWITTER_URL,
  NEXT_PUBLIC_GITHUB_URL: process.env.NEXT_PUBLIC_GITHUB_URL,
  NEXT_PUBLIC_LINKEDIN_URL: process.env.NEXT_PUBLIC_LINKEDIN_URL,
});

/** The public status page, or null when NEXT_PUBLIC_STATUS_URL is unset. */
export const STATUS_URL: string | null = RESOLVED.status;

/** Social profiles; each is null when its env var is unset. */
export const SOCIAL_LINKS: SocialLinks = RESOLVED.social;
