import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** "destructive" draws the icon circle in the error tint (error pages). */
  tone?: "default" | "destructive";
  /** Heading level of the title (h2 by default; h3 inside a titled card). */
  as?: "h2" | "h3";
  className?: string;
}

// An empty state (docs/DESIGN.md, Empty states): a dashed white slot, a 48 px
// circle holding the icon, a display title, one muted line, then one primary
// button and an optional link. The caller picks the buttons' variants so the
// page keeps a single rose primary.
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tone = "default",
  as: Heading = "h2",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border bg-card p-8 text-center sm:p-10",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid h-12 w-12 place-items-center rounded-full",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-secondary text-brand"
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="max-w-md space-y-1.5">
        <Heading className="font-display text-lg font-semibold tracking-tight">{title}</Heading>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {(primaryAction || secondaryAction) && (
        <div className="mt-1 flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
