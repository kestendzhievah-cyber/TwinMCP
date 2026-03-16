import { NextRequest } from 'next/server';
import { generateUCPContext, validateUCPContext } from '@/lib/ucp/generator';
import { ucpContextSchema } from '@/lib/validations';
import { parseAndValidate, apiSuccess, handleApiError } from '@/lib/api-utils';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const parsed = await parseAndValidate(req, ucpContextSchema);
    if ('error' in parsed) return parsed.error;

    const { id, name, description, price, currency, category, brand, sku, imageUrl, attributes, storeName, availability } = parsed.data;

    const context = generateUCPContext({
      id: id ?? `prod-${Date.now()}`,
      name,
      description,
      price: price ?? 0,
      currency: currency ?? 'EUR',
      category: category ?? '',
      brand: brand ?? null,
      sku: sku ?? null,
      imageUrl: imageUrl ?? null,
      attributes: attributes ?? null,
      storeName: storeName ?? null,
      availability: availability ?? null,
    });

    const validation = validateUCPContext(context);

    return apiSuccess({ context, validation });
  } catch (error) {
    return handleApiError(error, 'POST /api/ucp-context');
  }
}
