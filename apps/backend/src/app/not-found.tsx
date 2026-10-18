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
      <div className="w-full max-w-md border border-foreground/60 bg-card p-10 text-center shadow-stack">
        <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-8 before:bg-border before:content-[''] after:h-px after:w-8 after:bg-border after:content-['']">
          404
        </p>
        <h1 className="mt-5 text-3xl font-medium">This page doesn&apos;t exist</h1>
        <p className="mt-3 italic text-muted-foreground">
          The page you&apos;re looking for may have moved or never existed.
        </p>
        <div className="rule-double my-6" />
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/">Back home</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/docs">Read the docs</Link>
          </Button>
        </div>
        <p className="smallcaps tracking-sc mt-6 text-xs text-muted-foreground">
          twinmcp.fr · hello@twinmcp.fr
        </p>
      </div>
    </main>
  );
}
