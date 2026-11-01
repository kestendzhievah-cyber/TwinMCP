"use client";

import { useState } from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resultTexts, type TryResponse, type TryStatus } from "./protocol";

const STATUS: Record<TryStatus, { label: string; variant: BadgeProps["variant"] }> = {
  ok: { label: "Success", variant: "success" },
  tool_error: { label: "Tool error", variant: "warning" },
  error: { label: "Error", variant: "destructive" },
  waking: { label: "Waking up", variant: "info" },
  denied: { label: "Blocked by policy", variant: "destructive" },
  rate_limited: { label: "Rate limited", variant: "warning" },
  no_credit: { label: "Credit used up", variant: "destructive" },
};

function pretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? "null";
  } catch {
    return String(value);
  }
}

/** A text block that holds JSON is shown indented; anything else verbatim. */
function prettyText(text: string): string {
  const t = text.trim();
  if (!(t.startsWith("{") || t.startsWith("["))) return text;
  try {
    return JSON.stringify(JSON.parse(t), null, 2);
  } catch {
    return text;
  }
}

/** A result block: mono on the quiet secondary fill, scrolling inside itself. */
function InkBlock({ children, label }: { children: string; label?: string }) {
  return (
    <pre
      aria-label={label}
      className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-4 font-mono text-xs leading-relaxed text-foreground"
    >
      {children}
    </pre>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: the text is still selectable */
    }
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={copy}
      aria-label={label}
      title={label}
      className="h-7 px-2"
    >
      {copied ? <Check className="text-success" /> : <Copy />}
    </Button>
  );
}

/**
 * The outcome of a run: status, latency and request id on one line, then the
 * result (text blocks unwrapped, JSON indented) or the raw JSON-RPC message.
 */
export function ResultPanel({ response, title }: { response: TryResponse; title: string }) {
  const [view, setView] = useState<"result" | "raw">("result");
  const status = STATUS[response.status];
  const texts = resultTexts(response.result);
  const content = (response.result as { content?: unknown } | undefined)?.content;
  const otherBlocks = Array.isArray(content) ? content.length - texts.length : 0;
  const structured =
    response.result && typeof response.result === "object"
      ? (response.result as { structuredContent?: unknown }).structuredContent
      : undefined;

  return (
    <section aria-label={title} className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-mono text-sm font-semibold">{title}</h3>
          <Badge variant={status.variant}>{status.label}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            {response.latencyMs.toLocaleString("en-US")} ms
          </span>
        </div>
        {response.requestId && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-medium">Request id</span>
            <span className="max-w-[16rem] truncate font-mono" title={response.requestId}>
              {response.requestId}
            </span>
            <CopyButton text={response.requestId} label="Copy request id" />
          </div>
        )}
      </div>

      <div
        className="flex items-center gap-1 border-b border-border px-4 py-2"
        role="group"
        aria-label="Result view"
      >
        {(["result", "raw"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === v
                ? "bg-brand text-brand-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            {v === "result" ? "Result" : "Raw JSON-RPC"}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {view === "raw" ? (
          <InkBlock label="Raw JSON-RPC message">{pretty(response.raw)}</InkBlock>
        ) : response.error ? (
          <div className="space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p>{response.error.message}</p>
                <p className="mt-1 font-mono text-xs">code {response.error.code}</p>
              </div>
            </div>
            {response.status === "no_credit" && (
              <Button asChild size="sm">
                <Link href="/dashboard/billing">Top up</Link>
              </Button>
            )}
            {response.error.data !== undefined && (
              <InkBlock label="Error data">{pretty(response.error.data)}</InkBlock>
            )}
          </div>
        ) : texts.length > 0 ? (
          <>
            {texts.map((t, i) => (
              <InkBlock key={i} label={`Text content ${i + 1}`}>
                {prettyText(t)}
              </InkBlock>
            ))}
            {structured !== undefined && (
              <InkBlock label="Structured content">{pretty(structured)}</InkBlock>
            )}
            {otherBlocks > 0 && (
              <p className="text-xs text-muted-foreground">
                {otherBlocks} non-text content block{otherBlocks > 1 ? "s" : ""} (images,
                resources…): see Raw JSON-RPC.
              </p>
            )}
          </>
        ) : (
          <InkBlock label="Result">{pretty(response.result)}</InkBlock>
        )}
      </div>
    </section>
  );
}
