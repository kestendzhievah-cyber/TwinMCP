import Link from "next/link";
import { AuthPanel } from "@/components/auth/auth-panel";
import { Logo } from "@/components/marketing/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[3fr_2fr]">
      {/* Form side */}
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 lg:px-10">
          <Link href="/" aria-label="TwinMCP — home">
            <Logo />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-6 py-4 text-xs text-muted-foreground lg:px-10">
          <span>© {new Date().getFullYear()} TwinMCP</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/plans" className="hover:text-foreground">
              Pricing
            </Link>
            <a href="mailto:hello@twinmcp.fr" className="hover:text-foreground">
              Contact
            </a>
          </div>
        </footer>
      </div>

      {/* Panel side (hidden on mobile) */}
      <div className="hidden lg:block">
        <AuthPanel />
      </div>
    </div>
  );
}
