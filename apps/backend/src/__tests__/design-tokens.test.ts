import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Design-system guard (docs/DESIGN.md §1): UI colour comes from tokens only.
// Raw Tailwind palette classes (emerald-500, amber-100, sky-700, …) bypass the
// bone/ink theme and break dark mode, so any new one fails the suite.
const ROOT = join(__dirname, "..");
const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|decoration|outline|shadow|divide|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const GRADIENT = /\bbg-gradient-to-[trbl]{1,2}\b|\bbg-clip-text\b/g;

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
