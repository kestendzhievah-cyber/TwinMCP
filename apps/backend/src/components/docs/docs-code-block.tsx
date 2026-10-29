"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n/locales";

// Typewriter code block for the docs (same look as marketing/code-snippet.tsx:
// Courier on a darker bone panel, one hairline, hairline-square copy button),
// with the copy feedback in the page's language.

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
    <div className={cn("relative border border-border bg-secondary/60", className)}>
      <span className="smallcaps tracking-sc absolute left-3 top-2 text-xs text-muted-foreground">
        {language}
      </span>
      <pre className="overflow-x-auto px-4 pb-4 pt-8 text-sm leading-relaxed">
        <code className="!bg-transparent !p-0 font-mono text-foreground">{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t.copy}
        title={t.copy}
        className={cn(
          "absolute right-3 top-3 grid h-10 w-10 place-items-center border border-border bg-card text-muted-foreground transition-colors hover:border-foreground/60 hover:text-foreground",
          copied && "border-success/40 bg-success/10 text-success"
        )}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  );
}
