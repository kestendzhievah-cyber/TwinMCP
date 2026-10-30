import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// Every user-facing price on the dashboard, in emails and in the billing
// components comes from lib/wallet/pricing.ts (formatEur, formatEurAmount,
// minTopupLabel…), never a hand-typed "€10" that would drift when the price
// list changes. Comments are stripped first: they may quote examples.
const SRC = join(__dirname, "..");
const ROOTS = [
  "app/dashboard",
  "app/onboarding",
  "components/billing",
  "components/onboarding",
  "lib/email.ts",
  "lib/billing/upgrade-state.ts",
];

function files(path: string): string[] {
  const abs = join(SRC, path);
  if (statSync(abs).isFile()) return [abs];
  return readdirSync(abs).flatMap((name) => {
    const child = join(path, name);
    if (statSync(join(SRC, child)).isDirectory()) return files(child);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [join(SRC, child)] : [];
  });
}

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("price literals", () => {
  it("no hand-typed euro amount in the dashboard, billing UI, onboarding or emails", () => {
    const offenders: string[] = [];
    for (const file of ROOTS.flatMap(files)) {
      const code = stripComments(readFileSync(file, "utf8"));
      code.split("\n").forEach((line, i) => {
        // "€10", "€ 10", "€{amount}", "€${amount}": a price not formatted by pricing.ts.
        if (/€\s?\d|€\{|€\$\{/.test(line))
          offenders.push(`${relative(SRC, file)}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
