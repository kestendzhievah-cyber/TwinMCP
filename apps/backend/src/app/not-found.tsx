import Link from "next/link";
import { Compass } from "lucide-react";
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
      className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center"
    >
      <div className="grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
        <Compass className="h-7 w-7" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-xl font-semibold tracking-tight">This page doesn&apos;t exist</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The page you&apos;re looking for may have moved or never existed.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">Back home</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/docs">Read the docs</Link>
        </Button>
      </div>
    </main>
  );
}
