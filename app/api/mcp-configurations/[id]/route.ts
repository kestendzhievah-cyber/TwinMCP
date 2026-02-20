import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/mcp-configurations/[id] - Récupérer une configuration spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const configuration = await prisma.mCPConfiguration.findUnique({
      where: { id },
    });

    if (!configuration) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    return NextResponse.json(configuration);
  } catch (error) {
    console.error('Erreur lors de la récupération de la configuration:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// PUT /api/mcp-configurations/[id] - Mettre à jour une configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, configData, status } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (configData !== undefined) data.configData = typeof configData === 'string' ? JSON.parse(configData) : configData;
    if (status !== undefined) data.status = status;

    const configuration = await prisma.mCPConfiguration.update({
      where: { id },
      data,
    });

    return NextResponse.json(configuration);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la configuration:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}

// DELETE /api/mcp-configurations/[id] - Supprimer une configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.mCPConfiguration.delete({ where: { id } });

    return NextResponse.json({ message: 'Configuration supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la configuration:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
