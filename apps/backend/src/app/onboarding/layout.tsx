import Link from "next/link";
import { Logo } from "@/components/marketing/logo";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6">
          <Link href="/" aria-label="TwinMCP — home">
            <Logo />
          </Link>
          <span className="text-xs text-muted-foreground">Onboarding</span>
        </div>
      </header>
      <main id="main-content" className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">{children}</div>
      </main>
    </div>
  );
}
