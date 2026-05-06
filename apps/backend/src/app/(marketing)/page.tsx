import { Hero } from "@/components/marketing/hero";
import { IdeLogosBar } from "@/components/marketing/ide-logos-bar";
import { ProblemSolution } from "@/components/marketing/problem-solution";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MarketplacePreview } from "@/components/marketing/marketplace-preview";
import { PricingTeaser } from "@/components/marketing/pricing-teaser";
import { SocialProof } from "@/components/marketing/social-proof";
import { Faq } from "@/components/marketing/faq";

export default function HomePage() {
  return (
    <>
      <Hero />
      <IdeLogosBar />
      <ProblemSolution />
      <HowItWorks />
      <MarketplacePreview />
      <PricingTeaser />
      <SocialProof />
      <Faq />
    </>
  );
}
