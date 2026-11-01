"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Plus,
  Send,
  Trash2,
  Webhook,
} from "lucide-react";
import { formatDateTime } from "@/lib/format";
import {
  MAX_ENDPOINTS_PER_USER,
  SUBSCRIBABLE_EVENTS,
  WEBHOOK_EVENT_LABELS,
  type SubscribableEvent,
  type WebhookEventType,
} from "@/lib/webhooks/events";
import type { PublicWebhookDelivery, PublicWebhookEndpoint } from "@/lib/webhooks/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Delivery = PublicWebhookDelivery & { endpointId: string };

function eventLabel(type: string): string {
  return WEBHOOK_EVENT_LABELS[type as WebhookEventType]?.label ?? type;
}

function DeliveryStatus({ d }: { d: Delivery }) {
  switch (d.status) {
    case "success":
      return <Badge variant="success">Delivered</Badge>;
    case "failed":
      return <Badge variant="destructive">Failed</Badge>;
    case "retrying":
      return <Badge variant="warning">Retrying</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="info">Pending</Badge>;
  }
}

/** Rounded checkbox that fills with brand blue, as on the Settings page (native input kept for a11y). */
function EventCheckbox({
  id,
  checked,
  onChange,
  label,
  help,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        id={id}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-input bg-card text-transparent transition-colors peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{help}</span>
      </span>
    </label>
  );
}

export function WebhooksPanel({
  endpoints,
  deliveries,
  loadFailed = false,
}: {
  endpoints: PublicWebhookEndpoint[];
  deliveries: Delivery[];
  loadFailed?: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<SubscribableEvent[]>([...SUBSCRIBABLE_EVENTS]);
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicWebhookEndpoint | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const urlById = useMemo(() => new Map(endpoints.map((e) => [e.id, e.url])), [endpoints]);
  const shownDeliveries =
    filter === "all" ? deliveries : deliveries.filter((d) => d.endpointId === filter);
  const atLimit = endpoints.length >= MAX_ENDPOINTS_PER_USER;

  function toggleEvent(e: SubscribableEvent, on: boolean) {
    setEvents((cur) => (on ? [...new Set([...cur, e])] : cur.filter((x) => x !== e)));
  }

  async function createEndpoint() {
    setCreating(true);
    try {
      const res = await fetch("/api/v2/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim(), events }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message ?? "Could not add the endpoint");
        return;
      }
      setSecret(data.secret ?? null);
      setCreateOpen(false);
      setUrl("");
      setEvents([...SUBSCRIBABLE_EVENTS]);
      toast.success("Endpoint added");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function sendTest(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v2/webhooks/${id}/test`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.message ?? "Could not send the test event");
      else if (data.ok) toast.success(`Test delivered (HTTP ${data.responseCode})`);
      else toast.error(`Test failed: ${data.error ?? "no response"}`);
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function setActive(id: string, active: boolean) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v2/webhooks/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(data.message ?? "Could not update the endpoint");
      else toast.success(active ? "Endpoint enabled" : "Endpoint disabled");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteEndpoint(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v2/webhooks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.message ?? "Could not delete the endpoint");
        return;
      }
      setDeleteTarget(null);
      if (filter === id) setFilter("all");
      toast.success("Endpoint deleted");
      router.refresh();
    } catch {
      toast.error("Network error. Check your connection and try again.");
    } finally {
      setBusyId(null);
    }
  }

  async function copySecret() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — select the secret and copy it manually.");
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Page header: title, one line, and the page's single primary action. */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight">Webhooks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Get an HTTPS request when something happens on your account.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={atLimit || loadFailed}
          className="w-full shrink-0 sm:w-auto"
        >
          <Plus aria-hidden />
          Add endpoint
        </Button>
      </header>

      {loadFailed && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          Webhooks could not be loaded right now. Try again in a moment.
        </div>
      )}

      {secret && (
        <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          <p className="mb-2 flex items-center gap-2 font-medium text-success">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Signing secret — copy it now, it won&apos;t be shown again
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs">
              {secret}
            </code>
            <Button
              size="icon"
              variant="outline"
              className="shrink-0"
              onClick={copySecret}
              aria-label="Copy secret"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => setSecret(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            <span className="font-semibold tabular-nums text-foreground">
              {endpoints.length}/{MAX_ENDPOINTS_PER_USER}
            </span>{" "}
            endpoints. Available on every plan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-[var(--card-padding)]">
          {endpoints.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
              <span className="grid size-12 place-items-center rounded-full bg-secondary text-brand">
                <Webhook aria-hidden className="size-5" />
              </span>
              <p>No endpoints yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {endpoints.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="break-all font-mono text-xs">{e.url}</code>
                      {e.active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.events.map(eventLabel).join(" · ")}
                    </p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      Added {formatDateTime(e.createdAt)}
                      {e.lastSuccessAt
                        ? ` · last delivered ${formatDateTime(e.lastSuccessAt)}`
                        : ""}
                      {e.lastFailureAt ? ` · last failure ${formatDateTime(e.lastFailureAt)}` : ""}
                      {e.failureCount > 0 ? ` · ${e.failureCount} failed in a row` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === e.id}
                      onClick={() => sendTest(e.id)}
                    >
                      <Send className="h-4 w-4" />
                      Send test
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === e.id}
                      onClick={() => setActive(e.id, !e.active)}
                    >
                      {e.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:border-destructive hover:bg-destructive/10"
                      disabled={busyId === e.id}
                      onClick={() => setDeleteTarget(e)}
                      aria-label={`Delete ${e.url}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Recent deliveries</CardTitle>
            <CardDescription>
              Failed deliveries are retried up to 5 more times over about 7 hours. An endpoint is
              disabled after 20 events in a row fail, and you get an email.
            </CardDescription>
          </div>
          {endpoints.length > 1 && (
            <select
              aria-label="Filter by endpoint"
              value={filter}
              onChange={(ev) => setFilter(ev.target.value)}
              className={cn(
                fieldClasses,
                "h-10 sm:max-w-[14rem] [&>option]:bg-card [&>option]:text-foreground"
              )}
            >
              <option value="all">All endpoints</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.url}
                </option>
              ))}
            </select>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {shownDeliveries.length === 0 ? (
            <p className="px-[var(--card-padding)] py-8 text-center text-sm text-muted-foreground">
              No deliveries yet. Send a test event to try an endpoint.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Sent</TableHead>
                  {endpoints.length > 1 && <TableHead>Endpoint</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownDeliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <span className="block">{eventLabel(d.eventType)}</span>
                      <code className="font-mono text-[11px] text-muted-foreground">{d.id}</code>
                    </TableCell>
                    <TableCell>
                      <DeliveryStatus d={d} />
                      {d.status === "retrying" && d.nextAttemptAt && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          next {formatDateTime(d.nextAttemptAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {d.responseCode !== null ? `HTTP ${d.responseCode}` : (d.error ?? "—")}
                    </TableCell>
                    <TableCell>{d.attempt}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(d.createdAt)}
                    </TableCell>
                    {endpoints.length > 1 && (
                      <TableCell className="max-w-[12rem] truncate font-mono text-xs">
                        {urlById.get(d.endpointId) ?? "—"}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verifying requests</CardTitle>
          <CardDescription>
            Requests follow the Standard Webhooks specification, so its libraries verify them as-is.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Each request is a <code className="font-mono text-xs">POST</code> with a JSON body{" "}
            <code className="font-mono text-xs">{"{ id, type, timestamp, data }"}</code> and three
            headers: <code className="font-mono text-xs">webhook-id</code> (the same on every retry,
            use it to ignore duplicates),{" "}
            <code className="font-mono text-xs">webhook-timestamp</code> (Unix seconds) and{" "}
            <code className="font-mono text-xs">webhook-signature</code>.
          </p>
          <p>
            The signature is <code className="font-mono text-xs">v1,</code> followed by the base64
            HMAC-SHA256 of{" "}
            <code className="font-mono text-xs">{"<webhook-id>.<webhook-timestamp>.<body>"}</code>,
            keyed with the base64-decoded part of your secret after{" "}
            <code className="font-mono text-xs">whsec_</code>. Compare it in constant time and
            reject timestamps more than 5 minutes old. Answer with any 2xx status; redirects are not
            followed.
          </p>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a webhook endpoint</DialogTitle>
            <DialogDescription>
              An HTTPS URL on a public host. The signing secret is shown once, right after.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                inputMode="url"
                placeholder="https://example.com/twinmcp/webhooks"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <fieldset className="space-y-3">
              <legend className="mb-2 text-sm font-medium">Events</legend>
              {SUBSCRIBABLE_EVENTS.map((ev) => (
                <EventCheckbox
                  key={ev}
                  id={`webhook-event-${ev}`}
                  checked={events.includes(ev)}
                  onChange={(on) => toggleEvent(ev, on)}
                  label={WEBHOOK_EVENT_LABELS[ev].label}
                  help={WEBHOOK_EVENT_LABELS[ev].help}
                />
              ))}
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={createEndpoint}
              disabled={creating || !url.trim() || events.length === 0}
            >
              {creating ? "Adding…" : "Add endpoint"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this endpoint?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.url} stops receiving events and its delivery history is deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!deleteTarget || busyId === deleteTarget.id}
              onClick={() => deleteTarget && deleteEndpoint(deleteTarget.id)}
            >
              Delete endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
