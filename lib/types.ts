export interface UCPProductContext {
  "@context": "https://ucp.commerce/schema/v1";
  "@type": "Product";
  identifier: string;
  name: string;
  description: string;
  brand?: string;
  category: UCPCategory;
  pricing: UCPPricing;
  attributes: UCPAttribute[];
  availability: UCPAvailability;
  media?: UCPMedia[];
  reviews?: UCPReviewSummary;
  shipping?: UCPShipping;
  sustainability?: UCPSustainability;
  metadata: UCPMetadata;
}

export interface UCPCategory {
  primary: string;
  secondary?: string;
  breadcrumb: string[];
  keywords: string[];
}

export interface UCPPricing {
  amount: number;
  currency: string;
  formatted: string;
  priceRange?: string;
  discount?: {
    type: "percentage" | "fixed";
    value: number;
    originalPrice: number;
  };
}

export interface UCPAttribute {
  name: string;
  value: string;
  unit?: string;
  importance: "critical" | "important" | "optional";
}

export interface UCPAvailability {
  status: "in_stock" | "low_stock" | "out_of_stock" | "pre_order";
  quantity?: number;
  deliveryEstimate?: string;
}

export interface UCPMedia {
  type: "image" | "video" | "3d";
  url: string;
  alt: string;
  isPrimary?: boolean;
}

export interface UCPReviewSummary {
  averageRating: number;
  totalReviews: number;
  highlights: string[];
}

export interface UCPShipping {
  freeShipping: boolean;
  estimatedDays: number;
  zones: string[];
}

export interface UCPSustainability {
  ecoScore?: string;
  certifications: string[];
  recyclable: boolean;
}

export interface UCPMetadata {
  generatedAt: string;
  schemaVersion: string;
  ucpVersion: string;
  sourceStore: string;
  language: string;
  lastVerified: string;
}

export interface AnalysisResult {
  overallScore: number;
  titleScore: number;
  descriptionScore: number;
  attributesScore: number;
  categoryScore: number;
  llmReadiness: number;
  semanticRichness: number;
  contextClarity: number;
  recommendations: Recommendation[];
}

export interface Recommendation {
  id: string;
  type: "critical" | "warning" | "info" | "success";
  category: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  effort: "easy" | "medium" | "hard";
  autoFixAvailable: boolean;
}

export interface DashboardStats {
  totalProducts: number;
  analyzedProducts: number;
  averageScore: number;
  publishedContexts: number;
  scoreDistribution: {
    excellent: number;
    good: number;
    needsWork: number;
    critical: number;
  };
  recentTrend: number;
}

export interface ProductWithAnalysis {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  brand: string | null;
  imageUrl: string | null;
  storeName: string;
  latestScore: number | null;
  llmReadiness: number | null;
  hasContext: boolean;
  contextStatus: string | null;
  updatedAt: string;
}
