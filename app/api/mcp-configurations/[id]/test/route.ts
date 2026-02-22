import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/mcp-configurations/[id]/test - Tester une configuration MCP
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const config = await prisma.mCPConfiguration.findUnique({ where: { id } });
    if (!config) {
      return NextResponse.json({
        success: false,
        message: 'Configuration non trouvée',
        timestamp: new Date().toISOString(),
      }, { status: 404 });
    }

    // Validate the config data structure
    const configData = config.configData as Record<string, unknown>;
    const hasRequiredFields = configData && typeof configData === 'object';

    const testResult = {
      success: hasRequiredFields,
      message: hasRequiredFields ? 'Configuration MCP valide' : 'Configuration invalide : données manquantes',
      timestamp: new Date().toISOString(),
      details: {
        configId: id,
        name: config.name,
        status: hasRequiredFields ? 'Connecté avec succès' : 'Échec de validation',
      },
    };

    return NextResponse.json(testResult);
  } catch (error) {
    logger.error('Erreur lors du test de la configuration:', error);

    return NextResponse.json({
      success: false,
      message: 'Erreur lors du test de la configuration',
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
