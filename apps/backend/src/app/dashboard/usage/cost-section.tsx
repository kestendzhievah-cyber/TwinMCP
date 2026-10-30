import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { Euro } from "lucide-react";
import { getDb } from "@/db";
import { creditLedger } from "@/db/schema/wallet";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fillCostDays, formatCredit, type DailyCost } from "@/lib/billing/upgrade-state";

const DAYS = 30;
const DAY_MS = 86_400_000;

/** Per-UTC-day usage debits of the last DAYS days, from the credit ledger. */
async function loadDailyCost(userId: string, now: Date): Promise<DailyCost[] | null> {
  const since = new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS - (DAYS - 1) * DAY_MS);
  const day = sql<string>`to_char(${creditLedger.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  try {
    const rows = await getDb()
      .select({
        day,
        calls: sql<string>`coalesce(-sum(${creditLedger.deltaMicros}) filter (where ${creditLedger.kind} = 'usage_tool_call'), 0)::text`,
        compute: sql<string>`coalesce(-sum(${creditLedger.deltaMicros}) filter (where ${creditLedger.kind} = 'usage_compute'), 0)::text`,
      })
      .from(creditLedger)
      .where(
        and(
          eq(creditLedger.userId, userId),
          inArray(creditLedger.kind, ["usage_tool_call", "usage_compute"]),
          gte(creditLedger.createdAt, since)
        )
      )
      .groupBy(day);
    return fillCostDays(
      rows.map((r) => ({
        day: r.day,
        toolCallsMicros: Number(r.calls) || 0,
        computeMicros: Number(r.compute) || 0,
      })),
      now,
      DAYS
    );
  } catch (err) {
    console.warn("[usage] daily cost unavailable:", err);
    return null;
  }
}

/**
 * Cost in euros per day (tool calls + compute), straight from the credit
 * ledger: the same debits as the Credits page history, summed per UTC day.
 * Server component; a read failure hides the figures instead of showing €0.
 */
export async function CostSection({ userId }: { userId: string }) {
  const now = new Date();
  const days = await loadDailyCost(userId, now);
  const eur = (m: number) => formatCredit(m, { precise: false });

  return (
    <Card>
      <CardHeader className="border-b border-border px-6 py-4">
        <CardTitle className="lining flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center border border-border text-muted-foreground">
            <Euro className="h-4 w-4" />
          </span>
          Cost per day · {DAYS}d
        </CardTitle>
        <CardDescription className="pl-12">
          What your usage took from your credit each day (UTC): tool calls and server CPU time.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {days === null ? (
          <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
            Costs could not be loaded. Refresh the page in a moment.
          </p>
        ) : (
          <CostBody days={days} eur={eur} />
        )}
      </CardContent>
    </Card>
  );
}

function CostBody({ days, eur }: { days: DailyCost[]; eur: (m: number) => string }) {
  const totals = days.map((d) => d.toolCallsMicros + d.computeMicros);
  const sum = totals.reduce((a, b) => a + b, 0);
  const calls = days.reduce((a, d) => a + d.toolCallsMicros, 0);
  const compute = days.reduce((a, d) => a + d.computeMicros, 0);
  const max = Math.max(1, ...totals);
  const spent = days.filter((d) => d.toolCallsMicros + d.computeMicros > 0).reverse();

  if (sum === 0) {
    return (
      <p className="px-6 py-8 text-center text-sm italic text-muted-foreground">
        No usage charged in the last {days.length} days.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2 p-6">
        <p className="lining text-sm">
          <span className="font-medium">{eur(sum)}</span>{" "}
          <span className="italic text-muted-foreground">
            in {days.length} days · tool calls {eur(calls)} · compute {eur(compute)}
          </span>
        </p>
        {/* Ink bars on a hairline baseline — a ledger chart, no rounding, no fills. */}
        <div className="flex h-28 items-end gap-px border-b border-foreground/50">
          {days.map((d, i) => (
            <div
              key={d.day}
              className="flex h-full flex-1 flex-col justify-end"
              title={`${d.day} · ${eur(totals[i])}`}
            >
              <div
                className="w-full bg-foreground/80"
                style={{ height: `${(totals[i] / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="lining flex justify-between text-xs text-muted-foreground">
          <span>{days[0]?.day}</span>
          <span>{days[days.length - 1]?.day}</span>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Day</TableHead>
              <TableHead className="w-28 text-right">Tool calls</TableHead>
              <TableHead className="w-28 text-right">Compute</TableHead>
              <TableHead className="w-28 pr-6 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spent.map((d) => (
              <TableRow key={d.day}>
                <TableCell className="pl-6">{d.day}</TableCell>
                <TableCell className="text-right">{formatCredit(d.toolCallsMicros)}</TableCell>
                <TableCell className="text-right">{formatCredit(d.computeMicros)}</TableCell>
                <TableCell className="pr-6 text-right font-medium">
                  {formatCredit(d.toolCallsMicros + d.computeMicros)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
