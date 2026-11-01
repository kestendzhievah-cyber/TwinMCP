"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isValidSecretName,
  normalizeSecretName,
  parseSecretRef,
  secretRef,
} from "@/lib/vault/refs";

// A config field for a secret value (contract D6): either paste the value, or
// pick a saved secret from the vault, which writes the reference
// `{{secret:NAME}}` instead of the value. The reference is resolved
// server-side when the MCP starts, so the same token can feed many MCPs and be
// rotated in one place (Settings > Secrets).

const SECRETS_HREF = "/dashboard/settings/secrets";

// One fetch of the names per page, shared by every SecretField on it.
let namesPromise: Promise<string[]> | null = null;
function loadSecretNames(force = false): Promise<string[]> {
  if (!namesPromise || force) {
    namesPromise = fetch("/api/v2/secrets", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { secrets?: Array<{ name: string }> };
        return (data.secrets ?? []).map((s) => s.name);
      })
      .catch((err) => {
        namesPromise = null; // retry on the next open
        throw err;
      });
  }
  return namesPromise;
}

type Mode = "paste" | "saved";

export interface SecretFieldProps {
  id?: string;
  /** The config value: a pasted secret, a `{{secret:NAME}}` reference, or "". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Suggested name when saving a pasted value to the vault (e.g. the config key). */
  suggestedName?: string;
  /** For an edit form where the stored value is masked: hint that empty keeps it. */
  keepExistingHint?: boolean;
}

export function SecretField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  suggestedName,
  keepExistingHint,
}: SecretFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const selectedName = parseSecretRef(value);
  const [mode, setMode] = useState<Mode>(selectedName ? "saved" : "paste");
  const [names, setNames] = useState<string[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState(() => normalizeSecretName(suggestedName ?? ""));

  // A value set from outside (e.g. the form loads a saved reference) picks the mode.
  useEffect(() => {
    if (parseSecretRef(value)) setMode("saved");
  }, [value]);

  useEffect(() => {
    if (mode !== "saved" || names !== null) return;
    let cancelled = false;
    loadSecretNames()
      .then((n) => {
        if (!cancelled) {
          setNames(n);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, names]);

  function switchTo(next: Mode) {
    if (next === mode) return;
    setMode(next);
    // Never carry a reference into the paste box, nor a pasted value into a pick.
    if (next === "paste" && selectedName) onChange("");
    if (next === "saved" && !selectedName) onChange("");
  }

  async function saveToVault() {
    const name = normalizeSecretName(saveName);
    if (!isValidSecretName(name)) {
      toast.error("Name: 1 to 64 characters, A-Z, 0-9 and _ only.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v2/secrets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, value }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        toast.error(err.message ?? "Could not save the secret");
        return;
      }
      setNames(await loadSecretNames(true).catch(() => [name]));
      setMode("saved");
      setSaveOpen(false);
      onChange(secretRef(name));
      toast.success(`Saved as ${name}`);
    } finally {
      setSaving(false);
    }
  }

  const missingSelected = !!selectedName && names !== null && !names.includes(selectedName);

  return (
    <div className="space-y-2">
      <div role="group" aria-label="Secret source" className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant={mode === "paste" ? "default" : "ghost"}
          aria-pressed={mode === "paste"}
          onClick={() => switchTo("paste")}
          disabled={disabled}
        >
          Paste value
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "saved" ? "default" : "ghost"}
          aria-pressed={mode === "saved"}
          onClick={() => switchTo("saved")}
          disabled={disabled}
        >
          <KeyRound aria-hidden />
          Use saved secret
        </Button>
      </div>

      {mode === "paste" ? (
        <>
          <Input
            id={fieldId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={selectedName ? "" : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder ?? (keepExistingHint ? "Leave empty to keep" : "")}
            disabled={disabled}
          />
          {value && !selectedName && !saveOpen && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              onClick={() => setSaveOpen(true)}
              disabled={disabled}
            >
              Save to my secrets to reuse it in other MCPs
            </button>
          )}
          {saveOpen && (
            <div className="flex flex-wrap items-center gap-2 border border-border p-2">
              <label htmlFor={`${fieldId}-save-name`} className="sr-only">
                Secret name
              </label>
              <Input
                id={`${fieldId}-save-name`}
                className="h-8 min-w-0 flex-1 font-mono text-xs"
                placeholder="GITHUB_TOKEN"
                maxLength={64}
                value={saveName}
                onChange={(e) => setSaveName(normalizeSecretName(e.target.value))}
              />
              <Button type="button" size="sm" onClick={saveToVault} disabled={saving || !saveName}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSaveOpen(false)}>
                Cancel
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <select
            id={fieldId}
            value={selectedName ?? ""}
            onChange={(e) => onChange(e.target.value ? secretRef(e.target.value) : "")}
            disabled={disabled || names === null}
            className="h-10 w-full border border-input bg-card px-3 font-mono text-sm text-foreground shadow-inner transition-colors focus-visible:border-foreground focus-visible:outline-none disabled:opacity-50 [&>option]:bg-card [&>option]:text-foreground"
          >
            <option value="">
              {names === null ? (loadError ? "Could not load secrets" : "Loading…") : "Choose…"}
            </option>
            {missingSelected && selectedName && (
              <option value={selectedName}>{selectedName} (missing)</option>
            )}
            {(names ?? []).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {missingSelected ? (
            <p className="border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              No secret named {selectedName} yet: this MCP will not start until you add it.
            </p>
          ) : names !== null && names.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No saved secrets yet. Paste the value instead, or{" "}
              <a
                href={SECRETS_HREF}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                add one in Settings
              </a>
              .
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Stored encrypted and filled in when the MCP starts.{" "}
              <a
                href={SECRETS_HREF}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4"
              >
                Manage secrets
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
