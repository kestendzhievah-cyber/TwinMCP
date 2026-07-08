import { eq } from "drizzle-orm";
import { createClient } from "@/utils/supabase/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { SettingsPanel } from "./panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [row] = await getDb()
    .select({ email: users.email, metadata: users.metadata })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  const meta = (row?.metadata ?? {}) as { ide_preference?: string };

  return (
    <SettingsPanel
      email={row?.email ?? user.email ?? ""}
      idePreference={meta.ide_preference ?? ""}
    />
  );
}
