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
  /** Extra classes on the <pre> (e.g. a fixed height so tabs never shift the layout). */
  codeClassName?: string;
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

// A code block: mono on a quiet light-blue panel with a rounded hairline frame,
// an optional filename bar with a language chip, and a copy button.
export function CodeSnippet({
  code,
  language = "json",
  filename,
  className,
  codeClassName,
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
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-secondary",
        className
      )}
    >
      {filename && (
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
          <span className="min-w-0 break-words font-mono text-xs text-muted-foreground">
            {filename}
          </span>
          <span className="shrink-0 rounded-md border border-border bg-card px-1.5 font-mono text-xs leading-5 text-muted-foreground">
            {language}
          </span>
        </div>
      )}
      <pre className={cn("overflow-x-auto p-4 pr-16 text-sm leading-relaxed", codeClassName)}>
        <code className="font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t.copy}
        title={t.copy}
        className={cn(
          "absolute right-3 grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          filename ? "top-12" : "top-3",
          copied && "border-success/40 bg-success/10 text-success"
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
