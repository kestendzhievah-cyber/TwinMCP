import type { Metadata } from "next";
import { createClient } from "@/utils/supabase/server";
import { SecretsPanel } from "./panel";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Secrets" };

export default async function SecretsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  return <SecretsPanel />;
}
