import { NextRequest } from 'next/server';
import { analyzeProduct } from '@/lib/ucp/analyzer';
import { generateUCPContext } from '@/lib/ucp/generator';
import { createProductSchema } from '@/lib/validations';
import { parseAndValidate, apiSuccess, apiError, handleApiError } from '@/lib/api-utils';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';

const DEMO_PRODUCTS = [
  { id: '1', name: 'Nike Air Max 90 Essential Homme', description: 'Les Nike Air Max 90 Essential pour homme revisitent le design emblématique avec des matériaux modernes et un amorti Air visible au talon.', category: 'Mode > Chaussures > Baskets', brand: 'Nike', price: 139.99, attributes: { taille: '40-46', couleur: 'Blanc/Noir' }, imageUrl: null, storeId: 's1', createdAt: '2026-03-10' },
  { id: '2', name: 'MacBook Pro 14" M3 Pro', description: 'Le MacBook Pro 14 pouces avec puce M3 Pro offre des performances exceptionnelles pour les professionnels créatifs.', category: 'Électronique > Ordinateurs > Portables', brand: 'Apple', price: 2399, attributes: { processeur: 'M3 Pro', ram: '18 Go', stockage: '512 Go SSD' }, imageUrl: null, storeId: 's2', createdAt: '2026-03-12' },
  { id: '3', name: 'Crème hydratante bio', description: 'Crème pour le visage. Hydrate bien.', category: 'Cosmétiques', brand: null, price: 24.90, attributes: null, imageUrl: null, storeId: 's3', createdAt: '2026-03-13' },
] as const;

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.toLowerCase().trim() ?? '';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 100);
    const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

    let filtered = [...DEMO_PRODUCTS];
    if (query) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          (p.brand && p.brand.toLowerCase().includes(query))
      );
    }

    const enriched = filtered.map((p) => {
      const analysis = analyzeProduct({
        name: p.name,
        description: p.description,
        category: p.category,
        brand: p.brand,
        price: p.price,
        attributes: p.attributes as Record<string, string> | null,
        imageUrl: p.imageUrl,
      });
      return {
        ...p,
        score: analysis.overallScore,
        llmReadiness: analysis.llmReadiness,
      };
    });

    const paginated = enriched.slice(offset, offset + limit);

    return apiSuccess({
      items: paginated,
      total: enriched.length,
      limit,
      offset,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/products');
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const parsed = await parseAndValidate(req, createProductSchema);
    if ('error' in parsed) return parsed.error;

    const { name, description, category, brand, price, attributes } = parsed.data;

    const newProduct = {
      id: `prod-${Date.now()}`,
      name,
      description,
      category: category ?? '',
      brand: brand ?? null,
      price: price ?? 0,
      attributes: attributes ?? null,
      imageUrl: null as string | null,
      storeId: null as string | null,
      createdAt: new Date().toISOString(),
    };

    const analysis = analyzeProduct({
      name: newProduct.name,
      description: newProduct.description,
      category: newProduct.category,
      brand: newProduct.brand,
      price: newProduct.price,
      attributes: newProduct.attributes,
      imageUrl: newProduct.imageUrl,
    });

    const ucpContext = generateUCPContext({
      id: newProduct.id,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      currency: 'EUR',
      category: newProduct.category,
      brand: newProduct.brand,
      sku: null,
      imageUrl: null,
      attributes: newProduct.attributes,
      storeName: null,
    });

    return apiSuccess({ product: newProduct, analysis, ucpContext }, 201);
  } catch (error) {
    return handleApiError(error, 'POST /api/products');
  }
}
