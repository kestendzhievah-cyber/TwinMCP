"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** A request id in mono, shortened, with a one-click copy of the full value. */
export function CopyRequestId({ requestId }: { requestId: string }) {
  const [copied, setCopied] = useState(false);
  const short = requestId.length > 14 ? `${requestId.slice(0, 12)}…` : requestId;

  async function copy() {
    try {
      await navigator.clipboard.writeText(requestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the id and copy it manually.");
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-xs text-muted-foreground" title={requestId}>
        {short}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy request id ${requestId}`}
        title="Copy request id"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
