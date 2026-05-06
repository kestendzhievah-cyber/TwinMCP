"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/progress";
import { StepWelcome, type IdePreference } from "@/components/onboarding/step-welcome";
import { StepServer } from "@/components/onboarding/step-server";
import { StepMcp, type CatalogMcp } from "@/components/onboarding/step-mcp";
import { StepConnect } from "@/components/onboarding/step-connect";

const STEPS = ["IDE", "Server", "MCP", "Connect"] as const;
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
      setServer(s);
      setStep(2);
    },
    []
  );

  async function handleSkip() {
    setSkipping(true);
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
          <StepWelcome
            selected={ide}
            onSelect={handleSelectIde}
            onContinue={() => setStep(1)}
            selectedPlan={selectedPlan}
          />
        )}
        {step === 1 && (
          <StepServer
            existingServer={existingServer}
            onReady={handleServerReady}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && server && (
          <StepMcp
            catalog={catalog}
            serverId={server.id}
            onInstalled={() => setStep(3)}
            onSkip={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && server && (
          <StepConnect
            serverId={server.id}
            serverName={server.name}
            endpointUrl={server.endpointUrl}
            ide={ide ?? "other"}
            onFinish={handleFinish}
            onBack={() => setStep(2)}
          />
        )}
      </div>
    </div>
  );
}
