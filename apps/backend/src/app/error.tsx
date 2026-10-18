"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Root segment error boundary — catches server/client render errors in the
// marketing, docs, blog, servers, use-cases, auth and onboarding trees and shows
// a branded fallback (dashboard has its own). Root-layout errors still fall
// through to global-error.tsx.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16"
    >
      <div className="w-full max-w-md border border-foreground/60 bg-card p-10 text-center shadow-stack">
        <p className="eyebrow flex items-center justify-center gap-4 text-destructive before:h-px before:w-8 before:bg-border before:content-[''] after:h-px after:w-8 after:bg-border after:content-['']">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Error
        </p>
        <h1 className="mt-5 text-3xl font-medium">Something went wrong</h1>
        <p className="mt-3 italic text-muted-foreground">
          An unexpected error occurred. You can retry, or head back home — if it keeps happening,
          contact support.
        </p>
        <div className="rule-double my-6" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
        <p className="smallcaps tracking-sc mt-6 text-xs text-muted-foreground">
          twinmcp.fr · hello@twinmcp.fr
        </p>
      </div>
    </main>
  );
}
