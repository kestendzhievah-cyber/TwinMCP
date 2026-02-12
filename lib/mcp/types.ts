import { MCPTool } from './core/types';

// Interface pour les messages MCP selon le protocole JSON-RPC 2.0
export interface MCPMessage {
  jsonrpc: '2.0';
  id?: string | number | undefined;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// Configuration du serveur MCP
export interface MCPServerConfig {
  mode: 'stdio' | 'http' | 'both';
  stdio?: {
    encoding: BufferEncoding;
    delimiter: string;
  };
  http?: HttpServerConfig;
  tools: MCPServerTool[];
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    structured: boolean;
  };
}

// Configuration spécifique pour le serveur HTTP
export interface HttpServerConfig {
  port: number;
  host: string;
  cors: boolean;
  rateLimit: boolean;
  logging?: Record<string, any>;
}

// Interface pour les outils MCP adaptée pour les serveurs
export interface MCPServerTool {
  name: string;
  description: string;
  inputSchema: any;
  run: (args: any) => Promise<any>;
}

// Types pour les réponses MCP
export interface MCPToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

// Types pour les notifications MCP
export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Types pour les erreurs MCP
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Codes d'erreur MCP standard
export enum MCPErrorCodes {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  // Application-level errors (MCP spec reserves -32000 to -32099)
  ToolNotFound = -32001,
  ToolExecutionError = -32002
}

// Méthodes MCP valides
export enum MCPMethods {
  Initialize = 'initialize',
  ToolsList = 'tools/list',
  ToolsCall = 'tools/call',
  NotificationsMessage = 'notifications/message',
  NotificationsResourcesUpdated = 'notifications/resources/updated'
}

// Interface pour les capacités du serveur
export interface MCPServerCapabilities {
  tools?: {};
  logging?: {};
  resources?: {};
  prompts?: {};
}

// Interface pour les informations du serveur
export interface MCPServerInfo {
  name: string;
  version: string;
}

// Interface pour la réponse d'initialisation
export interface MCPInitializeResponse {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

// Interface pour les paramètres d'appel d'outil
export interface MCPToolCallParams {
  name: string;
  arguments?: any;
}

// Interface pour les métriques du serveur
export interface MCPServerMetrics {
  requestsTotal: number;
  requestsSuccess: number;
  requestsError: number;
  responseTimeAvg: number;
  activeConnections: number;
  toolsCallsTotal: number;
  toolsCallsSuccess: number;
  toolsCallsError: number;
  uptimeSeconds: number;
  timestamp: string;
}

// Interface pour le statut de santé
export interface MCPHealthStatus {
  healthy: boolean;
  issues: string[];
}

// Types pour les événements de métriques
export interface MCPRequestEvent {
  method: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}

export interface MCPToolCallEvent {
  toolName: string;
  duration: number;
  success: boolean;
  timestamp: Date;
}
