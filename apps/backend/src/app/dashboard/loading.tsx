import { Skeleton } from "@/components/ui/skeleton";

// The overview's bones while it loads (same layout as page.tsx): the header
// row with its action, the credit card beside the setup checklist, the
// servers table, the API keys card.
export default function DashboardLoading() {
  return (
    <div className="space-y-6 md:space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
      <Skeleton className="h-56 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
    </div>
  );
}
