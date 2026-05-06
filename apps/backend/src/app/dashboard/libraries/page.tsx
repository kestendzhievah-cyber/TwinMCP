import { getDb } from "@/db";
import { libraries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Library } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  indexing: "secondary",
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Libraries</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {libs.length} indexed libraries available for retrieval
        </p>
      </div>

      {libs.length === 0 ? (
        <EmptyState
          icon={Library}
          title="No libraries indexed yet"
          description="Libraries are surfaced once the ingestion pipeline has run. Pull a few popular repos to populate this catalog."
        />
      ) : (
        <div className="rounded-md border">
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
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">{l.id}</div>
                    {l.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {l.description.slice(0, 100)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {l.trustScore.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{l.totalSnippets}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[l.status as keyof typeof statusVariant] ?? "outline"}>
                      {l.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
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
