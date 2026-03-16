import type { AnalysisResult, Recommendation } from '@/lib/types';

interface ProductToAnalyze {
  name: string;
  description: string;
  category: string;
  brand?: string | null;
  price: number;
  attributes?: Record<string, string> | null;
  imageUrl?: string | null;
}

export function analyzeProduct(product: ProductToAnalyze): AnalysisResult {
  const titleScore = analyzeTitleQuality(product.name);
  const descriptionScore = analyzeDescriptionQuality(product.description);
  const attributesScore = analyzeAttributesQuality(product.attributes, product.brand);
  const categoryScore = analyzeCategoryQuality(product.category);

  const llmReadiness = calculateLLMReadiness(titleScore, descriptionScore, attributesScore, categoryScore);
  const semanticRichness = calculateSemanticRichness(product.name, product.description);
  const contextClarity = calculateContextClarity(product);

  const overallScore = Math.round(
    titleScore * 0.30 +
    descriptionScore * 0.35 +
    attributesScore * 0.20 +
    categoryScore * 0.15
  );

  const recommendations = generateRecommendations(product, {
    titleScore,
    descriptionScore,
    attributesScore,
    categoryScore,
    llmReadiness,
    semanticRichness,
    contextClarity,
  });

  return {
    overallScore,
    titleScore,
    descriptionScore,
    attributesScore,
    categoryScore,
    llmReadiness,
    semanticRichness,
    contextClarity,
    recommendations,
  };
}

function analyzeTitleQuality(title: string): number {
  let score = 0;
  const trimmed = title.trim();

  // Length check (ideal: 30-80 chars)
  if (trimmed.length >= 30 && trimmed.length <= 80) score += 30;
  else if (trimmed.length >= 20 && trimmed.length <= 100) score += 20;
  else if (trimmed.length >= 10) score += 10;

  // Contains brand-like pattern (capitalized word at start)
  if (/^[A-Z][a-zÀ-ÿ]+/.test(trimmed)) score += 10;

  // Contains descriptive words
  const descriptivePatterns = [
    /\b(pour|avec|en|de)\b/i,
    /\b(premium|pro|qualité|original)\b/i,
    /\b(homme|femme|enfant|mixte|unisexe)\b/i,
    /\d+\s*(ml|g|kg|cm|mm|l|pcs|pièces)/i,
  ];
  for (const pattern of descriptivePatterns) {
    if (pattern.test(trimmed)) score += 8;
  }

  // No ALL CAPS abuse
  const capsRatio = (trimmed.match(/[A-Z]/g) || []).length / trimmed.length;
  if (capsRatio < 0.4) score += 10;

  // No special character abuse
  if (!/[!@#$%^&*]{2,}/.test(trimmed)) score += 10;

  // Word count (3-10 is ideal)
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount >= 3 && wordCount <= 10) score += 10;
  else if (wordCount >= 2) score += 5;

  return Math.min(100, score);
}

function analyzeDescriptionQuality(description: string): number {
  let score = 0;
  const cleaned = description.replace(/<[^>]*>/g, '').trim();

  // Length check (ideal: 150-1000 chars)
  if (cleaned.length >= 150 && cleaned.length <= 1000) score += 25;
  else if (cleaned.length >= 80 && cleaned.length <= 1500) score += 15;
  else if (cleaned.length >= 30) score += 5;

  // Sentence structure
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length >= 3 && sentences.length <= 10) score += 20;
  else if (sentences.length >= 2) score += 10;

  // Contains benefit-oriented language
  const benefitWords = [
    'permet', 'offre', 'idéal', 'parfait', 'confortable', 'durable',
    'pratique', 'élégant', 'performant', 'résistant', 'léger', 'facile',
    'garantie', 'qualité', 'design', 'innovant', 'naturel', 'efficace',
  ];
  const benefitCount = benefitWords.filter(w => cleaned.toLowerCase().includes(w)).length;
  score += Math.min(20, benefitCount * 5);

  // Contains specifications/numbers
  const hasSpecs = /\d+\s*(cm|mm|m|kg|g|ml|l|watts?|volts?|mah|pouces?)/i.test(cleaned);
  if (hasSpecs) score += 10;

  // No keyword stuffing (repeated words)
  const words = cleaned.toLowerCase().split(/\s+/);
  const wordFreq = new Map<string, number>();
  for (const w of words) {
    if (w.length > 4) wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
  }
  const maxFreq = Math.max(...Array.from(wordFreq.values()), 0);
  if (maxFreq <= 3) score += 10;

  // Paragraph structure
  const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 20);
  if (paragraphs.length >= 2) score += 10;

  // No ALL CAPS blocks
  if (!/[A-Z]{10,}/.test(cleaned)) score += 5;

  return Math.min(100, score);
}

function analyzeAttributesQuality(
  attributes: Record<string, string> | null | undefined,
  brand: string | null | undefined
): number {
  let score = 20; // Base score

  if (brand && brand.trim().length > 0) score += 20;

  if (!attributes || typeof attributes !== 'object') return score;

  const keys = Object.keys(attributes);
  const filledKeys = keys.filter(k => {
    const v = attributes[k];
    return typeof v === 'string' && v.trim().length > 0;
  });

  // Number of attributes
  if (filledKeys.length >= 5) score += 25;
  else if (filledKeys.length >= 3) score += 15;
  else if (filledKeys.length >= 1) score += 8;

  // Important attributes present
  const importantAttrs = ['taille', 'size', 'couleur', 'color', 'matière', 'material', 'poids', 'weight'];
  const hasImportant = importantAttrs.some(attr =>
    keys.some(k => k.toLowerCase().includes(attr))
  );
  if (hasImportant) score += 20;

  // Attribute value quality
  const avgValueLength = filledKeys.reduce((sum, k) => sum + attributes[k].length, 0) / (filledKeys.length || 1);
  if (avgValueLength >= 5) score += 15;

  return Math.min(100, score);
}

function analyzeCategoryQuality(category: string): number {
  let score = 0;
  const trimmed = category.trim();

  if (!trimmed) return 0;

  // Has category
  score += 20;

  // Depth (hierarchy)
  const depth = trimmed.split(/[>/,]/).filter(Boolean).length;
  if (depth >= 3) score += 30;
  else if (depth >= 2) score += 20;
  else score += 10;

  // Not too generic
  const genericCategories = ['divers', 'autre', 'other', 'général', 'produit', 'article'];
  if (!genericCategories.some(g => trimmed.toLowerCase().includes(g))) score += 25;

  // Reasonable length
  if (trimmed.length >= 5 && trimmed.length <= 100) score += 15;

  // Contains descriptive terms
  if (/[a-zÀ-ÿ]{4,}/i.test(trimmed)) score += 10;

  return Math.min(100, score);
}

function calculateLLMReadiness(title: number, desc: number, attrs: number, cat: number): number {
  // LLM readiness is how well an LLM can understand and recommend this product
  const base = title * 0.3 + desc * 0.4 + attrs * 0.2 + cat * 0.1;

  // Bonus for having all categories above threshold
  const allAbove50 = [title, desc, attrs, cat].every(s => s >= 50);
  const bonus = allAbove50 ? 10 : 0;

  return Math.min(100, Math.round(base + bonus));
}

function calculateSemanticRichness(name: string, description: string): number {
  const text = `${name} ${description}`.toLowerCase();
  const words = text.split(/\s+/).filter(w => w.length > 3);
  const uniqueWords = new Set(words);

  // Vocabulary diversity
  const diversity = uniqueWords.size / (words.length || 1);

  // Average word length (longer words = more specific/descriptive)
  const avgLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);

  const diversityScore = Math.min(50, diversity * 100);
  const lengthScore = Math.min(50, (avgLength - 3) * 15);

  return Math.min(100, Math.round(diversityScore + lengthScore));
}

function calculateContextClarity(product: ProductToAnalyze): number {
  let score = 0;

  // Has clear product name
  if (product.name.length >= 10) score += 20;

  // Has description
  if (product.description.length >= 50) score += 20;

  // Has category
  if (product.category && product.category.length > 3) score += 15;

  // Has brand
  if (product.brand) score += 15;

  // Has price (always true in our model)
  if (product.price > 0) score += 10;

  // Has image
  if (product.imageUrl) score += 10;

  // Has attributes
  if (product.attributes && Object.keys(product.attributes).length > 0) score += 10;

  return Math.min(100, score);
}

function generateRecommendations(
  product: ProductToAnalyze,
  scores: Record<string, number>
): Recommendation[] {
  const recs: Recommendation[] = [];
  let id = 0;

  // Title recommendations
  if (scores.titleScore < 50) {
    recs.push({
      id: `rec-${++id}`,
      type: 'critical',
      category: 'Titre',
      title: 'Optimiser le titre du produit',
      description: `Le titre actuel "${product.name.substring(0, 50)}..." manque d'éléments descriptifs. Ajoutez la marque, les caractéristiques clés et le public cible. Longueur idéale : 30-80 caractères.`,
      impact: 'high',
      effort: 'easy',
      autoFixAvailable: true,
    });
  } else if (scores.titleScore < 75) {
    recs.push({
      id: `rec-${++id}`,
      type: 'warning',
      category: 'Titre',
      title: 'Améliorer la richesse du titre',
      description: 'Ajoutez des attributs clés au titre (taille, couleur, matière) pour une meilleure compréhension par les LLMs.',
      impact: 'medium',
      effort: 'easy',
      autoFixAvailable: true,
    });
  }

  // Description recommendations
  if (scores.descriptionScore < 40) {
    recs.push({
      id: `rec-${++id}`,
      type: 'critical',
      category: 'Description',
      title: 'Réécrire la description produit',
      description: 'La description est insuffisante pour le référencement LLM. Elle doit contenir au moins 150 caractères, des phrases complètes, et décrire les avantages et caractéristiques du produit.',
      impact: 'high',
      effort: 'medium',
      autoFixAvailable: true,
    });
  } else if (scores.descriptionScore < 70) {
    recs.push({
      id: `rec-${++id}`,
      type: 'warning',
      category: 'Description',
      title: 'Enrichir la description',
      description: 'Ajoutez des détails techniques, des cas d\'utilisation et des avantages concrets pour améliorer la compréhension LLM.',
      impact: 'high',
      effort: 'medium',
      autoFixAvailable: true,
    });
  }

  // Attributes recommendations
  if (scores.attributesScore < 40) {
    recs.push({
      id: `rec-${++id}`,
      type: 'critical',
      category: 'Attributs',
      title: 'Ajouter des attributs produit',
      description: 'Les attributs structurés (taille, couleur, matière, poids) sont essentiels pour que les LLMs comprennent et comparent vos produits.',
      impact: 'high',
      effort: 'easy',
      autoFixAvailable: false,
    });
  }

  if (!product.brand) {
    recs.push({
      id: `rec-${++id}`,
      type: 'warning',
      category: 'Attributs',
      title: 'Ajouter la marque',
      description: 'La marque est un critère majeur de recommandation par les LLMs. Les produits avec marque sont 40% plus susceptibles d\'être recommandés.',
      impact: 'high',
      effort: 'easy',
      autoFixAvailable: false,
    });
  }

  // Category recommendations
  if (scores.categoryScore < 50) {
    recs.push({
      id: `rec-${++id}`,
      type: 'warning',
      category: 'Catégorie',
      title: 'Préciser la catégorie produit',
      description: 'Utilisez une hiérarchie de catégories (ex: "Mode > Chaussures > Baskets") pour un meilleur positionnement dans les réponses LLM.',
      impact: 'medium',
      effort: 'easy',
      autoFixAvailable: false,
    });
  }

  // Image recommendation
  if (!product.imageUrl) {
    recs.push({
      id: `rec-${++id}`,
      type: 'info',
      category: 'Média',
      title: 'Ajouter une image produit',
      description: 'Les produits avec images ont un taux de conversion 60% supérieur. Les LLMs multimodaux utilisent les images pour mieux comprendre les produits.',
      impact: 'medium',
      effort: 'easy',
      autoFixAvailable: false,
    });
  }

  // Semantic richness recommendation
  if (scores.semanticRichness < 50) {
    recs.push({
      id: `rec-${++id}`,
      type: 'info',
      category: 'Sémantique',
      title: 'Enrichir le vocabulaire',
      description: 'Diversifiez le vocabulaire utilisé dans le nom et la description. Utilisez des synonymes et termes techniques spécifiques à votre secteur.',
      impact: 'medium',
      effort: 'medium',
      autoFixAvailable: true,
    });
  }

  // Success items
  const computedOverall = scores.titleScore * 0.25 + scores.descriptionScore * 0.35 + scores.attributesScore * 0.20 + scores.categoryScore * 0.10 + scores.llmReadiness * 0.10;
  if (computedOverall >= 80) {
    recs.push({
      id: `rec-${++id}`,
      type: 'success',
      category: 'Global',
      title: 'Excellent référencement LLM',
      description: 'Ce produit est bien optimisé pour les moteurs de réponse IA. Maintenez cette qualité et pensez à publier le contexte UCP.',
      impact: 'low',
      effort: 'easy',
      autoFixAvailable: false,
    });
  }

  return recs;
}
