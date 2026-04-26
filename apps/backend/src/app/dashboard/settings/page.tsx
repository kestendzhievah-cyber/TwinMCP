import { Suspense } from "react";
import { SettingsPanel } from "./panel";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPanel />
    </Suspense>
  );
}
