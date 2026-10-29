import { describe, it, expect } from "vitest";
import {
  FEATURE_COPY_FR,
  featureGroupLabel,
  featureRowCopy,
  featureValueLabel,
} from "@/components/pricing/comparison-table";
import { FEATURES } from "@/components/pricing/pricing-data";

describe("ComparisonTable copy", () => {
  it("translates every FEATURES row for /fr/tarifs", () => {
    for (const row of FEATURES) {
      expect(FEATURE_COPY_FR[row.label], row.label).toBeDefined();
      const fr = featureRowCopy(row, "fr");
      expect(fr.label).not.toBe("");
      // A row described in English is described in French too.
      expect(Boolean(fr.description), row.label).toBe(Boolean(row.description));
      expect(featureGroupLabel(row.group, "fr")).not.toBe("");
    }
  });

  it("keeps English untouched", () => {
    for (const row of FEATURES) {
      expect(featureRowCopy(row, "en")).toEqual({
        label: row.label,
        description: row.description,
      });
      expect(featureRowCopy(row)).toEqual(featureRowCopy(row, "en"));
    }
    expect(featureValueLabel("5,000")).toBe("5,000");
    expect(featureGroupLabel("Access")).toBe("Access");
  });

  it("translates text cells and leaves numbers and sizes alone", () => {
    for (const row of FEATURES) {
      for (const value of Object.values(row.values)) {
        if (typeof value !== "string") continue;
        const fr = featureValueLabel(value, "fr");
        if (/[A-Za-z]{3,}/.test(value) && value !== "small") {
          expect(fr, value).not.toBe(value);
        }
      }
    }
    expect(featureValueLabel("5,000", "fr")).toBe("5 000");
    expect(featureValueLabel("50", "fr")).toBe("50");
    expect(featureValueLabel("small", "fr")).toBe("small");
  });
});
