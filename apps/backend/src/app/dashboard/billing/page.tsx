import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BillingActions } from "./actions";
import { Badge } from "@/components/ui/badge";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
          Current plan:{" "}
          <Badge variant={plan === "free" ? "secondary" : "success"} className="capitalize">
            {plan}
          </Badge>
        </p>
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
