import type { ReactNode } from "react";
import { SettingsNav } from "./settings-nav";

// Every settings page (general, secrets, connectors, webhooks) shares the
// section nav, so the sub-pages are reachable without knowing their URLs.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SettingsNav />
      {children}
    </div>
  );
}
