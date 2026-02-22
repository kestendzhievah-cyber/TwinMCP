import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'
import { docsGenerator } from '@/lib/mcp/utils/docs-generator'

// GET /api/v1/mcp/docs - GÃ©nÃ©rer la documentation
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'markdown'

    if (format === 'openapi') {
      const openapi = await docsGenerator.generateOpenAPI()
      return NextResponse.json(openapi)
    } else {
      const markdown = await docsGenerator.generateMarkdown()
      return new NextResponse(markdown, {
        headers: {
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'attachment; filename="mcp-api-docs.md"'
        }
      })
    }

  } catch (error: any) {
    logger.error('Documentation generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate documentation' },
      { status: 500 }
    )
  }
}
