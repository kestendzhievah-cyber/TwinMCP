import { AuthShell } from "@/components/auth/auth-shell";

// English auth screens (sign-in, sign-up, password reset). The card itself —
// header, centred form, address line, side panel — lives in AuthShell, shared
// with the French (auth-fr) group.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell locale="en">{children}</AuthShell>;
}
