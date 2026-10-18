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

// An empty state (DESIGN.md §5) is a blank slot on the card: a dashed ink
// hairline on bare stock, the icon bare, a small-caps title, one italic line.
export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <Card
      className={cn("border-dashed border-foreground/40 bg-transparent shadow-none", className)}
    >
      <CardContent className="flex flex-col items-center gap-4 py-14 text-center md:py-20">
        <Icon aria-hidden className="h-6 w-6 text-muted-foreground" />
        <div className="max-w-md space-y-2">
          <h2 className="smallcaps tracking-sc text-base font-medium">{title}</h2>
          {description && <p className="text-sm italic text-muted-foreground">{description}</p>}
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
