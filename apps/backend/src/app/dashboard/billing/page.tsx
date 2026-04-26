import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { BillingActions } from "./actions";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = getDb();
  const [userRow] = await db
    .select({ plan: users.plan })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  const plan = userRow?.plan ?? "free";

  return (
    <div>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 4 }}>Billing</h1>
      <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.875rem" }}>
        Current plan: <strong style={{ textTransform: "capitalize" }}>{plan}</strong>
      </p>
      <BillingActions plan={plan} />
    </div>
  );
}
