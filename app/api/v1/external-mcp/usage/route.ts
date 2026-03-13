import { NextRequest, NextResponse } from 'next/server';
import { externalMcpService } from '@/lib/services/external-mcp.service';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth';
import { handleApiError } from '@/lib/api-error-handler';

async function getAuthUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    const err: any = new Error('Authentication required');
    err.statusCode = 401;
    throw err;
  }
  const token = authHeader.split('Bearer ')[1];
  const adminAuth = await getFirebaseAdminAuth();
  if (!adminAuth) {
    const err: any = new Error('Firebase Admin not configured');
    err.statusCode = 500;
    throw err;
  }
  const decoded: any = await adminAuth.verifyIdToken(token);
  return decoded.uid;
}

// GET /api/v1/external-mcp/usage?serverId=xxx&days=30
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId') || undefined;
    const days = parseInt(searchParams.get('days') || '30', 10);

    const usage = await externalMcpService.getUsage(userId, serverId, days);
    return NextResponse.json({ success: true, data: usage });
  } catch (error) {
    return handleApiError(error, 'ExternalMcpUsage');
  }
}
