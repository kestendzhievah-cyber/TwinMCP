import Link from "next/link";
import type { Route } from "next";
import { ScrollText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
 * lib/wallet/ledger.ts listLedger). A ledger — hairlines only, flush to the
 * card edges.
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
    <Card>
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            <ScrollText className="h-4 w-4" />
          </span>
          History
        </CardTitle>
        <CardDescription className="pl-12">
          Every change to your balance: credit in, usage out. Tool calls are charged in small
          batches.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {entries === null ? (
          <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
            The history could not be loaded. Refresh the page in a moment.
          </p>
        ) : entries.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
            Nothing yet. Credit and usage will show up here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44 pl-6">Date (UTC)</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32 text-right">Amount</TableHead>
                  <TableHead className="w-32 pr-6 text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap pl-6 text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn(isUsageKind(e.kind) && "text-muted-foreground")}>
                          {describeLedgerEntry(e)}
                        </span>
                        {e.bucket === "promo" && !isUsageKind(e.kind) && (
                          <Badge variant="secondary">Free credit</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right",
                        e.deltaMicros > 0 && "text-success"
                      )}
                    >
                      {formatSignedCredit(e.deltaMicros)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap pr-6 text-right">
                      {formatCredit(e.balanceAfterMicros, { precise: false })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {(nextCursor || paged) && (
          <div className="smallcaps tracking-sc flex items-center justify-between border-t border-border px-6 py-2.5 text-xs">
            {paged ? (
              <Link
                href={"/dashboard/billing" as Route}
                className="inline-flex min-h-10 items-center text-muted-foreground hover:text-foreground"
              >
                Newest
              </Link>
            ) : (
              <span />
            )}
            {nextCursor && (
              <Link
                href={`/dashboard/billing?cursor=${encodeURIComponent(nextCursor)}` as Route}
                className="inline-flex min-h-10 items-center text-muted-foreground hover:text-foreground"
              >
                Older
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
