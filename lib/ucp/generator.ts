import type { UCPProductContext, UCPAttribute, UCPCategory } from '@/lib/types';

interface ProductInput {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  brand?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, string> | null;
  storeName?: string | null;
  availability?: {
    status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'pre_order';
    quantity?: number;
    deliveryEstimate?: string;
  } | null;
}

export function generateUCPContext(product: ProductInput): UCPProductContext {
  const category = parseCategory(product.category);
  const attributes = extractAttributes(product);
  const keywords = extractKeywords(product.name, product.description, product.category);

  return {
    "@context": "https://ucp.commerce/schema/v1",
    "@type": "Product",
    identifier: product.id,
    name: optimizeTitle(product.name),
    description: optimizeDescription(product.description),
    brand: product.brand || undefined,
    category: {
      primary: category.primary,
      secondary: category.secondary,
      breadcrumb: category.breadcrumb,
      keywords,
    },
    pricing: {
      amount: product.price,
      currency: product.currency,
      formatted: formatPrice(product.price, product.currency),
      priceRange: getPriceRange(product.price),
    },
    attributes,
    availability: {
      status: product.availability?.status ?? "in_stock",
      quantity: product.availability?.quantity,
      deliveryEstimate: product.availability?.deliveryEstimate ?? "2-5 jours ouvrés",
    },
    media: product.imageUrl
      ? [{ type: "image", url: product.imageUrl, alt: product.name, isPrimary: true }]
      : undefined,
    metadata: {
      generatedAt: new Date().toISOString(),
      schemaVersion: "1.0",
      ucpVersion: "1.0.0",
      sourceStore: product.storeName || "unknown",
      language: "fr",
      lastVerified: new Date().toISOString(),
    },
  };
}

function optimizeTitle(title: string): string {
  let optimized = title.trim();
  if (optimized.length < 20) {
    return optimized;
  }
  optimized = optimized.replace(/\s+/g, ' ');
  if (optimized.length > 150) {
    optimized = optimized.substring(0, 147) + '...';
  }
  return optimized;
}

function optimizeDescription(description: string): string {
  let optimized = description.trim();
  optimized = optimized.replace(/\s+/g, ' ');
  optimized = optimized.replace(/<[^>]*>/g, '');
  if (optimized.length > 2000) {
    optimized = optimized.substring(0, 1997) + '...';
  }
  return optimized;
}

function parseCategory(category: string): { primary: string; secondary?: string; breadcrumb: string[] } {
  const parts = category.split(/[>/,]/).map(p => p.trim()).filter(Boolean);
  return {
    primary: parts[0] || category,
    secondary: parts[1],
    breadcrumb: parts.length > 0 ? parts : [category],
  };
}

function extractAttributes(product: ProductInput): UCPAttribute[] {
  const attrs: UCPAttribute[] = [];

  if (product.brand) {
    attrs.push({ name: "Marque", value: product.brand, importance: "critical" });
  }
  if (product.sku) {
    attrs.push({ name: "Référence", value: product.sku, importance: "important" });
  }

  if (product.attributes && typeof product.attributes === 'object') {
    for (const [key, value] of Object.entries(product.attributes)) {
      if (typeof value === 'string' && value.trim()) {
        attrs.push({
          name: key,
          value: value.trim(),
          importance: isImportantAttribute(key) ? "important" : "optional",
        });
      }
    }
  }

  return attrs;
}

function isImportantAttribute(name: string): boolean {
  const importantKeys = ['taille', 'size', 'couleur', 'color', 'matière', 'material', 'poids', 'weight', 'dimensions'];
  return importantKeys.some(k => name.toLowerCase().includes(k));
}

function extractKeywords(name: string, description: string, category: string): string[] {
  const text = `${name} ${description} ${category}`.toLowerCase();
  const words = text
    .replace(/[^a-zàâäéèêëïîôùûüÿçæœ\s-]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);

  const stopWords = new Set(['avec', 'dans', 'pour', 'cette', 'plus', 'tout', 'sont', 'mais', 'être', 'avoir', 'très', 'aussi']);
  const filtered = words.filter(w => !stopWords.has(w));

  const frequency = new Map<string, number>();
  for (const word of filtered) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function getPriceRange(price: number): string {
  if (price < 25) return "budget";
  if (price < 100) return "mid-range";
  if (price < 500) return "premium";
  return "luxury";
}

export function validateUCPContext(context: UCPProductContext): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!context["@context"]) errors.push("Contexte @context manquant");
  if (!context["@type"]) errors.push("Type @type manquant");
  if (!context.identifier) errors.push("Identifiant manquant");
  if (!context.name || context.name.length < 3) errors.push("Nom de produit trop court (min 3 caractères)");
  if (!context.description || context.description.length < 20) errors.push("Description trop courte (min 20 caractères)");
  if (!context.category?.primary) errors.push("Catégorie principale manquante");
  if (!context.pricing?.amount || context.pricing.amount <= 0) errors.push("Prix invalide");
  if (!context.metadata?.schemaVersion) errors.push("Version du schéma manquante");

  return { valid: errors.length === 0, errors };
}
