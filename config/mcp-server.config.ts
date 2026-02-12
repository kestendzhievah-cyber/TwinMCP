import { MCPServerConfig } from '../lib/mcp/types';

export const mcpServerConfig: MCPServerConfig = {
  mode: (process.env['MCP_SERVER_MODE'] as 'stdio' | 'http' | 'both') || 'stdio',
  
  stdio: {
    encoding: 'utf8',
    delimiter: '\n'
  },
  
  http: {
    port: parseInt(process.env['HTTP_PORT'] || '3000'),
    host: process.env['HTTP_HOST'] || 'localhost',
    cors: process.env['HTTP_CORS'] === 'true',
    rateLimit: process.env['HTTP_RATE_LIMIT'] === 'true',
    logging: {
      level: process.env['LOG_LEVEL'] || 'info',
      prettyPrint: process.env['NODE_ENV'] !== 'production'
    }
  },
  
  tools: [], // Sera populated dynamiquement
  
  logging: {
    level: (process.env['LOG_LEVEL'] as 'debug' | 'info' | 'warn' | 'error') || 'info',
    structured: process.env['LOG_STRUCTURED'] === 'true'
  }
};

// Configuration par défaut pour le développement
export const devConfig: MCPServerConfig = {
  ...mcpServerConfig,
  mode: 'stdio',
  logging: {
    level: 'debug',
    structured: false
  }
};

// Configuration par défaut pour la production
export const prodConfig: MCPServerConfig = {
  ...mcpServerConfig,
  mode: 'http',
  http: {
    port: 3000,
    host: '0.0.0.0',
    cors: true,
    rateLimit: true,
    logging: {
      level: 'info',
      prettyPrint: false
    }
  },
  logging: {
    level: 'info',
    structured: true
  }
};

// Configuration pour les tests
export const testConfig: MCPServerConfig = {
  ...mcpServerConfig,
  mode: 'stdio',
  logging: {
    level: 'error',
    structured: false
  }
};

// Fonction pour obtenir la configuration actuelle
export function getCurrentConfig(): MCPServerConfig {
  const nodeEnv = process.env['NODE_ENV'] || 'development';
  
  switch (nodeEnv) {
    case 'production':
      return prodConfig;
    case 'test':
      return testConfig;
    default:
      return devConfig;
  }
}

// Validation de la configuration
export function validateConfig(config: MCPServerConfig): void {
  if (!config.mode || !['stdio', 'http', 'both'].includes(config.mode)) {
    throw new Error('Invalid server mode');
  }
  
  if (config.http) {
    if (!config.http.port || config.http.port < 1 || config.http.port > 65535) {
      throw new Error('Invalid HTTP port');
    }
    
    if (!config.http.host) {
      throw new Error('HTTP host is required');
    }
  }
  
  if (!config.tools || !Array.isArray(config.tools)) {
    throw new Error('Tools must be an array');
  }
}
