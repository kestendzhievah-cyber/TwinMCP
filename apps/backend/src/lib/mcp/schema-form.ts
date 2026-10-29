// JSON Schema (an MCP tool's `inputSchema`) → form field descriptors, and the
// form values back → the `arguments` object of a `tools/call`.
//
// Used by the dashboard tool playground (/dashboard/servers/[id]/try). The
// generated form covers the shapes MCP tools actually use: string, number,
// integer, boolean, enum, arrays of primitives. Anything richer (nested
// objects, arrays of objects, unions, $ref) falls back to a JSON textarea for
// that one field, and a schema the form cannot describe at all (no object
// root) puts the whole form in raw-JSON mode.
//
// Form values are kept as strings (what text inputs and selects hold), so the
// conversion and its validation live here, not in the component.
//
// Pure and client-safe: no imports, no I/O. Unit-tested in
// src/__tests__/schema-form.test.ts.

export type PrimitiveKind = "string" | "number" | "integer" | "boolean";

export type FieldKind = PrimitiveKind | "enum" | "array" | "json";

export type EnumValue = string | number | boolean | null;

export interface FormField {
  /** The property name, the key in `arguments`. */
  name: string;
  /** Human label: the schema `title`, else the property name. */
  label: string;
  kind: FieldKind;
  required: boolean;
  description?: string;
  /** The schema `default`, as given (not stringified). */
  default?: unknown;
  /** kind "enum": the allowed values. kind "array": the allowed item values. */
  enumValues?: EnumValue[];
  /** kind "array": the type of each item. */
  itemKind?: PrimitiveKind;
  /** kind "string": the JSON Schema `format` (uri, email, date-time…). */
  format?: string;
  /** kind "string": render a multi-line input (long text expected). */
  multiline?: boolean;
  minimum?: number;
  maximum?: number;
  /** The schema allows null for this field (type ["string", "null"]…). */
  nullable?: boolean;
  /**
   * kind "json" on an object (or an array of objects): a starting value built
   * from the schema — required keys (all keys when none is required), with
   * their default, first enum value or an empty value of their type.
   */
  skeleton?: unknown;
  /** kind "json" on an object (or an array of objects): its properties, for a hint. */
  subFields?: SubField[];
}

/** One property of a nested object, shown under its JSON textarea. */
export interface SubField {
  name: string;
  /** "string", "integer", "object", "string[]", "a | b"… */
  type: string;
  required: boolean;
  /** Allowed values, when the property is an enum. */
  enumValues?: EnumValue[];
}

export interface SchemaForm {
  fields: FormField[];
  /**
   * The schema is not an object with properties the form can render (absent,
   * a non-object root, a root union): edit the whole `arguments` as JSON.
   * An object schema with no properties is NOT raw-only: the tool takes no
   * arguments and the form is simply empty.
   */
  rawOnly: boolean;
  /** The root allows properties beyond `fields` (additionalProperties). */
  allowsExtra: boolean;
}

/** One form value per field: text for most kinds, "true" | "false" | "" for booleans. */
export type FormValues = Record<string, string>;

type Schema = Record<string, unknown>;

const PRIMITIVES: readonly PrimitiveKind[] = ["string", "number", "integer", "boolean"];

function isObject(v: unknown): v is Schema {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isPrimitiveKind(v: unknown): v is PrimitiveKind {
  return typeof v === "string" && (PRIMITIVES as readonly string[]).includes(v);
}

function isEnumValue(v: unknown): v is EnumValue {
  return v === null || ["string", "number", "boolean"].includes(typeof v);
}

/**
 * Collapse `type: [T, "null"]` and `anyOf/oneOf: [{…}, {type: "null"}]` to the
 * single non-null schema, marking it nullable. Anything else is returned as is.
 */
function unwrapNullable(schema: Schema): { schema: Schema; nullable: boolean } {
  const t = schema.type;
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== "null");
    if (nonNull.length === 1) {
      return { schema: { ...schema, type: nonNull[0] }, nullable: nonNull.length < t.length };
    }
    return { schema, nullable: t.includes("null") };
  }
  for (const key of ["anyOf", "oneOf"] as const) {
    const options = schema[key];
    if (!Array.isArray(options)) continue;
    const nonNull = options.filter((o) => !(isObject(o) && o.type === "null"));
    if (nonNull.length === 1 && isObject(nonNull[0]) && nonNull.length < options.length) {
      // Keep the outer title/description/default over the inner ones.
      const { [key]: _drop, ...outer } = schema;
      void _drop;
      return { schema: { ...nonNull[0], ...outer }, nullable: true };
    }
  }
  return { schema, nullable: false };
}

/** The allowed values of a schema (`enum`, or a single `const`), else null. */
function enumOf(schema: Schema): EnumValue[] | null {
  if (Array.isArray(schema.enum) && schema.enum.length > 0 && schema.enum.every(isEnumValue)) {
    return schema.enum as EnumValue[];
  }
  if ("const" in schema && isEnumValue(schema.const)) return [schema.const as EnumValue];
  return null;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

/** Describe one property. Never throws: an unknown shape becomes a JSON field. */
export function describeField(name: string, rawSchema: unknown, required: boolean): FormField {
  const base: FormField = { name, label: name, kind: "json", required };
  if (!isObject(rawSchema)) return base; // `true`, missing: anything goes
  const { schema, nullable } = unwrapNullable(rawSchema);

  const field: FormField = { ...base };
  if (typeof schema.title === "string" && schema.title.trim()) field.label = schema.title.trim();
  if (typeof schema.description === "string" && schema.description.trim()) {
    field.description = schema.description.trim();
  }
  if ("default" in schema) field.default = schema.default;
  if (nullable) field.nullable = true;

  const values = enumOf(schema);
  if (values) return { ...field, kind: "enum", enumValues: values };

  const type = schema.type;
  if (isPrimitiveKind(type)) {
    field.kind = type;
    if (type === "number" || type === "integer") {
      const min = num(schema.minimum);
      const max = num(schema.maximum);
      if (min !== undefined) field.minimum = min;
      if (max !== undefined) field.maximum = max;
    }
    if (type === "string") {
      if (typeof schema.format === "string") field.format = schema.format;
      const maxLength = num(schema.maxLength);
      if (maxLength === undefined || maxLength > 200) {
        // Long free text (a body, a query, a prompt) reads better multi-line;
        // short bounded strings and formatted ones stay single-line.
        if (!field.format && looksLong(name, field.description)) field.multiline = true;
      }
    }
    return field;
  }

  if (type === "array" && isObject(schema.items)) {
    const { schema: items } = unwrapNullable(schema.items);
    const itemValues = enumOf(items);
    if (itemValues && itemValues.every((v) => v !== null)) {
      const itemKind = kindOfValues(itemValues);
      if (itemKind) return { ...field, kind: "array", itemKind, enumValues: itemValues };
    }
    if (isPrimitiveKind(items.type)) return { ...field, kind: "array", itemKind: items.type };
  }

  // object, array of objects, unions, $ref → JSON textarea, with a skeleton
  // and the list of sub-fields when the shape is known.
  const objectSchema =
    type === "array" && isObject(schema.items) ? unwrapNullable(schema.items).schema : schema;
  if (isObjectSchema(objectSchema)) {
    const subFields = describeSubFields(objectSchema);
    if (subFields.length > 0) field.subFields = subFields;
    field.skeleton = jsonSkeleton(schema);
  }
  return field;
}

function isObjectSchema(schema: Schema): boolean {
  return schema.type === "object" || (schema.type === undefined && isObject(schema.properties));
}

const MAX_SKELETON_DEPTH = 4;

/** A short type label of a property schema: "string", "integer[]", "a | b", "object". */
export function schemaTypeLabel(raw: unknown): string {
  if (!isObject(raw)) return "any";
  const { schema, nullable } = unwrapNullable(raw);
  let label: string;
  if (enumOf(schema)) label = "enum";
  else if (Array.isArray(schema.type)) label = schema.type.join(" | ");
  else if (schema.type === "array") {
    label = `${isObject(schema.items) ? schemaTypeLabel(schema.items) : "any"}[]`;
  } else if (typeof schema.type === "string") label = schema.type;
  else if (isObject(schema.properties)) label = "object";
  else if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const options = (schema.anyOf ?? schema.oneOf) as unknown[];
    label = options.map((o) => schemaTypeLabel(o)).join(" | ");
  } else label = "any";
  return nullable && !label.includes("null") ? `${label} | null` : label;
}

/** The properties of an object schema (required first), for the sub-field hint. */
export function describeSubFields(schema: Schema): SubField[] {
  const props = isObject(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((r) => typeof r === "string") : []
  );
  const out: SubField[] = Object.entries(props).map(([name, s]) => {
    const sub: SubField = { name, type: schemaTypeLabel(s), required: required.has(name) };
    if (isObject(s)) {
      const values = enumOf(unwrapNullable(s).schema);
      if (values) sub.enumValues = values;
    }
    return sub;
  });
  out.sort((a, b) => Number(b.required) - Number(a.required));
  return out;
}

/**
 * A starting JSON value for a schema: its default, else its first enum value,
 * else an empty value of its type; objects get their required keys (every key
 * when none is required), arrays of objects one skeleton item. Pure.
 */
export function jsonSkeleton(raw: unknown, depth = 0): unknown {
  if (!isObject(raw)) return null;
  const { schema } = unwrapNullable(raw);
  if ("default" in schema) return schema.default;
  const values = enumOf(schema);
  if (values) return values[0] ?? null;
  if (isObjectSchema(schema)) {
    if (depth >= MAX_SKELETON_DEPTH) return {};
    const props = isObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((r): r is string => typeof r === "string" && r in props)
      : [];
    const keys = required.length > 0 ? required : Object.keys(props);
    const out: Record<string, unknown> = {};
    for (const key of keys) out[key] = jsonSkeleton(props[key], depth + 1);
    return out;
  }
  switch (schema.type) {
    case "array": {
      if (depth >= MAX_SKELETON_DEPTH || !isObject(schema.items)) return [];
      const items = unwrapNullable(schema.items).schema;
      return isObjectSchema(items) ? [jsonSkeleton(items, depth + 1)] : [];
    }
    case "string":
      return "";
    case "number":
    case "integer":
      return num(schema.minimum) ?? 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

/** The one primitive kind every value shares, or null. */
function kindOfValues(values: EnumValue[]): PrimitiveKind | null {
  const kinds = new Set(
    values.map((v) =>
      typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v
    )
  );
  if (kinds.size === 1) {
    const [k] = [...kinds];
    return isPrimitiveKind(k) ? k : null;
  }
  if (kinds.size === 2 && kinds.has("integer") && kinds.has("number")) return "number";
  return null;
}

const LONG_TEXT_NAME =
  /^(body|content|text|message|prompt|query|sql|code|script|description|markdown|html|input)$/i;

function looksLong(name: string, description?: string): boolean {
  if (LONG_TEXT_NAME.test(name)) return true;
  return !!description && /\b(multi-?line|markdown|body of|full text)\b/i.test(description);
}

/**
 * Describe a tool's `inputSchema` as form fields, in the schema's property
 * order, required ones first.
 */
export function schemaToForm(inputSchema: unknown): SchemaForm {
  if (!isObject(inputSchema))
    return { fields: [], rawOnly: inputSchema !== undefined, allowsExtra: true };
  const { schema } = unwrapNullable(inputSchema);
  const isObjectRoot =
    schema.type === "object" || (schema.type === undefined && isObject(schema.properties));
  if (!isObjectRoot) return { fields: [], rawOnly: true, allowsExtra: true };

  const props = isObject(schema.properties) ? schema.properties : {};
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter((r) => typeof r === "string") : []
  );
  const fields = Object.entries(props).map(([name, s]) =>
    describeField(name, s, required.has(name))
  );
  fields.sort((a, b) => Number(b.required) - Number(a.required));
  const allowsExtra = schema.additionalProperties !== false;
  // An object root with no declared properties but open additionalProperties
  // (a free-form map) is only usable as JSON.
  const rawOnly = fields.length === 0 && isObject(schema.additionalProperties);
  return { fields, rawOnly, allowsExtra };
}

/** Stringify a value for a text input (arrays: one item per line). */
function toText(field: FormField, value: unknown): string {
  if (value === undefined) return "";
  if (field.kind === "boolean") return value === true ? "true" : value === false ? "false" : "";
  if (field.kind === "enum") return enumKey(value as EnumValue);
  if (field.kind === "array" && Array.isArray(value)) {
    if (field.enumValues) return JSON.stringify(value.map((v) => enumKey(v as EnumValue)));
    return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("\n");
  }
  if (field.kind === "json") return JSON.stringify(value, null, 2);
  if (value === null) return "";
  return String(value);
}

/**
 * Stable string key for an enum value, used as a <select> option value:
 * the JSON text, so "1" and 1 (or "true" and true) stay distinct.
 */
export function enumKey(value: EnumValue): string {
  return JSON.stringify(value);
}

/**
 * Starting values: each field's schema default, else empty — except a
 * required nested object, which starts from its skeleton (an optional one
 * shows it as the placeholder instead, so it is not sent unless edited).
 */
export function initialFormValues(fields: FormField[]): FormValues {
  const out: FormValues = {};
  for (const f of fields) {
    const start =
      f.default === undefined && f.kind === "json" && f.required && f.skeleton !== undefined
        ? f.skeleton
        : f.default;
    out[f.name] = toText(f, start);
  }
  return out;
}

export type BuildResult =
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; errors: Record<string, string> };

function parseNumber(text: string, integer: boolean): number | string {
  const n = Number(text.trim());
  if (text.trim() === "" || !Number.isFinite(n)) return "Enter a number.";
  if (integer && !Number.isInteger(n)) return "Enter a whole number.";
  return n;
}

function parseItem(kind: PrimitiveKind, text: string): unknown | { error: string } {
  if (kind === "string") return text;
  if (kind === "boolean") {
    if (text === "true") return true;
    if (text === "false") return false;
    return { error: `"${text}" is not true or false.` };
  }
  const n = parseNumber(text, kind === "integer");
  return typeof n === "string" ? { error: `"${text}": ${n.toLowerCase()}` } : n;
}

function isItemError(v: unknown): v is { error: string } {
  return isObject(v) && typeof v.error === "string" && Object.keys(v).length === 1;
}

/** Convert one field's text to its JSON value; undefined = omitted. */
function convert(field: FormField, raw: string): { value?: unknown; error?: string } {
  const text = raw ?? "";
  const empty = text.trim() === "";
  // Blank optional fields are omitted so the tool applies its own defaults.
  if (empty) return field.required ? { error: "Required." } : {};
  switch (field.kind) {
    case "string":
      return { value: text };
    case "number":
    case "integer": {
      const n = parseNumber(text, field.kind === "integer");
      if (typeof n === "string") return { error: n };
      if (field.minimum !== undefined && n < field.minimum) {
        return { error: `Must be at least ${field.minimum}.` };
      }
      if (field.maximum !== undefined && n > field.maximum) {
        return { error: `Must be at most ${field.maximum}.` };
      }
      return { value: n };
    }
    case "boolean":
      if (text === "true") return { value: true };
      if (text === "false") return { value: false };
      return { error: "Choose true or false." };
    case "enum": {
      const match = field.enumValues?.find((v) => enumKey(v) === text);
      return match === undefined ? { error: "Choose one of the listed values." } : { value: match };
    }
    case "array": {
      if (field.enumValues) {
        // Multi-select: a JSON array of enum keys.
        let keys: unknown;
        try {
          keys = JSON.parse(text);
        } catch {
          return { error: "Invalid selection." };
        }
        if (!Array.isArray(keys)) return { error: "Invalid selection." };
        const picked = field.enumValues.filter((v) => keys.includes(enumKey(v)));
        if (picked.length === 0) return field.required ? { error: "Required." } : {};
        return { value: picked };
      }
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      const kind = field.itemKind ?? "string";
      const items: unknown[] = [];
      for (const line of lines) {
        const item = parseItem(kind, kind === "string" ? line : line.trim());
        if (isItemError(item)) return { error: item.error };
        items.push(item);
      }
      return { value: items };
    }
    case "json":
    default:
      try {
        return { value: JSON.parse(text) };
      } catch {
        return { error: "Invalid JSON." };
      }
  }
}

/**
 * Turn form values into a `tools/call` `arguments` object. Empty optional
 * fields are omitted (the tool applies its own defaults); empty required ones
 * and unparseable values are reported per field.
 */
export function buildArguments(fields: FormField[], values: FormValues): BuildResult {
  const args: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    const { value, error } = convert(f, values[f.name] ?? "");
    if (error) errors[f.name] = error;
    else if (value !== undefined) args[f.name] = value;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, args };
}

/**
 * Parse the raw-JSON editor: it must hold a JSON object (or be blank, meaning
 * no arguments).
 */
export function parseRawArguments(
  text: string
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
  if (text.trim() === "") return { ok: true, args: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : "parse error"}`,
    };
  }
  if (!isObject(parsed)) return { ok: false, error: "Arguments must be a JSON object { … }." };
  return { ok: true, args: parsed };
}

/**
 * Best-effort inverse of buildArguments, to carry values from the raw-JSON
 * editor back into the form. Unknown keys are dropped (they stay in the JSON).
 */
export function argumentsToFormValues(
  fields: FormField[],
  args: Record<string, unknown>
): FormValues {
  const out: FormValues = {};
  for (const f of fields) out[f.name] = toText(f, args[f.name]);
  return out;
}
