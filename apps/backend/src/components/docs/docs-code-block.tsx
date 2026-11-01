"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

// Code block for the docs (same family as marketing/code-snippet.tsx: mono on
// the quiet light-blue fill, a rounded frame, a rounded copy button), with the
// copy feedback in the page's language.

const COPY = {
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
} as const satisfies Record<Locale, Record<string, string>>;

interface DocsCodeBlockProps {
  code: string;
  language: string;
  locale?: Locale;
  className?: string;
}

export function DocsCodeBlock({ code, language, locale = "en", className }: DocsCodeBlockProps) {
  const t = COPY[locale];
  const [copied, setCopied] = useState(false);

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
    <div className={cn("relative rounded-xl border border-border bg-secondary", className)}>
      <span className="absolute left-4 top-3 font-mono text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {language}
      </span>
      <pre className="overflow-x-auto px-4 pb-4 pt-12 text-sm leading-relaxed">
        <code className="!bg-transparent !p-0 font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t.copy}
        title={t.copy}
        className={cn(
          "absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-lg border border-input bg-card text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          copied && "border-success/40 bg-success/10 text-success"
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
