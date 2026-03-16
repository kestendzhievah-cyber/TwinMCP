import { NextRequest } from 'next/server';
import { optimizeProduct } from '@/lib/ucp/optimizer';
import { optimizeSchema } from '@/lib/validations';
import { parseAndValidate, apiSuccess, handleApiError } from '@/lib/api-utils';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const parsed = await parseAndValidate(req, optimizeSchema);
    if ('error' in parsed) return parsed.error;

    const { name, description, category, brand, attributes } = parsed.data;

    const result = optimizeProduct({
      name,
      description,
      category: category ?? '',
      brand: brand ?? null,
      attributes: attributes ?? null,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error, 'POST /api/optimize');
  }
}
