import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center md:py-20">
        <div
          aria-hidden
          className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground"
        >
          <Icon className="h-6 w-6" />
        </div>
        <div className="max-w-md space-y-2">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {(primaryAction || secondaryAction) && (
          <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row">
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
