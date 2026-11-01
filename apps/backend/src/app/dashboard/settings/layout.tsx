import type { ReactNode } from "react";
import { SettingsNav } from "./settings-nav";

// Every settings page (general, secrets, connectors, webhooks) shares the
// section nav, so the sub-pages are reachable without knowing their URLs.
// From md up the nav is a left-hand list beside the page; on phones it is an
// underline tab row above it.
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="gap-8 md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:items-start lg:grid-cols-[12rem_minmax(0,1fr)]">
      <SettingsNav />
      <div className="mt-6 min-w-0 md:mt-0">{children}</div>
    </div>
  );
}
