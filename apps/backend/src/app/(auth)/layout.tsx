// English auth screens (sign-in, sign-up, password reset). Each page wraps
// itself in AuthShell (components/auth/auth-shell.tsx), shared with the French
// (auth-fr) group, so it can pick its side panel: the €10 offer on sign-up, the
// neutral pitch elsewhere.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
