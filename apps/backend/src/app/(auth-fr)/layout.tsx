// French auth screens (/fr/inscription, /fr/connexion, /fr/mot-de-passe-oublie,
// /fr/nouveau-mot-de-passe; paths in lib/i18n/auth-paths.ts). Each page wraps
// itself in AuthShell with locale="fr" and its side panel, like the English
// (auth) group; `lang="fr"` scopes the language for screen readers and
// hyphenation, like the French marketing layout.
export default function FrAuthLayout({ children }: { children: React.ReactNode }) {
  return <div lang="fr">{children}</div>;
}
