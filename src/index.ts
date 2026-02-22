// Point d'entrée principal de l'application
import { logger } from './utils/logger';
import { startGateway } from './gateway/index.js';

logger.info('TwinMCP Server starting...');

// Démarrer l'API Gateway
startGateway().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
