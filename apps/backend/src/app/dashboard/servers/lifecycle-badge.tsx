import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LifecycleLabel } from "@/lib/server-lifecycle-label";

// "Clear sky" status pills (docs/DESIGN.md, dashboard §6): Running is green,
// Starting blue, Paused neutral, Error red WITH an icon (never colour alone).
// The words, hover help and tint all come from lib/server-lifecycle-label.ts.

/** A server's lifecycle as a pill. Server-safe (no hooks). */
export function LifecycleBadge({ view, className }: { view: LifecycleLabel; className?: string }) {
  const variant = view.variant;
  return (
    <Badge variant={variant} title={view.help} className={className}>
      {variant === "destructive" ? (
        <AlertTriangle aria-hidden className="h-3 w-3" />
      ) : (
        // The status dot; it breathes while the server is in flight (the
        // global reduced-motion rule stills it).
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
            view.transient && "animate-pulse"
          )}
        />
      )}
      {view.label}
    </Badge>
  );
}
