// Third-party brand marks (AI clients and catalogue MCPs), rendered from the
// committed simple-icons paths in logos.generated.ts. Server-safe: no hooks and
// no "use client", so it renders in server and client components alike.
//
// Usage rules (docs/DESIGN.md, "Logos and trademark rules"):
// - only in a "works with / connect to / available in the catalogue" sense;
// - unmodified, never tinted with theme colours (the fill is the brand hex, or
//   currentColor for black-only marks, so they follow text-foreground);
// - on bg-card tiles or the surface-band, never on rose;
// - callers fall back to their current lucide icon when hasBrandLogo() is false.

import { createElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";
import { BRAND_LOGOS, type BrandLogoDef } from "./logos.generated";

export type { BrandLogoDef };
export { BRAND_LOGOS };

/** The key of the Model Context Protocol mark (the IdeKey "other"). */
export const MCP_LOGO_KEY = "other";

/** Every key that has a mark (IdeKey values and catalogue slugs). */
export const BRAND_LOGO_KEYS: readonly string[] = Object.keys(BRAND_LOGOS);

/** The mark for an IdeKey or catalogue slug, or undefined when there is none. */
export function getBrandLogo(key: string | null | undefined): BrandLogoDef | undefined {
  if (!key || !Object.hasOwn(BRAND_LOGOS, key)) return undefined;
  return BRAND_LOGOS[key];
}

/** True when `key` (an IdeKey or catalogue slug) has a brand mark. */
export function hasBrandLogo(key: string | null | undefined): boolean {
  return getBrandLogo(key) !== undefined;
}

/** The SVG fill for a mark: its brand hex, or currentColor when mono / hex-less. */
export function brandLogoFill(def: BrandLogoDef, mono = false): string {
  return mono || def.hex === null ? "currentColor" : `#${def.hex}`;
}

// WCAG relative luminance of a 6-digit hex colour.
function luminance(hex: string): number {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The dark theme's card (#101D33, docs/DESIGN.md §2.2).
const DARK_CARD_LUMINANCE = luminance("101D33");

/**
 * True for a brand hex so dark it all but vanishes on the dark-theme card
 * (under 2:1, e.g. Sentry #362D59, SQLite #003B57). Those marks switch to their
 * one-colour version (currentColor, i.e. the light ink) in dark mode only;
 * every brand concerned allows its mark in white on a dark background.
 */
export function needsDarkModeMono(def: BrandLogoDef): boolean {
  if (def.hex === null) return false;
  return (luminance(def.hex) + 0.05) / (DARK_CARD_LUMINANCE + 0.05) < 2;
}

// CSS beats the path's fill attribute, so this only applies under `.dark`.
const DARK_MONO = "dark:[&>path]:fill-current";

export interface BrandLogoProps {
  /** An IdeKey (cursor, claude-code, …) or a catalogue slug (notion, stripe, …). */
  slug: string;
  /** Width and height in px (default 20). */
  size?: number;
  /** Force currentColor (e.g. a monochrome row). Never use it to apply a theme tint. */
  mono?: boolean;
  /** Accessible name override (default: the brand's title). */
  title?: string;
  /** Hide from assistive tech when a visible label already names the brand. */
  decorative?: boolean;
  className?: string;
}

/** Renders the brand mark for `slug`, or null when there is none. */
export function BrandLogo({
  slug,
  size = 20,
  mono = false,
  title,
  decorative = false,
  className,
}: BrandLogoProps): ReactElement | null {
  const def = getBrandLogo(slug);
  if (!def) return null;
  const label = title ?? def.title;
  const fill = brandLogoFill(def, mono);
  const svgClass = !mono && needsDarkModeMono(def) ? cn(DARK_MONO, className) : className;

  // createElement rather than JSX keeps this file free of any JSX-runtime
  // assumption, so it renders the same under Next and under plain vitest.
  const glyph = createElement("path", { d: def.path, fill });
  if (decorative) {
    return createElement(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        "aria-hidden": true,
        focusable: "false",
        className: svgClass,
      },
      glyph
    );
  }
  return createElement(
    "svg",
    {
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      role: "img",
      "aria-label": label,
      className: svgClass,
    },
    createElement("title", null, label),
    glyph
  );
}
