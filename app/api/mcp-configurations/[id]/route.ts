import { NextRequest, NextResponse } from 'next/server';

// GET /api/mcp-configurations/[id] - Récupérer une configuration spécifique
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Temporairement retourner une configuration mockée
    // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
    const configuration = {
      id,
      name: `Configuration ${id}`,
      description: 'Configuration MCP mockée',
      configData: '{}',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      product: { name: 'Produit Test' },
      user: { email: 'test@example.com' }
    };

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

    // Temporairement retourner une configuration mise à jour mockée
    // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
    const configuration = {
      id,
      name: name || `Configuration ${id}`,
      description: description || 'Configuration MCP mise à jour',
      configData: configData || '{}',
      status: status || 'ACTIVE',
      createdAt: new Date().toISOString(),
      product: { name: 'Produit Test' }
    };

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

    // Temporairement simuler la suppression
    // TODO: Implémenter avec le vrai client Prisma quand il sera disponible
    console.log(`Suppression de la configuration ${id}`);

    return NextResponse.json({ message: 'Configuration supprimée avec succès' });
  } catch (error) {
    console.error('Erreur lors de la suppression de la configuration:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
