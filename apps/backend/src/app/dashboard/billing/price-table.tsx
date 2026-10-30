import { Tag } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatCredit } from "@/lib/billing/upgrade-state";
import { eurToMicros, type PublicPriceTable, type WhatItBuys } from "@/lib/wallet/pricing";

/**
 * "What costs what": the live price list (lib/wallet/pricing.ts
 * publicPriceTable, env-driven) and what the sign-up credit buys. Every
 * figure comes from the price list; nothing is typed here.
 */
export function PriceTable({ table, buys }: { table: PublicPriceTable; buys: WhatItBuys }) {
  const price = (eur: number) => formatCredit(eurToMicros(eur));
  const rows: Array<[string, string]> = [
    ["1,000 tool calls", price(table.per1000CallsEur)],
    ["1 active CPU-hour · small box", price(table.cpuHourEur.small)],
    ["Medium and large boxes", "the compute cost the box reports"],
  ];
  return (
    <Card>
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            <Tag className="h-4 w-4" />
          </span>
          What costs what
        </CardTitle>
        <CardDescription className="pl-12">
          You pay for tool calls and for the CPU time your servers actually use.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell className="pl-6">{label}</TableCell>
                <TableCell className="pr-6 text-right font-medium">{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="space-y-3 border-t border-border px-6 py-4 text-sm">
          <p className="smallcaps tracking-sc text-xs text-muted-foreground">
            What {formatCredit(eurToMicros(buys.amountEur))} buys, spent on one thing only
          </p>
          <ul className="lining list-disc space-y-1 pl-5">
            {buys.examples.en.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs italic text-muted-foreground">
            {table.notes.en.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
