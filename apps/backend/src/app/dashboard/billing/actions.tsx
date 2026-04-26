"use client";

import { useState } from "react";

const btnStyle: React.CSSProperties = {
  padding: "10px 20px",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: "0.85rem",
  background: "#111",
  color: "#fff",
};

export function BillingActions({ plan }: { plan: string }) {
  const [loading, setLoading] = useState("");

  async function checkout(target: string) {
    setLoading(target);
    const res = await fetch("/api/v2/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: target }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading("");
  }

  async function openPortal() {
    setLoading("portal");
    const res = await fetch("/api/v2/billing/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
    setLoading("");
  }

  if (plan === "free") {
    return (
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 8, flex: 1 }}>
          <h3 style={{ fontSize: "1rem", marginBottom: 4 }}>Pro — $20/mo</h3>
          <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: 16 }}>
            1,000 requests/day, priority support.
          </p>
          <button onClick={() => checkout("pro")} disabled={!!loading} style={btnStyle}>
            {loading === "pro" ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>
        <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 8, flex: 1 }}>
          <h3 style={{ fontSize: "1rem", marginBottom: 4 }}>Team — $50/mo</h3>
          <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: 16 }}>
            5,000 requests/day, teamspace, policies.
          </p>
          <button onClick={() => checkout("team")} disabled={!!loading} style={btnStyle}>
            {loading === "team" ? "Redirecting…" : "Upgrade to Team"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {plan === "pro" && (
        <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 8 }}>
          <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Upgrade to Team</h3>
          <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: 16 }}>
            5,000 requests/day + teamspace management.
          </p>
          <button onClick={() => checkout("team")} disabled={!!loading} style={btnStyle}>
            {loading === "team" ? "Redirecting…" : "Upgrade"}
          </button>
        </div>
      )}
      <div style={{ padding: 20, border: "1px solid #eee", borderRadius: 8 }}>
        <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Manage subscription</h3>
        <p style={{ color: "#666", fontSize: "0.85rem", marginBottom: 16 }}>
          Update payment method, view invoices, or cancel.
        </p>
        <button
          onClick={openPortal}
          disabled={!!loading}
          style={{ ...btnStyle, background: "#555" }}
        >
          {loading === "portal" ? "Redirecting…" : "Billing portal"}
        </button>
      </div>
    </div>
  );
}
