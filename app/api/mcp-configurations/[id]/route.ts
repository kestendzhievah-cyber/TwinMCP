import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUserId } from '@/lib/firebase-admin-auth';
import { AuthenticationError } from '@/lib/errors';
import { handleApiError } from '@/lib/api-error-handler';

// GET /api/mcp-configurations/[id] - Récupérer une configuration spécifique
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { id } = await params;

    const configuration = await prisma.mCPConfiguration.findUnique({
      where: { id },
    });

    if (!configuration || configuration.userId !== userId) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    return NextResponse.json(configuration);
  } catch (error) {
    return handleApiError(error, 'GetMcpConfiguration');
  }
}

// PUT /api/mcp-configurations/[id] - Mettre à jour une configuration
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { id } = await params;

    // Verify ownership before update
    const existing = await prisma.mCPConfiguration.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    const body = await request.json();
    // Whitelist only safe fields to prevent mass assignment
    const data: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.length <= 200) data.name = body.name;
    if (typeof body.description === 'string' && body.description.length <= 2000) data.description = body.description;
    if (body.configData !== undefined) {
      try {
        data.configData = typeof body.configData === 'string' ? JSON.parse(body.configData) : body.configData;
      } catch {
        return NextResponse.json({ error: 'Invalid configData JSON' }, { status: 400 });
      }
    }
    if (typeof body.status === 'string' && ['ACTIVE', 'INACTIVE', 'TESTING', 'ERROR'].includes(body.status)) {
      data.status = body.status;
    }

    const configuration = await prisma.mCPConfiguration.update({
      where: { id },
      data,
    });

    return NextResponse.json(configuration);
  } catch (error) {
    return handleApiError(error, 'UpdateMcpConfiguration');
  }
}

// DELETE /api/mcp-configurations/[id] - Supprimer une configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthUserId(request.headers.get('authorization'));
    if (!userId) throw new AuthenticationError();

    const { id } = await params;

    // Verify ownership before delete
    const existing = await prisma.mCPConfiguration.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    await prisma.mCPConfiguration.delete({ where: { id } });

    return NextResponse.json({ message: 'Configuration supprimée avec succès' });
  } catch (error) {
    return handleApiError(error, 'DeleteMcpConfiguration');
  }
}
