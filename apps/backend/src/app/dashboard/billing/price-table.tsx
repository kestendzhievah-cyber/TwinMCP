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
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle as="h2" className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand"
          >
            <Tag className="h-4 w-4" />
          </span>
          What costs what
        </CardTitle>
        <CardDescription className="sm:pl-12">
          You pay for tool calls and for the CPU time your servers actually use.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableBody>
            {rows.map(([label, value]) => (
              <TableRow key={label}>
                <TableCell className="pl-5 sm:pl-6">{label}</TableCell>
                <TableCell className="pr-5 text-right font-semibold sm:pr-6">{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="space-y-3 border-t border-border px-5 py-4 text-sm sm:px-6">
          <p className="text-sm font-semibold text-foreground">
            What {formatCredit(eurToMicros(buys.amountEur))} buys, spent on one thing only
          </p>
          <ul className="list-disc space-y-1 pl-5 tabular-nums marker:text-brand">
            {buys.examples.en.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {table.notes.en.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
