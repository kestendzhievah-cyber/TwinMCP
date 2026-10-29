import { AuthShell } from "@/components/auth/auth-shell";

// French auth screens (/fr/inscription, /fr/connexion, /fr/mot-de-passe-oublie,
// /fr/nouveau-mot-de-passe; paths in lib/i18n/auth-paths.ts). Same card as the
// English (auth) group, localized via the `locale` prop; `lang="fr"` scopes the
// language for screen readers and hyphenation, like the French marketing layout.
export default function FrAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="fr">
      <AuthShell locale="fr">{children}</AuthShell>
    </div>
  );
}
