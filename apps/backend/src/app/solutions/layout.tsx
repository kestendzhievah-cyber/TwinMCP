import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";

// Segment pages share the marketing chrome (card header + address-line footer)
// so visitors landing from search can navigate the rest of the site. The
// French twins live under app/fr/solutions and use the French layout.
export default function SolutionsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
