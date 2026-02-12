import { NextRequest, NextResponse } from 'next/server';
import { ShareService } from '@/src/services/collaboration/share.service';

import { pool as db } from '@/lib/prisma'

const shareService = new ShareService(db);

export async function POST(req: NextRequest) {
  try {
    const { conversationId, userId, options } = await req.json();

    if (!conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const share = await shareService.createShare(conversationId, userId, options);

    return NextResponse.json(share, { status: 201 });
  } catch (error: any) {
    console.error('Error creating share:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create share' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const shares = await shareService.getUserShares(userId);

    return NextResponse.json(shares);
  } catch (error: any) {
    console.error('Error fetching shares:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch shares' },
      { status: 500 }
    );
  }
}
