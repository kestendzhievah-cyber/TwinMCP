import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Page not found — TwinMCP",
  robots: { index: false, follow: true },
};

// Global 404 — branded fallback for any unmatched route.
export default function NotFound() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg sm:p-10">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-3 text-muted-foreground">
          The page you&apos;re looking for may have moved or never existed.
        </p>
        <div className="my-6 border-t border-border" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">twinmcp.fr · hello@twinmcp.fr</p>
      </div>
    </main>
  );
}
