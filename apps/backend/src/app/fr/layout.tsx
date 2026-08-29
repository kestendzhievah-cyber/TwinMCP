import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

// French marketing layout — same header/footer chrome as EN, but localized via
// the `locale` prop so nav labels, CTAs and footer render in French.
export default function FrMarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background" lang="fr">
      <MarketingHeader locale="fr" />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter locale="fr" />
    </div>
  );
}
