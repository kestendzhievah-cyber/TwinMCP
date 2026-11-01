import Link from "next/link";
import type { Route } from "next";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import {
  describeLedgerEntry,
  formatCredit,
  formatSignedCredit,
  isUsageKind,
} from "@/lib/billing/upgrade-state";
import { cn } from "@/lib/utils";

export interface LedgerRow {
  id: string;
  kind: string;
  bucket: string;
  deltaMicros: number;
  balanceAfterMicros: number;
  units: Record<string, unknown> | null;
  note: string | null;
  /** ISO. */
  createdAt: string;
}

/**
 * The credit ledger, newest first: date, description, amount ±, balance
 * after. Server-rendered and paginated by an opaque cursor (?cursor=, from
 * lib/wallet/ledger.ts listLedger). Flush to the card edges; credits in
 * green, debits in navy.
 */
export function LedgerTable({
  entries,
  nextCursor,
  paged,
}: {
  /** null: the history could not be read. */
  entries: LedgerRow[] | null;
  nextCursor: string | null;
  /** Showing an older page (offers the way back to the newest). */
  paged: boolean;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-secondary text-brand"
          >
            <ScrollText className="h-4 w-4" />
          </span>
          History
        </CardTitle>
        <CardDescription className="sm:pl-12">
          Every change to your balance: credit in, usage out. Tool calls are charged in small
          batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {entries === null ? (
          <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
            The history could not be loaded. Refresh the page in a moment.
          </p>
        ) : entries.length === 0 ? (
          <p className="border-t border-border px-6 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Credit and usage will show up here.
          </p>
        ) : (
          <div className="border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44 pl-5 sm:pl-6">Date (UTC)</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-32 pr-5 text-right sm:pr-6">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap pl-5 text-xs text-muted-foreground sm:pl-6">
                      {formatDateTime(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn(isUsageKind(e.kind) && "text-muted-foreground")}>
                          {describeLedgerEntry(e)}
                        </span>
                        {e.bucket === "promo" && !isUsageKind(e.kind) && (
                          <Badge variant="offer">Free credit</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right font-semibold",
                        e.deltaMicros > 0 ? "text-success" : "text-foreground"
                      )}
                    >
                      {formatSignedCredit(e.deltaMicros)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-5 text-right text-muted-foreground sm:pr-6">
                      {formatCredit(e.balanceAfterMicros, { precise: false })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {(nextCursor || paged) && (
          <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 sm:px-6">
            {paged ? (
              <Link
                href={"/dashboard/billing" as Route}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <ChevronLeft aria-hidden className="h-4 w-4" />
                Newest
              </Link>
            ) : (
              <span />
            )}
            {nextCursor && (
              <Link
                href={`/dashboard/billing?cursor=${encodeURIComponent(nextCursor)}` as Route}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Older
                <ChevronRight aria-hidden className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
