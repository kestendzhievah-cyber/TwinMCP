import { NextRequest } from 'next/server';
import { analyzeProduct } from '@/lib/ucp/analyzer';
import { analyzeSchema } from '@/lib/validations';
import { parseAndValidate, apiSuccess, handleApiError } from '@/lib/api-utils';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const parsed = await parseAndValidate(req, analyzeSchema);
    if ('error' in parsed) return parsed.error;

    const { name, description, category, brand, price, attributes, imageUrl } = parsed.data;

    const analysis = analyzeProduct({
      name,
      description,
      category: category ?? '',
      brand: brand ?? null,
      price: price ?? 0,
      attributes: attributes ?? null,
      imageUrl: imageUrl ?? null,
    });

    return apiSuccess(analysis);
  } catch (error) {
    return handleApiError(error, 'POST /api/analyze');
  }
}
