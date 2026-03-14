import { NextRequest, NextResponse } from 'next/server';
import { validateAuthWithApiKey } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';
import {
  ensureUser,
  getApiKeyDetail,
  renameApiKey,
  revokeApiKey,
} from '@/lib/services/api-key.service';

type RouteContext = { params: Promise<{ id: string }> };

async function authenticate(request: NextRequest) {
  const result = await validateAuthWithApiKey(
    request.headers.get('authorization'),
    request.headers.get('x-api-key')
  );
  if (!result.valid) throw new AuthenticationError();
  return { userId: result.userId, email: result.email };
}

// GET — Single key detail (quotas, counters, metadata)
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authenticate(request);
    const user = await ensureUser(auth.userId, auth.email);
    const { id } = await params;

    const detail = await getApiKeyDetail(id, user.id);
    if (!detail) {
      return NextResponse.json({ success: false, error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: detail });
  } catch (error) {
    return handleApiError(error, 'GetApiKeyDetail');
  }
}

// PATCH — Rename API key
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authenticate(request);
    const user = await ensureUser(auth.userId, auth.email);
    const { id } = await params;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
    }

    if (typeof body.name !== 'string') {
      return NextResponse.json({ success: false, error: 'name is required (string)' }, { status: 400 });
    }

    const result = await renameApiKey(id, user.id, body.name);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status || 400 });
    }

    return NextResponse.json({ success: true, message: 'Key renamed' });
  } catch (error) {
    return handleApiError(error, 'RenameApiKey');
  }
}

// DELETE — Revoke API key
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authenticate(request);
    const user = await ensureUser(auth.userId, auth.email);
    const { id } = await params;

    const result = await revokeApiKey(id, user.id);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status || 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    return handleApiError(error, 'RevokeApiKey');
  }
}
