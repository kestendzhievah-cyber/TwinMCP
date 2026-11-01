"use client";

import Link from "next/link";
import type { Route } from "next";
import { Play, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { walletFacts } from "@/components/pricing/wallet-copy";

const EN = walletFacts("en");

export function DemoModal({ children }: { children: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary">
            <Sparkles className="h-5 w-5 text-brand" aria-hidden />
          </div>
          <DialogTitle className="font-display text-xl font-bold tracking-tight">
            Demo coming soon
          </DialogTitle>
          <DialogDescription className="max-w-sm">
            We&apos;re recording a 2-minute walkthrough of the full flow — provisioning a server,
            installing an MCP from the marketplace, and connecting your IDE. Get notified when it
            ships, or skip ahead and run it yourself.
          </DialogDescription>
          <div className="mt-2 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button asChild size="lg">
              <Link href={"/sign-up" as Route}>
                <Play aria-hidden />
                {`Start with ${EN.signupCredit} free · no card`}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={"/docs" as Route}>Read the docs instead</Link>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
