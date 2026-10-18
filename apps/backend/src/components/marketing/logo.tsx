import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Render the "TwinMCP" wordmark (default true). */
  showWordmark?: boolean;
  /** Kept for API compatibility with the old raster logo; scales the mark. */
  size?: number;
  /** Show the engraved monogram square before the wordmark. */
  mark?: boolean;
  /** The small-capitals line under the wordmark (the card's "Mergers and Acquisitions"). */
  tagline?: boolean | string;
}

// The brand is typography, like the card: a small-capitals wordmark with a
// letterspaced line underneath. No raster, no gradient. Vector files of the
// same drawing live in /public (logo.svg, logo-mark.svg, …) for external use.
export function Logo({
  className,
  showWordmark = true,
  size = 28,
  mark = false,
  tagline = true,
}: LogoProps) {
  const taglineText = typeof tagline === "string" ? tagline : "Managed MCP Runtimes";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {mark && (
        // The monogram: the engraved "T" inside a double-rule frame (same
        // drawing as /logo-mark.svg and the app icons), in currentColor so it
        // follows the theme.
        <span
          aria-hidden
          className="grid shrink-0 place-items-center border-2 border-foreground/85 p-[2px] text-foreground"
          style={{ height: size, width: size }}
        >
          <span
            className="grid h-full w-full place-items-center border border-foreground/70 font-serif font-medium leading-none"
            style={{ fontSize: Math.round(size * 0.5) }}
          >
            T
          </span>
        </span>
      )}
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span className="smallcaps text-[1.125rem] font-medium tracking-[0.14em] text-foreground">
            TwinMCP
          </span>
          {tagline && (
            <span className="smallcaps mt-1 text-[0.625rem] tracking-[0.24em] text-muted-foreground">
              {taglineText}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
