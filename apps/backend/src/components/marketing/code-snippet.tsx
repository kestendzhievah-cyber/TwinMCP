"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

interface CodeSnippetProps {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
  /** Language of the copy button's label and toasts (the code itself is never translated). */
  locale?: Locale;
}

const STRINGS: Record<Locale, { copy: string; copied: string; failed: string }> = {
  en: {
    copy: "Copy code",
    copied: "Copied to clipboard",
    failed: "Could not copy. Select the text and copy manually.",
  },
  fr: {
    copy: "Copier le code",
    copied: "Copié dans le presse-papiers",
    failed: "Copie impossible. Sélectionnez le texte et copiez-le à la main.",
  },
};

// Typewriter code: Courier on a darker bone panel with one hairline around it.
// The filename is an engraved tab; the copy button a hairline square.
export function CodeSnippet({
  code,
  language = "json",
  filename,
  className,
  locale = "en",
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);
  const t = STRINGS[locale];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success(t.copied);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(t.failed);
    }
  }

  return (
    <div className={cn("relative overflow-hidden border border-border bg-secondary/60", className)}>
      {filename && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="smallcaps tracking-sc min-w-0 break-words text-xs text-muted-foreground">
            {filename}
          </span>
          <span className="smallcaps tracking-sc shrink-0 border border-border px-1.5 text-xs leading-5 text-muted-foreground">
            {language}
          </span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 pr-16 text-sm leading-relaxed">
        <code className="font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t.copy}
        title={t.copy}
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
