import { Skeleton } from "@/components/ui/skeleton";

// Blank card stock while the overview loads: the title block over its double
// rule, three stat cards, the API-key ledger — the same bones as page.tsx.
export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-64 bg-secondary/70" />
        <div className="rule-double mt-4" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
