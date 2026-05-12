import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

// French marketing layout — reuses the EN header/footer for chrome
// (consistent branding); page content is in French.
export default function FrMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main className="flex-1" lang="fr">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
