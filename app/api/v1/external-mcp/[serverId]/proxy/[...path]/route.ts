import { NextRequest, NextResponse } from 'next/server'
import { externalMcpService } from '@/lib/services/external-mcp.service'
import { auth } from '@/lib/firebase-admin'

async function getAuthUserId(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    const err: any = new Error('Authentication required')
    err.statusCode = 401
    throw err
  }
  const token = authHeader.split('Bearer ')[1]
  const decoded: any = await auth.verifyIdToken(token)
  return decoded.uid
}

async function handleProxy(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string; path: string[] }> }
) {
  try {
    const userId = await getAuthUserId(request)
    const { serverId, path } = await params
    const targetPath = path.join('/')

    let body: any = undefined
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      try {
        body = await request.json()
      } catch {
        // no body
      }
    }

    const result = await externalMcpService.proxy(serverId, userId, userId, targetPath, request.method, body)

    return NextResponse.json(result.data, { status: result.status })
  } catch (error: any) {
    const status = error.statusCode || 502
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    )
  }
}

export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const DELETE = handleProxy
