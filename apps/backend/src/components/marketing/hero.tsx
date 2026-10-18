import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroMockup } from "./hero-mockup";

// The home hero is the centre of the card: a dateline eyebrow between two
// hairlines, the name engraved in letterspaced small capitals, a short rule,
// the lead, the two buttons, and one small-caps address line of facts. The
// product — the dashboard mockup — sits under it on a stack of cards.
export function Hero() {
  return (
    <section>
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <Link
            href={"/docs" as Route}
            className="eyebrow flex items-center justify-center gap-4 transition-colors before:hidden before:h-px before:w-10 before:shrink-0 before:bg-border before:content-[''] after:hidden after:h-px after:w-10 after:shrink-0 after:bg-border after:content-[''] hover:text-foreground hover:underline hover:decoration-brand hover:underline-offset-4 sm:before:block sm:after:block"
          >
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              <span>v0.2 · Upstash Box runtime now in Developer Preview</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
            </span>
          </Link>

          <h1 className="display letterpress mt-8 text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
            Stop copying docs into ChatGPT.{" "}
            <span className="block">Give your AI agent live context.</span>
          </h1>

          <div className="mt-8 h-px w-12 bg-foreground/40" />

          <p className="mt-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
            TwinMCP runs your{" "}
            <a
              href="https://modelcontextprotocol.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand underline decoration-brand/40 underline-offset-4 transition-colors hover:decoration-brand"
            >
              MCP servers
            </a>{" "}
            in isolated runtimes you control — provisioned, scaled, and connected to Cursor, Claude
            Code, or Windsurf in 2 minutes. No Docker, no infra, no VPS.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up" as Route}>
                Start free · no credit card
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={"/#how-it-works" as Route}>See how it works</Link>
            </Button>
          </div>

          <p className="smallcaps tracking-sc lining mt-8 text-xs text-muted-foreground">
            1 free server · 5 official MCPs · Bring your own runtime when you outgrow it.
          </p>
        </div>

        <div className="mt-16 flex justify-center md:mt-20">
          <HeroMockup />
        </div>
      </div>
    </section>
  );
}
