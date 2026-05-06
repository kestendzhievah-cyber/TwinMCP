"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>$20/month — 1,000 requests/day, priority support</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => checkout("pro")} disabled={!!loading}>
              {loading === "pro" ? "Redirecting…" : "Upgrade to Pro"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>$50/month — 5,000 requests/day, teamspace, policies</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => checkout("team")} disabled={!!loading}>
              {loading === "team" ? "Redirecting…" : "Upgrade to Team"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plan === "pro" && (
        <Card>
          <CardHeader>
            <CardTitle>Upgrade to Team</CardTitle>
            <CardDescription>5,000 requests/day + teamspace management.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => checkout("team")} disabled={!!loading}>
              {loading === "team" ? "Redirecting…" : "Upgrade"}
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Manage subscription</CardTitle>
          <CardDescription>
            Update payment method, view invoices, or cancel.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={openPortal} disabled={!!loading}>
            {loading === "portal" ? "Redirecting…" : "Billing portal"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
