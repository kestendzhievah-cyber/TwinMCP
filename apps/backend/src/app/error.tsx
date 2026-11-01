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
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg sm:p-10">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" aria-hidden />
        </div>
        <p className="eyebrow mt-4 text-destructive">Error</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="mt-3 text-muted-foreground">
          An unexpected error occurred. You can retry, or head back home — if it keeps happening,
          contact support.
        </p>
        <div className="my-6 border-t border-border" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">twinmcp.fr · hello@twinmcp.fr</p>
      </div>
    </main>
  );
}
