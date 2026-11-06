// Where the Smithery migration assistant lives (components/marketing/migrate-assistant.tsx).
// Its own module so the migration guide can link to it without an import cycle.

import type { Locale } from "@/lib/i18n/locales";

export const ASSISTANT_PATHS = { en: "/migrate", fr: "/fr/migrer" } as const satisfies Record<
  Locale,
  string
>;
