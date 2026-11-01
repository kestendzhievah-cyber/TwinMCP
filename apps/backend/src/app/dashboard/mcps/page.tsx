import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, Lock } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { mcpServers } from "@/db/schema";
import { can, isSellablePlan, minPlanFor } from "@/lib/plan-features";
import { getEntitlements } from "@/lib/wallet/entitlements";
import { FundedCard } from "@/components/billing/funded-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { minTopupLabel } from "@/lib/wallet/pricing";
import { PublishMcpPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function McpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  // The tier comes from the wallet (getEntitlements), never users.plan, so the
  // panel matches what POST /api/v2/mcp-servers allows.
  const plan = (await getEntitlements(user.id))?.tier ?? "free";
  const canPublish = can(plan, "publishMcp");
  // The feature is not sold at all any more (no top-up unlocks it).
  const unavailable = !isSellablePlan(minPlanFor("publishMcp"));

  // Only the columns the panel's table renders — description (up to 2000 chars)
  // and createdAt were shipped to the client but never used.
  const mcps = await db
    .select({
      id: mcpServers.id,
      slug: mcpServers.slug,
      name: mcpServers.name,
      runtime: mcpServers.runtime,
      version: mcpServers.version,
      isPublic: mcpServers.isPublic,
    })
    .from(mcpServers)
    .where(and(eq(mcpServers.publishedByUserId, user.id), eq(mcpServers.isOfficial, false)))
    .orderBy(desc(mcpServers.createdAt));

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Publish an MCP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Package any stdio MCP server so you can install it on your boxes — and optionally list it
          in the marketplace for everyone.
        </p>
      </div>

      {!canPublish &&
        (unavailable ? (
          mcps.length === 0 && (
            <FundedCard
              title="Publishing MCPs needs paid credit"
              description="Package your own MCP servers, install them on your boxes, and share them in the marketplace."
              unavailable
            />
          )
        ) : (
          // Unfunded: the offer card, with the page's one primary.
          <Card className="border-offer-border bg-offer p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-offer-foreground"
                >
                  <Lock className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold tracking-tight">
                    Publishing your own MCP unlocks with your first top-up
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Package your own MCP servers, install them on your boxes, and share them in the
                    marketplace. From <span className="tabular-nums">{minTopupLabel()}</span>, no
                    subscription: you pay for what you use.
                  </p>
                </div>
              </div>
              <Button asChild className="w-full shrink-0 sm:w-auto">
                <Link href={"/dashboard/billing" as Route}>
                  Top up
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        ))}

      {(canPublish || mcps.length > 0) && <PublishMcpPanel mcps={mcps} canPublish={canPublish} />}
    </div>
  );
}
