"use client";

import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { track } from "@/lib/analytics/funnel";
import { cn } from "@/lib/utils";

/** The five steps of the dashboard's "Getting started" checklist. */
export type ActivationStep = "server" | "mcp" | "key" | "connect" | "first_call";

/**
 * A todo row's link on the activation checklist (components/dashboard/
 * activation-checklist.tsx). Client-side only to send
 * `activation_step_clicked{step}` before navigating.
 */
export function ActivationLink({
  step,
  href,
  children,
  className,
}: {
  step: ActivationStep;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href as Route}
      onClick={() => track({ name: "activation_step_clicked", properties: { step } })}
      className={cn(
        "inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline",
        className
      )}
    >
      {children}
      <ArrowRight aria-hidden className="h-3.5 w-3.5" />
    </Link>
  );
}
