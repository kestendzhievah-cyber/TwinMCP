import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Design-system guard (docs/DESIGN.md §9): UI colour comes from tokens only.
// Raw Tailwind palette classes (emerald-500, amber-100, sky-700, …) and
// arbitrary colour values (bg-[#C2255C], text-[rgb(…)]) bypass the "Clear
// sky" tokens and break dark mode, so any new one fails the suite.
const ROOT = join(__dirname, "..");
const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|decoration|outline|shadow|divide|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const GRADIENT = /\bbg-gradient-to-[trbl]{1,2}\b|\bbg-clip-text\b/g;
// Arbitrary colour values in class names (rule 2). No path is exempted in
// code: the files that legitimately hold hex constants (src/components/brand/**
// via the SVG `fill` attribute, opengraph-image.tsx, lib/email-layout.ts,
// lib/admin/digest-email.ts, docs/api-reference/api-reference-client.tsx) use
// them in attributes, inline styles or CSS strings, never in a `bg-[#…]`-style
// class, so this pattern does not match them.
const ARBITRARY_COLOUR =
  /\b(?:bg|text|border|ring|ring-offset|fill|stroke|from|to|via|shadow|outline|decoration|divide|placeholder|caret|accent)-\[(?:#|rgb|hsl)[^\]]*\]/g;
// Retired letterpress classes (rule 3). Their compatibility shims, the `gilt`
// token and the `sc` / `eyebrow` tracking keys are gone, so any of these would
// silently do nothing; the ban keeps them from creeping back in. `.eyebrow`,
// `.display` and `.lining` are real utilities and stay allowed. The lookarounds
// skip CSS custom properties and longer class names (`--gilt`, `x-smallcaps`).
const LEGACY_LETTERPRESS =
  /(?<![\w-])(?:smallcaps|no-smallcaps|tracking-sc|tracking-eyebrow|letterpress|rule-double(?:-ink)?|oldstyle|shadow-stack|shadow-press|font-serif|(?:text|bg|border|ring|fill|stroke|from|to|via|decoration|outline)-gilt(?:\/\d{1,3}|-foreground)?)(?![\w-])/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function walkCss(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      walkCss(full, out);
    } else if (/\.css$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("design tokens", () => {
  const files = walk(ROOT);

  it("uses no raw Tailwind palette colours in UI code", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(PALETTE);
      if (hits) offenders.push(`${relative(ROOT, file)}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("uses no arbitrary colour values in class names", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(ARBITRARY_COLOUR);
      if (hits) offenders.push(`${relative(ROOT, file)}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the arbitrary-colour pattern catches what it should", () => {
    const sample =
      'className="bg-[#C2255C] text-[rgb(1,2,3)] border-[hsl(var(--x))] ring-offset-[#fff] p-[var(--card-padding)] shadow-[0_1px_0_0]"';
    expect(sample.match(ARBITRARY_COLOUR)).toEqual([
      "bg-[#C2255C]",
      "text-[rgb(1,2,3)]",
      "border-[hsl(var(--x))]",
      "ring-offset-[#fff]",
    ]);
  });

  it("uses none of the retired letterpress classes", () => {
    const offenders: string[] = [];
    for (const file of [...files, ...walkCss(ROOT)]) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(LEGACY_LETTERPRESS);
      if (hits) offenders.push(`${relative(ROOT, file)}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("the letterpress pattern catches what it should", () => {
    const sample =
      'className="smallcaps tracking-sc text-gilt bg-gilt/10 border-gilt/50 rule-double-ink shadow-stack font-serif eyebrow display lining" style="--gilt: 0"';
    expect(sample.match(LEGACY_LETTERPRESS)).toEqual([
      "smallcaps",
      "tracking-sc",
      "text-gilt",
      "bg-gilt/10",
      "border-gilt/50",
      "rule-double-ink",
      "shadow-stack",
      "font-serif",
    ]);
  });

  it("uses no gradients or clipped-text effects", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const hits = src.match(GRADIENT);
      if (hits) offenders.push(`${relative(ROOT, file)}: ${[...new Set(hits)].join(", ")}`);
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
