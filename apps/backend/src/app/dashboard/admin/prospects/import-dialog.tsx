"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// CSV columns we understand, mapped from flexible (FR/EN) header names.
type Field = "company" | "contactName" | "email" | "role" | "source" | "estimatedValueEur";

const HEADER_MAP: Record<string, Field> = {
  company: "company",
  entreprise: "company",
  société: "company",
  societe: "company",
  contact: "contactName",
  contactname: "contactName",
  nom: "contactName",
  name: "contactName",
  email: "email",
  mail: "email",
  "e-mail": "email",
  courriel: "email",
  role: "role",
  rôle: "role",
  poste: "role",
  title: "role",
  fonction: "role",
  source: "source",
  value: "estimatedValueEur",
  valeur: "estimatedValueEur",
  montant: "estimatedValueEur",
  estimatedvalueeur: "estimatedValueEur",
};

// Positional order assumed when the file has no recognizable header row.
const POSITIONAL: Field[] = [
  "company",
  "contactName",
  "email",
  "role",
  "source",
  "estimatedValueEur",
];

type ParsedRow = Partial<Record<Field, string>>;

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === "," || c === ";" || c === "\t") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function toRows(matrix: string[][]): ParsedRow[] {
  if (!matrix.length) return [];
  const first = matrix[0].map((c) => c.trim().toLowerCase());
  const hasHeader = first.some((c) => c in HEADER_MAP);
  const cols: (Field | null)[] = hasHeader ? first.map((c) => HEADER_MAP[c] ?? null) : POSITIONAL;
  const dataRows = hasHeader ? matrix.slice(1) : matrix;
  return dataRows
    .map((cells) => {
      const r: ParsedRow = {};
      cells.forEach((val, i) => {
        const key = cols[i];
        if (key) r[key] = val.trim();
      });
      return r;
    })
    .filter((r) => r.company);
}

export function ImportDialog({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);

  const rows = useMemo(() => toRows(parseCsv(text)), [text]);

  async function runImport() {
    if (!rows.length) return;
    setImporting(true);
    try {
      const res = await fetch("/api/v2/admin/prospects/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { inserted: number; skipped: number };
      toast.success(
        `${data.inserted} prospect${data.inserted > 1 ? "s" : ""} importé${data.inserted > 1 ? "s" : ""}` +
          (data.skipped > 0 ? ` · ${data.skipped} ignoré(s)` : "")
      );
      setText("");
      setOpen(false);
      onImported();
    } catch {
      toast.error("Échec de l'import.");
    } finally {
      setImporting(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setText(await file.text());
    e.target.value = "";
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="h-3.5 w-3.5" />
        Importer
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importer des prospects (CSV)</DialogTitle>
            <DialogDescription>
              Collez un CSV ou choisissez un fichier. Colonnes reconnues : entreprise, contact,
              email, rôle, source, valeur. Une ligne d'en-tête est optionnelle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={
                "entreprise,contact,email,rôle,source,valeur\nAcme SAS,Marie Dupont,marie@acme.fr,CTO,LinkedIn,5000"
              }
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {rows.length > 0
                ? `${rows.length} prospect(s) prêt(s) à importer.`
                : "Aucune ligne valide détectée (une entreprise est requise par ligne)."}
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={importing}>
              Annuler
            </Button>
            <Button onClick={() => void runImport()} disabled={importing || rows.length === 0}>
              {importing ? "Import…" : `Importer ${rows.length || ""}`.trim()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
