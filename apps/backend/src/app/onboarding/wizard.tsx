"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/progress";
import {
  StepPlan,
  type CheckoutCadence,
  type SelectablePlan,
} from "@/components/onboarding/step-plan";
import { StepWelcome, type IdePreference } from "@/components/onboarding/step-welcome";
import { StepServer } from "@/components/onboarding/step-server";
import { StepMcp, type CatalogMcp } from "@/components/onboarding/step-mcp";
import { StepConnect } from "@/components/onboarding/step-connect";
import { track } from "@/lib/analytics/funnel";
import { readProIntent } from "@/lib/auth/return-to";

const STEPS = ["Plan", "IDE", "Server", "MCP", "Connect"] as const;

/** The funnel's cadence vocabulary ("annual") from the checkout API's ("yearly"). */
const funnelCadence = (c: CheckoutCadence): "monthly" | "annual" =>
  c === "yearly" ? "annual" : "monthly";

type WizardServer = { id: string; name: string; slug: string; endpointUrl: string | null };

interface WizardProps {
  catalog: CatalogMcp[];
  existingServer: WizardServer | null;
  /** Step to open on (0-4), already clamped by the page. */
  initialStep?: number;
  /** Back from a successful Pro checkout: the trial is running. */
  proTrial?: boolean;
  /** A trialing or active Pro subscription (not just back from checkout): no plan to pick. */
  subscribedPro?: boolean;
  /** Back from a canceled Pro checkout (nothing was charged). */
  checkoutCanceled?: boolean;
  /** users.metadata.ide_preference, when the user picked one before. */
  initialIde?: IdePreference | null;
}

export function OnboardingWizard({
  catalog,
  existingServer,
  initialStep = 0,
  proTrial = false,
  subscribedPro = false,
  checkoutCanceled = false,
  initialIde = null,
}: WizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // The plan step preselects the intent the URL carries (plan=pro, or the
  // retired plan=team, from the pricing page; plan=free), unless the checkout
  // round trip already settled it. Nothing is read from browser storage: the
  // paid intent travels in the URL through sign-up and the auth callback.
  const urlPlan = readProIntent(searchParams)
    ? "pro"
    : searchParams.get("plan") === "free"
      ? "free"
      : null;

  const [step, setStep] = useState(initialStep);
  const [ide, setIde] = useState<IdePreference | null>(initialIde);
  const [server, setServer] = useState<WizardServer | null>(existingServer);
  const [mcpSlug, setMcpSlug] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    proTrial || subscribedPro ? "pro" : urlPlan
  );
  const [skipping, setSkipping] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track({ name: "onboarding_viewed", properties: { step: STEPS[initialStep].toLowerCase() } });
    if (checkoutCanceled) {
      track({ name: "checkout_canceled", properties: { from: "onboarding" } });
    }
  }, [initialStep, checkoutCanceled]);

  const handleSelectPlan = useCallback(async (plan: SelectablePlan, cadence: CheckoutCadence) => {
    setSelectedPlan(plan);
    track({
      name: "plan_selected",
      properties: { plan, step: "onboarding", cadence: funnelCadence(cadence) },
    });
    // Persist the choice (best-effort) so it survives a checkout round-trip.
    void fetch("/api/v2/users/me/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ selectedPlan: plan }),
    }).catch(() => {});

    if (plan === "free") {
      setStep(1);
      return;
    }

    // Pro → straight to Stripe checkout. Stripe sends the user back to
    // /onboarding?status=success&step=1 (trial started) or ?checkout=canceled.
    track({ name: "checkout_started", properties: { plan, cadence: funnelCadence(cadence) } });
    try {
      const res = await fetch("/api/v2/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cadence, from: "onboarding" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      toast.error("Could not start checkout — you can upgrade later from Billing.");
      setStep(1);
    } catch (err) {
      console.error("[onboarding checkout]", err);
      toast.error("Could not start checkout — you can upgrade later from Billing.");
      setStep(1);
    }
  }, []);

  const handleSelectIde = useCallback(
    async (next: IdePreference) => {
      setIde(next);
      // Best-effort persist; it also preselects the server page's Connect panel.
      void fetch("/api/v2/users/me/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idePreference: next,
          ...(selectedPlan === "free" || selectedPlan === "pro" ? { selectedPlan } : {}),
        }),
      }).catch(() => {});
    },
    [selectedPlan]
  );

  const handleServerReady = useCallback(
    (s: WizardServer) => {
      if (!existingServer || existingServer.id !== s.id) {
        // First time we're seeing this server in the wizard — fire the
        // funnel event. Skipped if the user already had a server (existing).
        track({ name: "first_server_created", properties: { serverId: s.id } });
      }
      setServer(s);
      track({ name: "onboarding_step_completed", properties: { step: "server" } });
      setStep(3);
    },
    [existingServer]
  );

  async function handleSkip() {
    setSkipping(true);
    track({ name: "onboarding_skipped", properties: { atStep: step } });
    try {
      await fetch("/api/v2/users/me/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markCompleted: true }),
      });
      router.push("/dashboard");
    } catch (err) {
      console.error("[onboarding skip]", err);
      toast.error("Could not save your skip. Try again.");
      setSkipping(false);
    }
  }

  function handleFinish() {
    track({ name: "onboarding_step_completed", properties: { step: "connect" } });
    router.push(server ? `/dashboard/servers/${server.id}` : "/dashboard");
  }

  const mcpName = mcpSlug
    ? (catalog.find((m) => m.slug === mcpSlug)?.name ?? mcpSlug)
    : "TwinMCP Docs";

  return (
    <div className="space-y-8">
      {/* Title block: the ledger of steps with the skip action on the same row
          (DESIGN.md §4.5, §5). */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <div className="min-w-0 flex-1">
          <OnboardingProgress current={step} total={STEPS.length} labels={[...STEPS]} />
        </div>
        <Button
          variant="ghost"
          onClick={handleSkip}
          disabled={skipping}
          className="shrink-0 self-end sm:self-auto"
        >
          {skipping ? "Skipping…" : "Skip onboarding"}
        </Button>
      </header>

      {checkoutCanceled && step === 0 && (
        <p className="border border-info/40 border-l-2 border-l-info bg-info/10 px-3 py-2 text-sm text-info">
          Checkout canceled — nothing was charged. Start free, or try Pro again below.
        </p>
      )}

      {/* The step sits on one piece of bone stock with a hairline, under a
          running head in small caps between a rule and the step name (§4.7). */}
      <div className="border border-border bg-card p-6 shadow-sm md:p-8">
        <p className="eyebrow mb-6 flex items-center gap-4 before:h-px before:w-10 before:bg-border before:content-['']">
          <span>
            Step <span className="lining">{step + 1}</span> of{" "}
            <span className="lining">{STEPS.length}</span> · {STEPS[step]}
          </span>
        </p>
        {step === 0 && <StepPlan initialPlan={selectedPlan} onSelectPlan={handleSelectPlan} />}
        {step === 1 && (
          <StepWelcome
            selected={ide}
            onSelect={handleSelectIde}
            onContinue={() => {
              track({ name: "onboarding_step_completed", properties: { step: "ide" } });
              setStep(2);
            }}
            // A Pro trial or subscribed user has already chosen: no way back to
            // the plan step. A Free choice made before sign-up can still be
            // changed there.
            onBack={proTrial || subscribedPro ? undefined : () => setStep(0)}
            selectedPlan={selectedPlan}
            proTrial={proTrial}
          />
        )}
        {step === 2 && (
          <StepServer
            existingServer={existingServer}
            onReady={handleServerReady}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && server && (
          <StepMcp
            catalog={catalog}
            serverId={server.id}
            onInstalled={(slug) => {
              setMcpSlug(slug);
              track({ name: "first_mcp_installed", properties: { mcpSlug: slug } });
              track({ name: "onboarding_step_completed", properties: { step: "mcp" } });
              setStep(4);
            }}
            onSkip={() => {
              track({ name: "onboarding_step_completed", properties: { step: "mcp" } });
              setStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && server && (
          <StepConnect
            serverId={server.id}
            serverName={server.name}
            serverSlug={server.slug}
            // twinmcp-docs is auto-installed on every server, so it's a real,
            // working default when the user skipped the marketplace step. Flag it
            // so Connect labels it honestly instead of silently substituting.
            mcpSlug={mcpSlug ?? "twinmcp-docs"}
            mcpName={mcpName}
            isDocsDefault={!mcpSlug}
            justInstalled={Boolean(mcpSlug)}
            ide={ide ?? "other"}
            onFinish={handleFinish}
            onBack={() => setStep(3)}
          />
        )}
        {/* A deep link past the server step without a server (should not
            happen — the page clamps it) falls back to the server step. */}
        {step >= 3 && !server && (
          <div className="space-y-4">
            <p className="text-base text-muted-foreground">Create your server first.</p>
            <Button onClick={() => setStep(2)}>Go to the server step</Button>
          </div>
        )}
      </div>
    </div>
  );
}
