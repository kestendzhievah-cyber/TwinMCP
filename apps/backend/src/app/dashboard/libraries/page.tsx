import { getDb } from "@/db";
import { libraries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyState } from "@/components/dashboard/empty-state";

const statusVariant = {
  ready: "success",
  failed: "destructive",
  pending: "warning",
  indexing: "warning",
} as const;

export default async function LibrariesPage() {
  const db = getDb();
  const libs = await db
    .select({
      id: libraries.id,
      title: libraries.title,
      description: libraries.description,
      trustScore: libraries.trustScore,
      totalSnippets: libraries.totalSnippets,
      status: libraries.status,
      lastIndexedAt: libraries.lastIndexedAt,
    })
    .from(libraries)
    .orderBy(desc(libraries.trustScore))
    .limit(100);

  return (
    <div className="space-y-8">
      {/* Page header (DESIGN.md §5): engraved title, italic count, double rule. */}
      <div>
        <h1 className="smallcaps tracking-sc text-2xl font-medium">Libraries</h1>
        <p className="mt-1 text-sm italic text-muted-foreground">
          <span className="lining">{libs.length}</span> indexed libraries available for retrieval
        </p>
        <Separator variant="double" className="mt-4" />
      </div>

      {libs.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No libraries indexed yet"
          description="Libraries are surfaced once the ingestion pipeline has run. Pull a few popular repos to populate this catalog."
        />
      ) : (
        // The ledger (DESIGN.md §4.5): small-capital column heads on a firmer
        // rule, hairline rows, mono ids, lining scores and counts.
        <div className="border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Library</TableHead>
                <TableHead className="w-20 text-right">Trust</TableHead>
                <TableHead className="w-24 text-right">Snippets</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Last indexed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {libs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="font-medium">{l.title}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">{l.id}</div>
                    {l.description && (
                      <div className="mt-1 line-clamp-1 text-xs italic text-muted-foreground">
                        {l.description.slice(0, 100)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{l.trustScore.toFixed(1)}</TableCell>
                  <TableCell className="text-right">{l.totalSnippets}</TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant[l.status as keyof typeof statusVariant] ?? "outline"}
                    >
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {l.lastIndexedAt ? l.lastIndexedAt.toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
