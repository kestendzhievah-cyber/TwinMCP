"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OnboardingProgress } from "@/components/onboarding/progress";
import {
  StepWelcome,
  type IdePreference,
  type SignupCreditView,
} from "@/components/onboarding/step-welcome";
import { StepServer } from "@/components/onboarding/step-server";
import { StepMcp, type CatalogMcp } from "@/components/onboarding/step-mcp";
import { StepConnect } from "@/components/onboarding/step-connect";
import { track } from "@/lib/analytics/funnel";

// No Plan step: every account starts on its free sign-up credit (prepaid
// wallet, no subscription), shown on the welcome step. STEPS names the steps in
// analytics events (keep as is); STEP_LABELS is what the stepper shows.
const STEPS = ["IDE", "Server", "MCP", "Connect"] as const;
const STEP_LABELS = ["Welcome", "Server", "MCP", "Connect"] as const;

type WizardServer = { id: string; name: string; slug: string; endpointUrl: string | null };

interface WizardProps {
  catalog: CatalogMcp[];
  existingServer: WizardServer | null;
  /** Step to open on (0-3), already clamped by the page. */
  initialStep?: number;
  /** The sign-up credit line for the welcome step (null: say nothing). */
  credit?: SignupCreditView | null;
  /** users.metadata.ide_preference, when the user picked one before. */
  initialIde?: IdePreference | null;
}

export function OnboardingWizard({
  catalog,
  existingServer,
  initialStep = 0,
  credit = null,
  initialIde = null,
}: WizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [ide, setIde] = useState<IdePreference | null>(initialIde);
  const [server, setServer] = useState<WizardServer | null>(existingServer);
  const [mcpSlug, setMcpSlug] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track({ name: "onboarding_viewed", properties: { step: STEPS[initialStep].toLowerCase() } });
  }, [initialStep]);

  const handleSelectIde = useCallback(async (next: IdePreference) => {
    setIde(next);
    // Best-effort persist; it also preselects the server page's Connect panel.
    void fetch("/api/v2/users/me/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idePreference: next }),
    }).catch(() => {});
  }, []);

  const handleServerReady = useCallback(
    (s: WizardServer) => {
      if (!existingServer || existingServer.id !== s.id) {
        // First time we're seeing this server in the wizard — fire the
        // funnel event. Skipped if the user already had a server (existing).
        track({ name: "first_server_created", properties: { serverId: s.id } });
      }
      setServer(s);
      track({ name: "onboarding_step_completed", properties: { step: "server" } });
      setStep(2);
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
    <div className="space-y-6">
      {/* The stepper, with the skip action under it on the right. */}
      <header className="space-y-3">
        <OnboardingProgress current={step} total={STEPS.length} labels={[...STEP_LABELS]} />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={skipping}>
            {skipping ? "Skipping…" : "Skip onboarding"}
          </Button>
        </div>
      </header>

      {/* The step: one white card on the light-blue page. */}
      <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm sm:p-8">
        <p className="eyebrow mb-5 tabular-nums">
          Step {step + 1} of {STEPS.length} · {STEP_LABELS[step]}
        </p>
        {step === 0 && (
          <StepWelcome
            selected={ide}
            onSelect={handleSelectIde}
            onContinue={() => {
              track({ name: "onboarding_step_completed", properties: { step: "ide" } });
              setStep(1);
            }}
            credit={credit}
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
            onInstalled={(slug) => {
              setMcpSlug(slug);
              track({ name: "first_mcp_installed", properties: { mcpSlug: slug } });
              track({ name: "onboarding_step_completed", properties: { step: "mcp" } });
              setStep(3);
            }}
            onSkip={() => {
              track({ name: "onboarding_step_completed", properties: { step: "mcp" } });
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && server && (
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
            onBack={() => setStep(2)}
          />
        )}
        {/* A deep link past the server step without a server (should not
            happen — the page clamps it) falls back to the server step. */}
        {step >= 2 && !server && (
          <div className="space-y-4">
            <p className="text-base text-muted-foreground">Create your server first.</p>
            <Button onClick={() => setStep(1)}>Go to the server step</Button>
          </div>
        )}
      </div>
    </div>
  );
}
