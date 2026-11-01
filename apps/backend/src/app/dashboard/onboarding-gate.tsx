"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { onboardingGateApplies } from "@/lib/auth/return-to";

/**
 * Sends a new account with no server to the wizard. The server half
 * (lib/auth/return-to.ts needsOnboarding, in the dashboard layout) decides
 * `active`; this half knows the path, which a layout does not, and leaves the
 * exempt pages alone (Billing returns, Settings). /onboarding sits outside the
 * dashboard layout and the wizard's "Skip onboarding" sets
 * onboarding_completed_at, so the redirect can never loop.
 */
export function OnboardingGate({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const redirecting = active && onboardingGateApplies(pathname);

  useEffect(() => {
    if (redirecting) router.replace("/onboarding");
  }, [redirecting, router]);

  if (redirecting) {
    return (
      <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Opening the setup…
      </p>
    );
  }
  return <>{children}</>;
}
