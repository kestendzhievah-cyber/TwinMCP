import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

/** The pill on MCPs held back from the sign-up credit (lib/wallet/eligibility.ts). */
export const UNLOCK_LABEL = "Unlocks with first top-up";

/**
 * Soft-pink offer pill with a lock: the MCP is shown, not hidden, and a first
 * top-up unlocks it. The API enforces the rule; this is only the label.
 */
export function LockedPill({ className }: { className?: string }) {
  return (
    <Badge variant="offer" className={className}>
      <Lock aria-hidden className="h-3 w-3" />
      {UNLOCK_LABEL}
    </Badge>
  );
}
