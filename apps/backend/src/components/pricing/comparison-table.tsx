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
        <Check className="h-4 w-4 text-emerald-500" aria-hidden />
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
  return <span className="text-sm text-foreground/90">{value}</span>;
}

export function ComparisonTable() {
  const grouped = groupBy<FeatureRow, string>(FEATURES, (row) => row.group);
  const groupOrder = Array.from(new Set(FEATURES.map((f) => f.group)));

  return (
    <div className="overflow-x-auto rounded-xl border border-border/80 bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[28%] min-w-[220px] py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Features
            </TableHead>
            {planOrder.map((id) => {
              const plan = PLANS.find((p) => p.id === id)!;
              return (
                <TableHead
                  key={id}
                  className={cn(
                    "py-4 text-center",
                    plan.highlighted && "text-foreground"
                  )}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      {plan.name}
                    </span>
                    {plan.highlighted && (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
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
      <TableRow className="bg-muted/20 hover:bg-muted/20">
        <TableCell
          colSpan={5}
          className="py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {group}
        </TableCell>
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.label}>
          <TableCell className="align-top">
            <div className="font-medium text-foreground">{row.label}</div>
            {row.description && (
              <div className="mt-0.5 text-xs text-muted-foreground">{row.description}</div>
            )}
          </TableCell>
          {planOrder.map((id) => (
            <TableCell key={id} className="text-center align-top">
              <div className="flex items-center justify-center">{renderValue(row.values[id])}</div>
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
