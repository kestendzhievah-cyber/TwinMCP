// Point d'entrée principal de l'application
import { startGateway } from './gateway/index.js';

console.log('TwinMCP Server starting...');

// Démarrer l'API Gateway
startGateway().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
