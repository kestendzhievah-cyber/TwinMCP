"use client";

import { Input, fieldClasses } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { enumKey, type FormField, type FormValues, type SubField } from "@/lib/mcp/schema-form";

// A Radix Select item cannot carry "" as its value: this stands for "unset".
const UNSET = "__unset__";

// Same border, focus and invalid states as the Input primitive, in mono.
export const textareaClass = cn(
  fieldClasses,
  "block resize-y py-2 font-mono text-xs leading-relaxed"
);

function inputType(field: FormField): string {
  if (field.kind === "number" || field.kind === "integer") return "number";
  if (field.format === "email") return "email";
  if (field.format === "uri" || field.format === "url") return "url";
  return "text";
}

function placeholderFor(field: FormField): string | undefined {
  switch (field.kind) {
    case "json":
      return field.skeleton !== undefined
        ? JSON.stringify(field.skeleton, null, 2)
        : "JSON value, e.g. {} or []";
    case "array":
      return `One ${field.itemKind ?? "value"} per line`;
    case "string":
      return field.format ? field.format : undefined;
    case "integer":
      return "Whole number";
    default:
      return undefined;
  }
}

function enumLabel(v: unknown): string {
  return v === null ? "null" : String(v);
}

export function ToolForm({
  fields,
  values,
  errors,
  onChange,
  disabled,
}: {
  fields: FormField[];
  values: FormValues;
  errors: Record<string, string>;
  onChange: (name: string, value: string) => void;
  disabled?: boolean;
}) {
  if (fields.length === 0) {
    return <p className="text-sm text-muted-foreground">This tool takes no arguments.</p>;
  }

  return (
    <div className="space-y-5">
      {fields.map((f) => {
        const id = `arg-${f.name}`;
        const value = values[f.name] ?? "";
        const error = errors[f.name];
        const describedBy = [f.description ? `${id}-desc` : "", error ? `${id}-err` : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <div key={f.name} className="space-y-1.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Label htmlFor={id}>{f.label}</Label>
              {f.label !== f.name && (
                <span className="font-mono text-xs text-muted-foreground">{f.name}</span>
              )}
              <span
                className={cn(
                  "text-xs",
                  f.required ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {f.required ? "required" : "optional"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {f.kind === "array" ? `${f.itemKind ?? "any"}[]` : f.kind}
              </span>
            </div>
            {f.description && (
              <p id={`${id}-desc`} className="text-xs text-muted-foreground">
                {f.description}
              </p>
            )}

            <FieldControl
              field={f}
              id={id}
              value={value}
              invalid={!!error}
              describedBy={describedBy || undefined}
              disabled={disabled}
              onChange={(v) => onChange(f.name, v)}
            />

            {f.subFields && f.subFields.length > 0 && <SubFieldList fields={f.subFields} />}

            {error && (
              <p id={`${id}-err`} className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The keys of a nested object field, under its JSON textarea. */
function SubFieldList({ fields }: { fields: SubField[] }) {
  return (
    <ul className="space-y-0.5 border-l border-border pl-3 text-xs text-muted-foreground">
      {fields.map((s) => (
        <li key={s.name} className="break-words">
          <span className="font-mono text-foreground">{s.name}</span>{" "}
          <span className="font-mono">{s.type}</span>
          {s.required && <span> · required</span>}
          {s.enumValues && (
            <span>
              {" "}
              · one of{" "}
              <span className="font-mono">{s.enumValues.map((v) => enumLabel(v)).join(", ")}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function FieldControl({
  field: f,
  id,
  value,
  invalid,
  describedBy,
  disabled,
  onChange,
}: {
  field: FormField;
  id: string;
  value: string;
  invalid: boolean;
  describedBy?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const aria = { "aria-invalid": invalid || undefined, "aria-describedby": describedBy };

  if (f.kind === "boolean" || f.kind === "enum") {
    const options =
      f.kind === "boolean"
        ? [
            { key: "true", label: "true" },
            { key: "false", label: "false" },
          ]
        : (f.enumValues ?? []).map((v) => ({ key: enumKey(v), label: enumLabel(v) }));
    return (
      <Select
        value={value === "" ? UNSET : value}
        onValueChange={(v) => onChange(v === UNSET ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full sm:w-72" {...aria}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>{f.required ? "Choose…" : "Not set"}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              <span className="font-mono text-xs">{o.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (f.kind === "array" && f.enumValues) {
    // Multi-select: the value is a JSON array of enum keys.
    let picked: string[] = [];
    try {
      const parsed: unknown = value ? JSON.parse(value) : [];
      if (Array.isArray(parsed)) picked = parsed.filter((k): k is string => typeof k === "string");
    } catch {
      picked = [];
    }
    const toggle = (key: string) => {
      const next = picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key];
      onChange(next.length ? JSON.stringify(next) : "");
    };
    return (
      <div
        id={id}
        role="group"
        aria-describedby={describedBy}
        className="flex flex-wrap gap-x-5 gap-y-2"
      >
        {f.enumValues.map((v) => {
          const key = enumKey(v);
          return (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={picked.includes(key)}
                onChange={() => toggle(key)}
                disabled={disabled}
              />
              <span className="font-mono text-xs">{enumLabel(v)}</span>
            </label>
          );
        })}
      </div>
    );
  }

  if (f.kind === "json" || f.kind === "array" || f.multiline) {
    return (
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={f.kind === "json" ? (f.skeleton !== undefined ? 7 : 5) : 4}
        spellCheck={false}
        placeholder={placeholderFor(f)}
        disabled={disabled}
        className={textareaClass}
        {...aria}
      />
    );
  }

  return (
    <Input
      id={id}
      type={inputType(f)}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholderFor(f)}
      step={f.kind === "integer" ? 1 : f.kind === "number" ? "any" : undefined}
      min={f.minimum}
      max={f.maximum}
      disabled={disabled}
      className={cn((f.kind === "number" || f.kind === "integer") && "tabular-nums sm:w-72")}
      {...aria}
    />
  );
}
