"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CodeSnippetProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}

// Typewriter code: Courier on a darker bone panel with one hairline around it.
// The filename is an engraved tab; the copy button a hairline square.
export function CodeSnippet({ code, language = "json", filename, className }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy. Select the text and copy manually.");
    }
  }

  return (
    <div className={cn("relative overflow-hidden border border-border bg-secondary/60", className)}>
      {filename && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="smallcaps tracking-sc text-xs text-muted-foreground">{filename}</span>
          <span className="smallcaps tracking-sc border border-border px-1.5 text-xs leading-5 text-muted-foreground">
            {language}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className={cn(
          "absolute right-3 grid h-10 w-10 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground",
          filename ? "top-12" : "top-3",
          copied && "border-success/40 bg-success/10 text-success"
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
