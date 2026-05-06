import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center rounded-md bg-foreground text-[10px] font-bold tracking-tight text-background"
      >
        T
      </span>
      <span className="text-base font-semibold tracking-tight">TwinMCP</span>
    </div>
  );
}
