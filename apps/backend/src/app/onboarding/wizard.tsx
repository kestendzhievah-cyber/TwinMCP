"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { StepPlan, type SelectablePlan } from "@/components/onboarding/step-plan";
import { StepWelcome, type IdePreference } from "@/components/onboarding/step-welcome";
import { StepServer } from "@/components/onboarding/step-server";
import { StepMcp, type CatalogMcp } from "@/components/onboarding/step-mcp";
import { StepConnect } from "@/components/onboarding/step-connect";
import { track } from "@/lib/analytics/funnel";

const STEPS = ["Plan", "IDE", "Server", "MCP", "Connect"] as const;
const SELECTED_PLAN_KEY = "tmcp_signup_plan";

interface WizardProps {
  catalog: CatalogMcp[];
  existingServer: { id: string; name: string; endpointUrl: string | null } | null;
}

export function OnboardingWizard({ catalog, existingServer }: WizardProps) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [ide, setIde] = useState<IdePreference | null>(null);
  const [server, setServer] = useState<
    { id: string; name: string; endpointUrl: string | null } | null
  >(existingServer);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);

  // Pull plan from localStorage (set during sign-up).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SELECTED_PLAN_KEY);
    if (stored) setSelectedPlan(stored);
  }, []);

  const handleSelectPlan = useCallback(async (plan: SelectablePlan) => {
    setSelectedPlan(plan);
    track({ name: "plan_selected", properties: { plan, step: "onboarding" } });
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

    // Paid plan → straight to Stripe checkout for max conversion.
    track({ name: "checkout_started", properties: { plan, cadence: "monthly" } });
    try {
      const res = await fetch("/api/v2/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, cadence: "monthly" }),
      });
      if (res.ok) {
        const data = await res.json();
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
      // Best-effort persist; we don't block the UI on it.
      void fetch("/api/v2/users/me/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idePreference: next,
          ...(selectedPlan ? { selectedPlan } : {}),
        }),
      }).catch(() => {});
    },
    [selectedPlan]
  );

  const handleServerReady = useCallback(
    (s: { id: string; name: string; endpointUrl: string | null }) => {
      setServer((prev) => {
        if (!prev) {
          // First time we're seeing this server in the wizard — fire the
          // funnel event. Skipped if the user already had a server (existing).
          track({ name: "first_server_created", properties: { serverId: s.id } });
        }
        return s;
      });
      track({ name: "onboarding_step_completed", properties: { step: "server" } });
      setStep(3);
    },
    []
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
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(SELECTED_PLAN_KEY);
      }
      router.push("/dashboard");
    } catch (err) {
      console.error("[onboarding skip]", err);
      toast.error("Could not save your skip. Try again.");
      setSkipping(false);
    }
  }

  function handleFinish() {
    track({ name: "onboarding_step_completed", properties: { step: "connect" } });
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SELECTED_PLAN_KEY);
    }
    router.push("/dashboard");
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <OnboardingProgress current={step} total={STEPS.length} labels={[...STEPS]} />
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          disabled={skipping}
          className="self-end sm:self-auto"
        >
          {skipping ? "Skipping…" : "Skip onboarding"}
        </Button>
      </header>

      <div className="rounded-2xl border border-border/80 bg-card p-6 md:p-8">
        {step === 0 && (
          <StepPlan initialPlan={selectedPlan} onSelectPlan={handleSelectPlan} />
        )}
        {step === 1 && (
          <StepWelcome
            selected={ide}
            onSelect={handleSelectIde}
            onContinue={() => {
              track({ name: "onboarding_step_completed", properties: { step: "ide" } });
              setStep(2);
            }}
            selectedPlan={selectedPlan}
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
            onInstalled={(mcpSlug) => {
              track({ name: "first_mcp_installed", properties: { mcpSlug } });
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
            endpointUrl={server.endpointUrl}
            ide={ide ?? "other"}
            onFinish={handleFinish}
            onBack={() => setStep(3)}
          />
        )}
      </div>
    </div>
  );
}
