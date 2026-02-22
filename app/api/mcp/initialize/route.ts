import { logger } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server';
import { mcpTools, serverInfo } from '@/lib/mcp-tools';
import { loadClientConfig } from '@/lib/loadClientConfig';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientName = searchParams.get('clientName') || 'Axe Wash';

    // Charger la configuration du client
    const config = await loadClientConfig(clientName);

    // Initialiser le serveur MCP
    const initializedServer = {
      ...serverInfo,
      client: {
        name: config.name,
        activeModules: config.modules,
        apiKeysConfigured: Object.keys(config.apiKeys).length,
        settings: config.settings,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      message: `MCP Server initialisÃ© pour le client ${config.name}`,
      data: initializedServer,
    });
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation du serveur MCP:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientName } = body;

    // Charger la configuration du client
    const config = await loadClientConfig(clientName || 'Axe Wash');

    // Initialiser le serveur MCP avec configuration complÃ¨te
    const initializedServer = {
      ...serverInfo,
      client: {
        name: config.name,
        activeModules: config.modules,
        apiKeysConfigured: Object.keys(config.apiKeys).length,
        settings: config.settings,
        timestamp: new Date().toISOString(),
      },
      availableTools: mcpTools.map(tool => tool.name),
    };

    return NextResponse.json({
      success: true,
      message: `MCP Server initialisÃ© avec succÃ¨s pour ${config.name}`,
      data: initializedServer,
    });
  } catch (error) {
    logger.error('Erreur lors de l\'initialisation du serveur MCP:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
