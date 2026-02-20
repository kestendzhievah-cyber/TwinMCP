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

// GET /api/v1/external-mcp — List all external MCP servers for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    const servers = await externalMcpService.list(userId)
    return NextResponse.json({ success: true, data: servers })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode || 500 }
    )
  }
}

// POST /api/v1/external-mcp — Register a new external MCP server
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request)
    const body = await request.json()

    const { name, baseUrl, authType, secret } = body
    if (!name || !baseUrl) {
      return NextResponse.json(
        { success: false, error: 'name and baseUrl are required' },
        { status: 400 }
      )
    }

    const server = await externalMcpService.create(userId, {
      name,
      baseUrl,
      authType: authType || 'NONE',
      secret,
    })

    return NextResponse.json({ success: true, data: server }, { status: 201 })
  } catch (error: any) {
    const status = error.message.includes('Unique constraint') ? 409 : error.statusCode || 500
    return NextResponse.json(
      { success: false, error: error.message },
      { status }
    )
  }
}
