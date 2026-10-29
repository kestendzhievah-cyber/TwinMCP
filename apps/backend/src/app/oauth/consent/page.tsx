import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { AlertCircle, Check, Minus } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
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
          <h1 className="smallcaps tracking-sc text-2xl font-medium">Authorization failed</h1>
          <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{r.description}.</span>
          </p>
          <p className="text-sm italic text-muted-foreground">
            Start the connection again from the app you were using. If it keeps failing, remove the
            connector there and add it again.
          </p>
          {r.kind === "redirect_error" && (
            // Never an automatic redirect (open-redirect proof): the user sees
            // where the link goes and chooses to follow it.
            <p className="text-sm">
              <a
                className="underline underline-offset-4"
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
          <h1 className="smallcaps tracking-sc text-2xl font-medium">Request expired</h1>
          <p className="text-sm italic text-muted-foreground">
            This authorization request is no longer active in this browser.
          </p>
          {/* A full navigation, not <Link>: /oauth/authorize is a route handler
              that sets the CSRF cookie and redirects back here. */}
          <Button asChild>
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
          <h1 className="text-2xl font-medium">
            <span className="break-words">{r.client.clientName}</span> wants to use your TwinMCP
            servers
          </h1>
          <p className="text-sm italic text-muted-foreground">
            Signed in as {user.email ?? "your account"}.
          </p>
        </div>

        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>
              List and call the tools of the MCPs on the server you choose. Tool calls count against
              your plan&apos;s daily quota.
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
            <legend className="smallcaps tracking-sc mb-2 text-sm font-medium">Access</legend>
            {owned.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 text-sm hover:border-foreground/60"
              >
                <input
                  type="radio"
                  name="server"
                  value={s.id}
                  defaultChecked={s.id === preselected}
                  className="accent-foreground"
                />
                <span className="font-medium">{s.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{s.slug}</span>
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-3 border border-border bg-card px-3 py-2 text-sm hover:border-foreground/60">
              <input
                type="radio"
                name="server"
                value="all"
                defaultChecked={preselected === "all"}
                className="accent-foreground"
              />
              <span className="font-medium">All my servers</span>
              <span className="ml-auto text-xs italic text-muted-foreground">
                including future ones
              </span>
            </label>
            {owned.length === 0 && (
              <p className="text-xs italic text-muted-foreground">
                You have no server yet. Create one in the dashboard after connecting.
              </p>
            )}
          </fieldset>

          <div className="space-y-2 border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
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

          {/* Deny comes first in the DOM, so pressing Enter never grants access. */}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="submit" name="decision" value="deny" variant="outline">
              Deny
            </Button>
            <Button type="submit" name="decision" value="allow">
              Allow access
            </Button>
          </div>

          <p className="text-xs italic text-muted-foreground">
            Access lasts while the app keeps using it and ends after 30 days without use. Revoke it
            any time in{" "}
            <Link
              href={"/dashboard/settings/connectors" as Route}
              className="text-brand underline underline-offset-4"
            >
              Settings, Connectors
            </Link>
            .
          </p>
        </form>
      </div>
    </AuthShell>
  );
}
