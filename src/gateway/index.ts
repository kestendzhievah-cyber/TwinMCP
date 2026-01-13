import { APIGateway } from './api-gateway';
import { gatewayConfig } from '../config/gateway.config';

async function startGateway() {
  const gateway = new APIGateway(gatewayConfig);

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await gateway.stop();
    process.exit(0);
  });

  try {
    await gateway.start();
  } catch (error) {
    console.error('Failed to start gateway:', error);
    process.exit(1);
  }
}

// Start the gateway if this file is run directly
if (require.main === module) {
  startGateway();
}

export { APIGateway, startGateway };
