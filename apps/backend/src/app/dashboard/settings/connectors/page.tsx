import type { Metadata } from "next";
import { and, asc, eq, ne } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { servers } from "@/db/schema/platform";
import { isOAuthEnabled, listConnections, oauthIssuer, type OAuthConnection } from "@/lib/oauth";
import { ConnectorsPanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Connectors · TwinMCP" };

// Settings → Connectors: the apps authorized through OAuth (Claude, ChatGPT
// custom connectors, Cursor, VS Code…) with Revoke, and how to add one.
export default async function ConnectorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [connections, owned] = await Promise.all([
    listConnections(user.id).catch((err: unknown): OAuthConnection[] => {
      // The oauth tables may not exist yet (migration 0017 pending): never 500 the page.
      console.warn("[connectors] connections unavailable:", err);
      return [];
    }),
    getDb()
      .select({ id: servers.id, name: servers.name, slug: servers.slug })
      .from(servers)
      .where(and(eq(servers.userId, user.id), ne(servers.status, "destroyed")))
      .orderBy(asc(servers.createdAt))
      .limit(100),
  ]);

  return (
    <ConnectorsPanel
      initialConnections={connections}
      servers={owned}
      origin={oauthIssuer()}
      enabled={isOAuthEnabled()}
    />
  );
}
