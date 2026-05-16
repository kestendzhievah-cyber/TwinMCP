import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

export function Logo({ className, showWordmark = true, size = 28 }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/twinmcp-logo.svg"
        alt=""
        aria-hidden
        width={size}
        height={size}
        className="rounded-md object-contain"
        style={{ height: size, width: size }}
      />
      {showWordmark && (
        <span className="text-base font-semibold tracking-tight">TwinMCP</span>
      )}
    </div>
  );
}
