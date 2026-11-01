"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/empty-state";

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

  // The empty-state pattern with the error tint (docs/DESIGN.md, Loading /
  // error): an outline "Try again" and the primary way back to the overview.
  return (
    <div className="py-6 md:py-10">
      <EmptyState
        icon={AlertTriangle}
        tone="destructive"
        title="Something went wrong"
        description="This section failed to load. You can retry — if it keeps happening, contact support."
        className="mx-auto max-w-lg"
        primaryAction={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        }
        secondaryAction={
          <Button onClick={reset} variant="outline" className="w-full sm:w-auto">
            <RotateCcw className="h-4 w-4" />
            Try again
          </Button>
        }
      />
    </div>
  );
}
