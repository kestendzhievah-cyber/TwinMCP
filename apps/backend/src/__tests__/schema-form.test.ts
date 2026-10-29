import { describe, expect, it } from "vitest";
import {
  argumentsToFormValues,
  buildArguments,
  describeField,
  enumKey,
  initialFormValues,
  parseRawArguments,
  schemaToForm,
} from "@/lib/mcp/schema-form";

describe("schemaToForm", () => {
  it("describes primitive properties, required first, with defaults", () => {
    const form = schemaToForm({
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100, default: 10 },
        query: { type: "string", description: "Search text" },
        exact: { type: "boolean" },
        ratio: { type: "number" },
      },
      required: ["query"],
    });
    expect(form.rawOnly).toBe(false);
    expect(form.fields.map((f) => f.name)).toEqual(["query", "limit", "exact", "ratio"]);
    const [query, limit, exact, ratio] = form.fields;
    expect(query).toMatchObject({ kind: "string", required: true, description: "Search text" });
    expect(limit).toMatchObject({
      kind: "integer",
      required: false,
      default: 10,
      minimum: 1,
      maximum: 100,
    });
    expect(exact.kind).toBe("boolean");
    expect(ratio.kind).toBe("number");
  });

  it("uses the title as the label", () => {
    expect(describeField("q", { type: "string", title: "Query" }, false).label).toBe("Query");
    expect(describeField("q", { type: "string" }, false).label).toBe("q");
  });

  it("maps enum and const to an enum field", () => {
    expect(describeField("mode", { type: "string", enum: ["a", "b"] }, true)).toMatchObject({
      kind: "enum",
      enumValues: ["a", "b"],
    });
    expect(describeField("v", { const: 2 }, false)).toMatchObject({
      kind: "enum",
      enumValues: [2],
    });
  });

  it("maps arrays of primitives, and arrays of enums to a multi-select", () => {
    expect(
      describeField("tags", { type: "array", items: { type: "string" } }, false)
    ).toMatchObject({
      kind: "array",
      itemKind: "string",
    });
    expect(
      describeField("ids", { type: "array", items: { type: "integer" } }, false).itemKind
    ).toBe("integer");
    expect(
      describeField("sizes", { type: "array", items: { enum: ["s", "m", "l"] } }, false)
    ).toMatchObject({ kind: "array", itemKind: "string", enumValues: ["s", "m", "l"] });
  });

  it("falls back to JSON for objects, arrays of objects, unions and refs", () => {
    expect(describeField("o", { type: "object", properties: {} }, false).kind).toBe("json");
    expect(describeField("rows", { type: "array", items: { type: "object" } }, false).kind).toBe(
      "json"
    );
    expect(
      describeField("u", { anyOf: [{ type: "string" }, { type: "number" }] }, false).kind
    ).toBe("json");
    expect(describeField("r", { $ref: "#/defs/x" }, false).kind).toBe("json");
    expect(describeField("any", true, false).kind).toBe("json");
  });

  it("unwraps nullable types", () => {
    expect(describeField("n", { type: ["string", "null"] }, false)).toMatchObject({
      kind: "string",
      nullable: true,
    });
    expect(
      describeField(
        "n",
        { anyOf: [{ type: "integer" }, { type: "null" }], description: "outer" },
        false
      )
    ).toMatchObject({ kind: "integer", nullable: true, description: "outer" });
  });

  it("marks long free text as multiline", () => {
    expect(describeField("body", { type: "string" }, true).multiline).toBe(true);
    expect(describeField("name", { type: "string" }, true).multiline).toBeUndefined();
    expect(
      describeField("body", { type: "string", maxLength: 50 }, true).multiline
    ).toBeUndefined();
  });

  it("handles roots that are absent, empty or not objects", () => {
    expect(schemaToForm(undefined)).toEqual({ fields: [], rawOnly: false, allowsExtra: true });
    expect(schemaToForm({ type: "object" }).rawOnly).toBe(false);
    expect(schemaToForm({ type: "object", properties: {} }).fields).toEqual([]);
    expect(schemaToForm({ type: "string" }).rawOnly).toBe(true);
    expect(schemaToForm({ oneOf: [{ type: "object" }, { type: "array" }] }).rawOnly).toBe(true);
    expect(schemaToForm({ type: "object", additionalProperties: { type: "string" } }).rawOnly).toBe(
      true
    );
    expect(schemaToForm({ type: "object", additionalProperties: false }).allowsExtra).toBe(false);
  });

  it("accepts a properties object without an explicit type", () => {
    const form = schemaToForm({ properties: { a: { type: "string" } } });
    expect(form.fields).toHaveLength(1);
  });
});

describe("buildArguments", () => {
  const form = schemaToForm({
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 50 },
      ratio: { type: "number" },
      exact: { type: "boolean" },
      mode: { enum: ["fast", 1, true] },
      tags: { type: "array", items: { type: "string" } },
      ids: { type: "array", items: { type: "integer" } },
      sizes: { type: "array", items: { enum: ["s", "m"] } },
      filter: { type: "object" },
    },
    required: ["query"],
  });

  it("converts each kind and omits blank optional fields", () => {
    const res = buildArguments(form.fields, {
      query: "hello",
      limit: "5",
      ratio: "0.5",
      exact: "false",
      mode: enumKey(1),
      tags: "a\n\n b \n",
      ids: "1\n2",
      sizes: JSON.stringify([enumKey("m")]),
      filter: '{"x": 1}',
    });
    expect(res).toEqual({
      ok: true,
      args: {
        query: "hello",
        limit: 5,
        ratio: 0.5,
        exact: false,
        mode: 1,
        tags: ["a", " b "],
        ids: [1, 2],
        sizes: ["m"],
        filter: { x: 1 },
      },
    });
    expect(buildArguments(form.fields, { query: "q" })).toEqual({ ok: true, args: { query: "q" } });
  });

  it("keeps enum values distinct by type", () => {
    const res = buildArguments(form.fields, { query: "q", mode: enumKey(true) });
    expect(res.ok && res.args.mode).toBe(true);
    const res2 = buildArguments(form.fields, { query: "q", mode: enumKey("fast") });
    expect(res2.ok && res2.args.mode).toBe("fast");
  });

  it("reports per-field errors", () => {
    const res = buildArguments(form.fields, {
      query: "  ",
      limit: "2.5",
      ratio: "abc",
      mode: '"nope"',
      ids: "1\nx",
      filter: "{bad",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(Object.keys(res.errors).sort()).toEqual([
      "filter",
      "ids",
      "limit",
      "mode",
      "query",
      "ratio",
    ]);
    expect(res.errors.query).toBe("Required.");
    expect(res.errors.limit).toBe("Enter a whole number.");
  });

  it("enforces minimum and maximum", () => {
    const low = buildArguments(form.fields, { query: "q", limit: "0" });
    const high = buildArguments(form.fields, { query: "q", limit: "51" });
    expect(!low.ok && low.errors.limit).toBe("Must be at least 1.");
    expect(!high.ok && high.errors.limit).toBe("Must be at most 50.");
  });

  it("requires a value for a required boolean", () => {
    const f = schemaToForm({
      type: "object",
      properties: { confirm: { type: "boolean" } },
      required: ["confirm"],
    }).fields;
    expect(buildArguments(f, { confirm: "" }).ok).toBe(false);
    expect(buildArguments(f, { confirm: "true" })).toEqual({ ok: true, args: { confirm: true } });
  });
});

describe("initial values and round-trips", () => {
  const form = schemaToForm({
    type: "object",
    properties: {
      q: { type: "string", default: "hi" },
      n: { type: "integer", default: 3 },
      b: { type: "boolean", default: true },
      e: { enum: ["x", "y"], default: "y" },
      tags: { type: "array", items: { type: "string" }, default: ["a", "b"] },
      sizes: { type: "array", items: { enum: ["s", "m"] }, default: ["s"] },
      obj: { type: "object", default: { k: 1 } },
      none: { type: "string" },
    },
  });

  it("prefills schema defaults", () => {
    const v = initialFormValues(form.fields);
    expect(v).toMatchObject({ q: "hi", n: "3", b: "true", e: '"y"', tags: "a\nb", none: "" });
    expect(JSON.parse(v.sizes)).toEqual(['"s"']);
    expect(JSON.parse(v.obj)).toEqual({ k: 1 });
  });

  it("builds the defaults back into the same arguments", () => {
    const res = buildArguments(form.fields, initialFormValues(form.fields));
    expect(res).toEqual({
      ok: true,
      args: { q: "hi", n: 3, b: true, e: "y", tags: ["a", "b"], sizes: ["s"], obj: { k: 1 } },
    });
  });

  it("carries JSON-editor arguments back into the form", () => {
    const args = { q: "x", n: 7, b: false, e: "x", tags: ["t"], extra: 1 };
    const values = argumentsToFormValues(form.fields, args);
    const res = buildArguments(form.fields, values);
    expect(res).toEqual({ ok: true, args: { q: "x", n: 7, b: false, e: "x", tags: ["t"] } });
  });
});

describe("parseRawArguments", () => {
  it("accepts an object or blank", () => {
    expect(parseRawArguments('{"a":1}')).toEqual({ ok: true, args: { a: 1 } });
    expect(parseRawArguments("  ")).toEqual({ ok: true, args: {} });
  });
  it("refuses non-objects and invalid JSON", () => {
    expect(parseRawArguments("[1]").ok).toBe(false);
    expect(parseRawArguments("null").ok).toBe(false);
    expect(parseRawArguments("{").ok).toBe(false);
  });
});
