"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      <Card className="max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <h2 className="text-lg font-semibold">Thanks — we&apos;ll be in touch.</h2>
          <p className="text-sm text-muted-foreground">
            We received your request and will reply to <span className="font-medium">{email}</span>{" "}
            shortly.
          </p>
        </CardContent>
      </Card>
    );
  }

  const textareaCls =
    "flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Talk to us about Team</CardTitle>
        <CardDescription>
          Tell us about your team and we&apos;ll set you up with the right plan.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Your name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
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
          <div className="space-y-1.5">
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
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Sending…" : "Send inquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
