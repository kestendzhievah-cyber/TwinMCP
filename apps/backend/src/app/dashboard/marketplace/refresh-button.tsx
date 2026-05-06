"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshCatalogButton() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    // Visual cue only — server-component refresh resolves quickly.
    setTimeout(() => setRefreshing(false), 700);
  }

  return (
    <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
      <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} />
      {refreshing ? "Refreshing…" : "Refresh catalog"}
    </Button>
  );
}
