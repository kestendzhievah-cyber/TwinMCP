import { Check, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { FEATURES, PLANS, type FeatureRow, type PlanId } from "./pricing-data";

const planOrder: PlanId[] = ["free", "pro", "team", "enterprise"];

function groupBy<T, K extends string>(rows: T[], key: (row: T) => K): Record<K, T[]> {
  return rows.reduce(
    (acc, row) => {
      const k = key(row);
      (acc[k] ??= []).push(row);
      return acc;
    },
    {} as Record<K, T[]>
  );
}

function renderValue(value: string | boolean) {
  if (value === true) {
    return (
      <>
        <Check className="h-4 w-4 text-success" aria-hidden />
        <span className="sr-only">Included</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="h-4 w-4 text-muted-foreground/50" aria-hidden />
        <span className="sr-only">Not included</span>
      </>
    );
  }
  return <span className="text-foreground">{value}</span>;
}

// A ledger: small-caps column names on a firmer rule, group titles as
// small-caps sub-headings, hairline rows, lining figures (Table is `lining`).
export function ComparisonTable() {
  const grouped = groupBy<FeatureRow, string>(FEATURES, (row) => row.group);
  const groupOrder = Array.from(new Set(FEATURES.map((f) => f.group)));

  return (
    <div className="border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[28%] min-w-[220px] py-4 align-bottom">Features</TableHead>
            {planOrder.map((id) => {
              const plan = PLANS.find((p) => p.id === id)!;
              return (
                <TableHead
                  key={id}
                  className={cn(
                    "py-4 text-center align-bottom",
                    plan.highlighted && "text-foreground"
                  )}
                >
                  {/* col-reverse keeps the name first in the DOM while the
                      "Most popular" line sits above it, like the card's
                      eyebrow over the name; names then share a baseline. */}
                  <div className="flex flex-col-reverse items-center gap-0.5">
                    <span className="text-sm font-medium text-foreground">{plan.name}</span>
                    {plan.highlighted && (
                      <span className="text-xs font-normal text-muted-foreground">
                        Most popular
                      </span>
                    )}
                  </div>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupOrder.map((group) => (
            <GroupBlock key={group} group={group} rows={grouped[group]} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupBlock({ group, rows }: { group: string; rows: FeatureRow[] }) {
  return (
    <>
      <TableRow className="border-foreground/40 hover:bg-transparent">
        <TableCell
          colSpan={5}
          className="smallcaps tracking-sc pb-2 pt-7 text-xs font-medium text-muted-foreground"
        >
          {group}
        </TableCell>
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.label}>
          <TableCell className="align-top">
            <div className="font-medium text-foreground">{row.label}</div>
            {row.description && (
              <div className="mt-0.5 text-xs italic text-muted-foreground">{row.description}</div>
            )}
          </TableCell>
          {planOrder.map((id) => (
            <TableCell key={id} className="text-center align-top">
              <div className="flex min-h-5 items-center justify-center">
                {renderValue(row.values[id])}
              </div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
