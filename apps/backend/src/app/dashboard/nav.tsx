"use client";

import { createClient } from "@/utils/supabase/client";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "API Keys" },
  { href: "/dashboard/libraries", label: "Libraries" },
  { href: "/dashboard/policies", label: "Policies" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <nav
      style={{
        width: 220,
        borderRight: "1px solid #eee",
        padding: "1.5rem 1rem",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem" }}>TwinMCP</h2>
      {links.map((l) => (
        <a
          key={l.href}
          href={l.href}
          style={{
            padding: "8px 12px",
            borderRadius: 6,
            textDecoration: "none",
            fontSize: "0.875rem",
            color: pathname === l.href ? "#111" : "#666",
            background: pathname === l.href ? "#f3f3f3" : "transparent",
            fontWeight: pathname === l.href ? 600 : 400,
          }}
        >
          {l.label}
        </a>
      ))}
      <div style={{ marginTop: "auto", borderTop: "1px solid #eee", paddingTop: 12 }}>
        <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: 8, wordBreak: "break-all" }}>
          {email}
        </p>
        <button
          onClick={handleSignOut}
          style={{
            background: "none",
            border: "none",
            color: "#666",
            cursor: "pointer",
            fontSize: "0.8rem",
            padding: 0,
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
