import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Shared presentational pieces of the admin console ("Clear sky", spec §6:
// same shell as the dashboard, an "Admin" badge in the header, denser tables,
// no rose except the single primary action per screen). Server-safe: no hooks,
// so both the server pages and the client panels can import it.

/** Page header row: title + "Admin" badge, one muted line, optional actions right. */
export function AdminPageHeader({
  title,
  description,
  actions,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Extra lines under the description (badges, meta). */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="break-words font-display text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="secondary">Admin</Badge>
        </div>
        {description && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A 36px rounded tile holding a section icon (brand blue on the quiet fill). */
export function IconTile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand [&_svg]:size-4",
        className
      )}
    >
      {children}
    </span>
  );
}

/** Stat tile: a muted caption with its icon, the figure in display type, one line under. */
export function StatTile({
  icon,
  label,
  value,
  sub,
  danger = false,
  className,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  danger?: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="space-y-2">
        <CardDescription className="flex items-center gap-2 text-xs font-medium [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-brand">
          {icon}
          {label}
        </CardDescription>
        <p
          className={cn(
            "font-display text-2xl font-bold leading-tight tabular-nums tracking-tight",
            danger && "text-destructive"
          )}
        >
          {value}
        </p>
        {sub && <p className="text-xs tabular-nums text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  );
}

/** Error strip with its icon (never colour alone) and an optional retry link. */
export function ErrorNotice({
  children,
  onRetry,
  retryLabel = "Réessayer",
}: {
  children: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p>
        {children}
        {onRetry && (
          <>
            {" "}
            <button
              type="button"
              className="font-semibold underline underline-offset-4 hover:no-underline"
              onClick={onRetry}
            >
              {retryLabel}
            </button>
          </>
        )}
      </p>
    </div>
  );
}

/** Quiet empty slot for lists and filters inside admin screens. */
export function EmptyNote({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card px-6 py-10 text-center",
        className
      )}
    >
      {icon && (
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full bg-secondary text-brand [&_svg]:size-5"
        >
          {icon}
        </span>
      )}
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

/** Denser admin tables (spec §6: `py-2` cells). Apply to `<Table className>`. */
export const DENSE_TABLE = "[&_td]:py-2";
