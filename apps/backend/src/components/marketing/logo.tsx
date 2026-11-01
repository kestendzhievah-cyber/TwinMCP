import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Render the "TwinMCP" wordmark (default true). */
  showWordmark?: boolean;
  /** Side of the square mark, in px (default 28). */
  size?: number;
  /** Show the square "T" mark before the wordmark (default true). */
  mark?: boolean;
  /**
   * A short muted line under the wordmark: `true` for the default
   * ("Managed MCP Runtimes"), a string for a custom one (the dashboard's
   * "Control Plane"). Off by default.
   */
  tagline?: boolean | string;
}

// "Clear sky" brand (docs/DESIGN.md, spec §4.13): a navy rounded square with a
// Plus Jakarta "T" and a small rose dot at its top-right corner, then the
// wordmark in the display face. The square uses the ink token and the "T" the
// page token, so the mark inverts with the theme. Vector files of the same
// drawing live in /public (logo.svg, logo-mark.svg, …) for external use.
export function Logo({
  className,
  showWordmark = true,
  size = 28,
  mark = true,
  tagline = false,
}: LogoProps) {
  const taglineText = typeof tagline === "string" ? tagline : "Managed MCP Runtimes";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark && (
        <span
          aria-hidden
          className="relative grid shrink-0 place-items-center rounded-lg bg-foreground font-display font-extrabold leading-none text-background"
          style={{ height: size, width: size, fontSize: Math.round(size * 0.5) }}
        >
          T
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
        </span>
      )}
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
            TwinMCP
          </span>
          {tagline && (
            <span className="mt-1 text-[0.625rem] font-medium text-muted-foreground">
              {taglineText}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
