import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

let _shareService: any = null;
async function getShareService() {
  if (!_shareService) {
    const { pool: db } = await import('@/lib/prisma');
    const { ShareService } = await import('@/src/services/collaboration/share.service');
    _shareService = new ShareService(db);
  }
  return _shareService;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const shareService = await getShareService();
    const { conversationId, options } = await req.json();

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const share = await shareService.createShare(conversationId, userId, options);

    return NextResponse.json(share, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'CreateShare');
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthUserId(req.headers.get('authorization'));
    if (!userId) {
      throw new AuthenticationError();
    }

    const shareService = await getShareService();
    const shares = await shareService.getUserShares(userId);

    return NextResponse.json(shares);
  } catch (error) {
    return handleApiError(error, 'ListShares');
  }
}
