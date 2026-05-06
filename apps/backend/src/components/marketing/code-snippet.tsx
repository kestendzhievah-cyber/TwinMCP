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
    <div
      className={cn(
        "group/snippet relative overflow-hidden rounded-lg border border-border/80 bg-muted/30 shadow-sm",
        className
      )}
    >
      {filename && (
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2">
          <span className="font-mono text-xs text-muted-foreground">{filename}</span>
          <span className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {language}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className={cn(
          "absolute right-3 grid h-7 w-7 place-items-center rounded-md border border-border/80 bg-background/95 text-muted-foreground transition-all hover:text-foreground",
          filename ? "top-12" : "top-3",
          copied && "text-emerald-500"
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
