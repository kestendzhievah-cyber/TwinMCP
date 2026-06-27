import { redirect } from "next/navigation";
import { and, desc, eq, or } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers, servers, users } from "@/db/schema";
import { OnboardingWizard } from "./wizard";

export const dynamic = "force-dynamic";

interface OnboardingPageProps {
  searchParams: Promise<{ force?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { force } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?returnTo=/onboarding");

  const db = getDb();

  // Ensure the row exists (matches lib/session ensureUserRow behaviour).
  await db
    .insert(users)
    .values({ id: user.id, email: user.email ?? `${user.id}@placeholder.twinmcp.fr` })
    .onConflictDoNothing({ target: users.id });

  const [me] = await db
    .select({ completedAt: users.onboardingCompletedAt })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (me?.completedAt && force !== "1") {
    redirect("/dashboard");
  }

  // Pull catalog (5 official MCPs) for step 3 carousel.
  const catalog = await db
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      description: mcpServers.description,
      runtime: mcpServers.runtime,
      version: mcpServers.version,
      configSchema: mcpServers.configSchema,
    })
    .from(mcpServers)
    .where(and(eq(mcpServers.isOfficial, true), eq(mcpServers.isPublic, true)))
    .orderBy(desc(mcpServers.createdAt))
    .limit(5);

  // Detect existing server (Free quota = 1) so step 2 can skip ahead.
  const [existing] = await db
    .select({
      id: servers.id,
      name: servers.name,
      slug: servers.slug,
      endpointUrl: servers.endpointUrl,
      status: servers.status,
    })
    .from(servers)
    .where(
      and(
        eq(servers.userId, user.id),
        or(eq(servers.status, "running"), eq(servers.status, "provisioning"))
      )
    )
    .orderBy(desc(servers.createdAt))
    .limit(1);

  const existingServer = existing
    ? {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        endpointUrl: existing.endpointUrl,
      }
    : null;

  return (
    <OnboardingWizard
      catalog={catalog.map((mcp) => ({
        ...mcp,
        configSchema: (mcp.configSchema ?? {}) as { properties?: Record<string, never> },
      }))}
      existingServer={existingServer}
    />
  );
}
