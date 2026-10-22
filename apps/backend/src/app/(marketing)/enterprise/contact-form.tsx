"use client";

import { useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackDemoConversion } from "@/lib/analytics/google-ads";

export function ContactSalesForm() {
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [users, setUsers] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/v2/contact-sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          company,
          name,
          email,
          users: Number(users),
          message: message.trim() || undefined,
        }),
      });
      if (res.ok) {
        trackDemoConversion(email);
        setDone(true);
        return;
      }
      const err = await res.json().catch(() => ({}));
      setError(err.message ?? "Something went wrong — please email hello@twinmcp.fr.");
    } catch {
      setError("Network error — please try again or email hello@twinmcp.fr.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="mx-auto w-full max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-12 text-center">
          {/* Success is the tint recipe: hairline square, 10% green, green ink. */}
          <div className="grid h-12 w-12 place-items-center border border-success/40 bg-success/10 text-success">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="smallcaps tracking-sc text-xl font-medium">
            Thanks — we&apos;ll be in touch.
          </h2>
          <p className="text-sm text-muted-foreground">
            We received your request and will reply to{" "}
            <span className="font-mono text-foreground">{email}</span> shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Same debossed field as the Input primitive, grown for a few lines.
  const textareaCls =
    "flex min-h-[96px] w-full border border-input bg-card px-3 py-2 text-sm text-foreground shadow-inner transition-colors placeholder:italic placeholder:text-muted-foreground/70 focus-visible:border-foreground focus-visible:outline-none focus-visible:ring-0";

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader className="border-b border-border">
        <CardTitle>Talk to us about Team</CardTitle>
        <CardDescription>
          Tell us about your team and we&apos;ll set you up with the right plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="users">Number of users</Label>
              <Input
                id="users"
                type="number"
                min={1}
                placeholder="e.g. 8"
                value={users}
                onChange={(e) => setUsers(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Anything else? (optional)</Label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={textareaCls}
              maxLength={2000}
              placeholder="Use case, timeline, questions…"
            />
          </div>
          {error && (
            <p className="flex items-start gap-2 border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </p>
          )}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Send inquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
