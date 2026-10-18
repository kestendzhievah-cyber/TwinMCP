"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  // A card lifted off the stack (DESIGN.md §5, error pages): an "Error" eyebrow
  // between two hairlines, the serif title, one italic line, one button.
  return (
    <div className="flex justify-center py-10">
      <div className="flex w-full max-w-lg flex-col items-center gap-5 border border-border bg-card p-10 text-center shadow-stack">
        <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
          Error
        </p>
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-3xl font-medium">Something went wrong</h2>
          <p className="text-sm italic text-muted-foreground">
            This section failed to load. You can retry — if it keeps happening, contact support.
          </p>
        </div>
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
      </div>
    </div>
  );
}
