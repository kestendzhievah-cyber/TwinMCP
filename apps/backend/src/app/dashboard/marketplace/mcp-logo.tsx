import {
  BookOpen,
  Code2,
  Database,
  Globe,
  ListChecks,
  Palette,
  Puzzle,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { BrandLogo, hasBrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";

// The lucide fallback per catalogue category (lib/servers/seed-catalog.ts),
// for MCPs without a brand mark in components/brand (Slack, Firecrawl, …).
const CATEGORY_ICON: Record<string, LucideIcon> = {
  ai: Sparkles,
  creative: Palette,
  data: Database,
  dev: Code2,
  docs: BookOpen,
  productivity: ListChecks,
  utility: Wrench,
  web: Globe,
};

/**
 * An MCP's mark: the real brand logo when the catalogue slug has one (never
 * tinted, on the white card), otherwise its category icon in a quiet tile.
 * Decorative: the MCP's name is always printed next to it. Server-safe.
 */
export function McpLogo({
  slug,
  category,
  size = 32,
  className,
}: {
  slug: string;
  category?: string | null;
  /** Width and height in px. */
  size?: number;
  className?: string;
}) {
  const box = { width: size, height: size };
  if (hasBrandLogo(slug)) {
    return (
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center text-foreground", className)}
        style={box}
      >
        <BrandLogo slug={slug} size={size} decorative />
      </span>
    );
  }
  const Icon = (category && CATEGORY_ICON[category]) || Puzzle;
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-lg bg-secondary text-brand",
        className
      )}
      style={box}
    >
      <Icon style={{ width: Math.round(size / 2), height: Math.round(size / 2) }} />
    </span>
  );
}
