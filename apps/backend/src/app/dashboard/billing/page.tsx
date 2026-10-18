import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BillingActions } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [userRow] = await db
    .select({
      plan: users.plan,
      subscriptionStatus: users.subscriptionStatus,
      currentPeriodEnd: users.currentPeriodEnd,
      cancelAtPeriodEnd: users.cancelAtPeriodEnd,
      stripeCustomerId: users.stripeCustomerId,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const plan = userRow?.plan ?? "free";

  return (
    <div className="space-y-8">
      {/* Page header: name line top-left, the current plan in the card's top-right corner, a double rule under. */}
      <div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div>
            <h1 className="smallcaps tracking-sc text-2xl font-medium">Billing</h1>
            <p className="mt-1 text-sm italic text-muted-foreground">Your plan and subscription.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="smallcaps tracking-sc text-xs text-muted-foreground">
              Current plan
            </span>
            <Badge variant={plan === "free" ? "secondary" : "success"} className="capitalize">
              {plan}
            </Badge>
          </div>
        </div>
        <Separator variant="double" className="mt-4" />
      </div>
      <BillingActions
        plan={plan}
        currentPeriodEnd={userRow?.currentPeriodEnd?.toISOString() ?? null}
        cancelAtPeriodEnd={userRow?.cancelAtPeriodEnd ?? false}
        subscriptionStatus={userRow?.subscriptionStatus ?? null}
        hasStripeCustomer={Boolean(userRow?.stripeCustomerId)}
      />
    </div>
  );
}
