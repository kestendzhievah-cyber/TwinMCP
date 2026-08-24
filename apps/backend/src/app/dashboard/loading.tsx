export default function DashboardLoading() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded-md bg-secondary" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-secondary/70" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl bg-secondary" />
        <div className="h-28 animate-pulse rounded-xl bg-secondary" />
        <div className="h-28 animate-pulse rounded-xl bg-secondary" />
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-secondary" />
    </div>
  );
}
