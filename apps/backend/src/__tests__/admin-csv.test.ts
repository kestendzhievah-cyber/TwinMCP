import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "../lib/admin/csv";

// The Free-users export is opened in spreadsheets and emailing tools: cells must
// be quoted correctly and must never be able to run as a formula.
describe("csvCell", () => {
  it("leaves plain values untouched", () => {
    expect(csvCell("jane@example.com")).toBe("jane@example.com");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
  });

  it("quotes separators, quotes and newlines", () => {
    expect(csvCell("Doe, Jane")).toBe('"Doe, Jane"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("neutralizes formula injection", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("+33")).toBe("'+33");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });
});

describe("toCsv", () => {
  it("starts with a BOM and uses CRLF line endings", () => {
    const out = toCsv(["a", "b"], [[1, "x"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toBe("﻿a,b\r\n1,x\r\n");
  });
});
