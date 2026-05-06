import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoModal } from "./demo-modal";
import { HeroMockup } from "./hero-mockup";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* subtle radial backdrop, neutral */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_hsl(var(--secondary))_0%,_transparent_55%)]"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:py-28 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start">
          <Link
            href={"/docs" as Route}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-emerald-500" />
            <span>v0.2 · Upstash Box runtime now in Developer Preview</span>
            <ArrowRight className="h-3 w-3" />
          </Link>

          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
            Stop copying docs into ChatGPT.{" "}
            <span className="bg-gradient-to-r from-violet-500 to-blue-500 bg-clip-text text-transparent">
              Give your AI agent live context.
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
            TwinMCP runs your{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline decoration-dotted underline-offset-4"
            >
              MCP servers
            </a>{" "}
            in isolated runtimes you control — provisioned, scaled, and connected to Cursor,
            Claude Code, or Windsurf in 2 minutes. No Docker, no infra, no VPS.
          </p>

          <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href={"/sign-up" as Route}>
                Start free → no credit card
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <DemoModal>
              <Button size="lg" variant="outline">
                <Play className="h-4 w-4" />
                Watch 2-min demo
              </Button>
            </DemoModal>
          </div>

          <p className="mt-5 text-xs text-muted-foreground">
            1 free server · 5 official MCPs · Bring your own runtime when you outgrow it.
          </p>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          {/* soft gradient halo around the mockup */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 translate-y-6 scale-95 rounded-3xl bg-gradient-to-tr from-violet-500/20 via-transparent to-blue-500/20 blur-2xl"
          />
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
