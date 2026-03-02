import { NextRequest, NextResponse } from 'next/server'
import { externalMcpService } from '@/lib/services/external-mcp.service'
import { getFirebaseAdminAuth } from '@/lib/firebase-admin-auth'

async function getAuthUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    const err: any = new Error('Authentication required')
    err.statusCode = 401
    throw err
  }
  const token = authHeader.split('Bearer ')[1]
  const adminAuth = await getFirebaseAdminAuth()
  if (!adminAuth) {
    const err: any = new Error('Firebase Admin not configured')
    err.statusCode = 500
    throw err
  }
  const decoded: any = await adminAuth.verifyIdToken(token)
  return decoded.uid
}

// POST /api/v1/external-mcp/[serverId]/health — Run health check
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request)
    const { serverId } = await params
    const result = await externalMcpService.healthCheck(serverId, userId)
    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    const status = error.message === 'Server not found' ? 404 : error.statusCode || 500
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    )
  }
}
