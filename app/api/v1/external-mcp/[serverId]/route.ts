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

// GET /api/v1/external-mcp/[serverId] — Get server details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request)
    const { serverId } = await params
    const server = await externalMcpService.getById(serverId, userId)
    if (!server) {
      return NextResponse.json({ success: false, error: 'Server not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: server })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode || 500 }
    )
  }
}

// PUT /api/v1/external-mcp/[serverId] — Update server
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request)
    const { serverId } = await params
    const body = await request.json()
    const server = await externalMcpService.update(serverId, userId, body)
    return NextResponse.json({ success: true, data: server })
  } catch (error: any) {
    const status = error.message === 'Server not found' ? 404 : error.statusCode || 500
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    )
  }
}

// DELETE /api/v1/external-mcp/[serverId] — Delete server
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const userId = await getAuthUserId(request)
    const { serverId } = await params
    await externalMcpService.delete(serverId, userId)
    return NextResponse.json({ success: true, message: 'Server deleted' })
  } catch (error: any) {
    const status = error.message === 'Server not found' ? 404 : error.statusCode || 500
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    )
  }
}
