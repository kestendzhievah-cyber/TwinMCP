import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { AlertTriangle, Check, Minus } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { AUTH_LINK, AUTH_TITLE, AuthError } from "@/components/auth/auth-ui";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { createClient } from "@/utils/supabase/server";
import {
  CONSENT_CSRF_COOKIE,
  authorizeQuery,
  buildRedirect,
  isOAuthEnabled,
  oauthIssuer,
  readAuthorizeParams,
  redirectTargetLabel,
  resolveAuthorize,
} from "@/lib/oauth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authorize a connector · TwinMCP",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// OAuth consent (contract D4). Reached only through GET /oauth/authorize, which
// validated the request and set the CSRF cookie. The form posts back to
// /oauth/authorize, which re-validates everything. The client name is
// self-declared at registration: it is shown as the app's claim, never as a
// verified identity, next to where the browser will be sent.
export default async function ConsentPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isOAuthEnabled()) notFound();
  const sp = await searchParams;
  const p = readAuthorizeParams((n) => {
    const v = sp[n];
    return typeof v === "string" ? v : null;
  });
  const r = await resolveAuthorize(p);

  if (r.kind !== "ok") {
    return (
      <AuthShell locale="en">
        <div className="space-y-4">
          <h1 className={AUTH_TITLE}>Authorization failed</h1>
          <AuthError>{r.description}.</AuthError>
          <p className="text-sm text-muted-foreground">
            Start the connection again from the app you were using. If it keeps failing, remove the
            connector there and add it again.
          </p>
          {r.kind === "redirect_error" && (
            // Never an automatic redirect (open-redirect proof): the user sees
            // where the link goes and chooses to follow it.
            <p className="text-sm">
              <a
                className={AUTH_LINK}
                rel="noreferrer"
                href={buildRedirect(r.redirectUri, {
                  error: r.error,
                  error_description: r.description,
                  state: p.state,
                  iss: oauthIssuer(),
                })}
              >
                Return to {redirectTargetLabel(r.redirectUri)}
              </a>
            </p>
          )}
        </div>
      </AuthShell>
    );
  }

  const query = authorizeQuery(r.params);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/sign-in?returnTo=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const csrf = (await cookies()).get(CONSENT_CSRF_COOKIE)?.value;
  if (!csrf) {
    return (
      <AuthShell locale="en">
        <div className="space-y-4">
          <h1 className={AUTH_TITLE}>Request expired</h1>
          <p className="text-sm text-muted-foreground">
            This authorization request is no longer active in this browser.
          </p>
          {/* A full navigation, not <Link>: /oauth/authorize is a route handler
              that sets the CSRF cookie and redirects back here. */}
          <Button asChild size="lg" className="w-full">
            <a href={`/oauth/authorize?${query}`}>Continue</a>
          </Button>
        </div>
      </AuthShell>
    );
  }

  const owned = await getDb()
    .select({ id: servers.id, name: servers.name, slug: servers.slug })
    .from(servers)
    .where(and(eq(servers.userId, user.id), ne(servers.status, "destroyed")))
    .orderBy(asc(servers.createdAt))
    .limit(100);

  // Least privilege by default: the server named in the connector URL, else
  // the first server; "All my servers" is an explicit choice.
  const fromResource = r.serverSlug ? owned.find((s) => s.slug === r.serverSlug) : undefined;
  const preselected = fromResource?.id ?? owned[0]?.id ?? "all";
  const target = redirectTargetLabel(r.redirectUri);
  const nativeApp = !r.redirectUri.startsWith("https://");

  return (
    <AuthShell locale="en">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="eyebrow">Authorize a connector</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            <span className="break-words">{r.client.clientName}</span> wants to use your TwinMCP
            servers
          </h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user.email ?? "your account"}.
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              List and call the tools of the MCPs on the server you choose. Tool calls are paid from
              your TwinMCP balance, like any other call.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Minus aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <span>No access to server management, API keys, billing or your account.</span>
          </li>
        </ul>

        <form method="post" action="/oauth/authorize" className="space-y-6">
          {Object.entries({
            client_id: r.params.clientId,
            redirect_uri: r.redirectUri,
            response_type: r.params.responseType,
            code_challenge: r.params.codeChallenge,
            code_challenge_method: r.params.codeChallengeMethod,
            state: r.params.state,
            scope: r.params.scope,
            resource: r.params.resource,
            csrf,
          }).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Access</legend>
            {owned.map((s) => (
              <label
                key={s.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-input has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:ring-1 has-[:checked]:ring-brand"
              >
                <input
                  type="radio"
                  name="server"
                  value={s.id}
                  defaultChecked={s.id === preselected}
                  className="h-4 w-4 accent-brand"
                />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{s.slug}</span>
              </label>
            ))}
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:border-input has-[:checked]:border-brand has-[:checked]:bg-brand/5 has-[:checked]:ring-1 has-[:checked]:ring-brand">
              <input
                type="radio"
                name="server"
                value="all"
                defaultChecked={preselected === "all"}
                className="h-4 w-4 accent-brand"
              />
              <span className="font-medium">All my servers</span>
              <span className="ml-auto text-xs text-muted-foreground">including future ones</span>
            </label>
            {owned.length === 0 && (
              <p className="text-xs text-muted-foreground">
                You have no server yet. Create one in the dashboard after connecting.
              </p>
            )}
          </fieldset>

          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 space-y-2">
              <p>
                Only approve if you started this from {r.client.clientName}. The name is supplied by
                the app and is not verified by TwinMCP.
              </p>
              <p>
                After approval you will be sent to{" "}
                <span className="break-all font-mono text-xs">{target}</span>
                {nativeApp ? " (an app on your computer)." : "."}
              </p>
            </div>
          </div>

          {/* Deny comes first in the DOM, so pressing Enter never grants access. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" name="decision" value="deny" variant="outline">
              Deny
            </Button>
            <Button type="submit" name="decision" value="allow">
              Allow access
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Access lasts while the app keeps using it and ends after 30 days without use. Revoke it
            any time in{" "}
            <Link href={"/dashboard/settings/connectors" as Route} className={AUTH_LINK}>
              Settings, Connectors
            </Link>
            .
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
