'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  CheckCircle,
  XCircle,
  RefreshCw,
  Wrench,
  Activity,
  Clock,
  Zap,
  AlertTriangle,
} from 'lucide-react';

interface MCPTool {
  name: string;
  description: string;
  inputSchema?: object;
}

interface MCPServerInfo {
  name: string;
  version: string;
}

interface MCPStatus {
  isOnline: boolean;
  serverInfo: MCPServerInfo | null;
  tools: MCPTool[];
  lastChecked: Date;
  responseTime: number;
  error?: string;
}

interface MCPServerStatusProps {
  onToolSelect?: (tool: MCPTool) => void;
  compact?: boolean;
}

export default function MCPServerStatus({ onToolSelect, compact = false }: MCPServerStatusProps) {
  const [status, setStatus] = useState<MCPStatus>({
    isOnline: false,
    serverInfo: null,
    tools: [],
    lastChecked: new Date(),
    responseTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkServerStatus = useCallback(async () => {
    const startTime = Date.now();
    setIsRefreshing(true);

    try {
      // Vérifier les outils MCP disponibles
      const toolsResponse = await fetch('/api/mcp/tools', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!toolsResponse.ok) {
        throw new Error(`Server responded with ${toolsResponse.status}`);
      }

      const toolsData = await toolsResponse.json();
      const responseTime = Date.now() - startTime;

      setStatus({
        isOnline: true,
        serverInfo: toolsData.serverInfo || { name: 'twinmcp-server', version: '1.0.0' },
        tools: toolsData.tools || [],
        lastChecked: new Date(),
        responseTime,
      });
    } catch (error) {
      const responseTime = Date.now() - startTime;
      setStatus({
        isOnline: false,
        serverInfo: null,
        tools: [],
        lastChecked: new Date(),
        responseTime,
        error: error instanceof Error ? error.message : 'Connection failed',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    checkServerStatus();
    
    // Vérifier le statut toutes les 30 secondes
    const interval = setInterval(checkServerStatus, 30000);
    return () => clearInterval(interval);
  }, [checkServerStatus]);

  const handleRefresh = () => {
    checkServerStatus();
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#1a1b2e] rounded-lg border border-purple-500/20">
        {isLoading ? (
          <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
        ) : status.isOnline ? (
          <CheckCircle className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-500" />
        )}
        <span className="text-sm text-gray-300">
          MCP: {status.isOnline ? 'En ligne' : 'Hors ligne'}
        </span>
        {status.isOnline && (
          <span className="text-xs text-gray-500">
            ({status.tools.length} outils)
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#1a1b2e] rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            status.isOnline 
              ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/20' 
              : 'bg-gradient-to-br from-red-500/20 to-orange-500/20'
          }`}>
            <Server className={`w-5 h-5 ${status.isOnline ? 'text-green-400' : 'text-red-400'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-white flex items-center gap-2">
              Serveur MCP
              {status.isOnline ? (
                <span className="flex items-center gap-1 text-xs font-normal text-green-400">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  En ligne
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-normal text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full" />
                  Hors ligne
                </span>
              )}
            </h3>
            {status.serverInfo && (
              <p className="text-sm text-gray-500">
                {status.serverInfo.name} v{status.serverInfo.version}
              </p>
            )}
          </div>
        </div>
        
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg hover:bg-purple-500/10 transition disabled:opacity-50"
          title="Rafraîchir le statut"
        >
          <RefreshCw className={`w-5 h-5 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-purple-500/20">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
            <Wrench className="w-4 h-4" />
            <span className="text-lg font-bold">{status.tools.length}</span>
          </div>
          <p className="text-xs text-gray-500">Outils</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
            <Zap className="w-4 h-4" />
            <span className="text-lg font-bold">{status.responseTime}</span>
            <span className="text-xs">ms</span>
          </div>
          <p className="text-xs text-gray-500">Latence</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              {status.lastChecked.toLocaleTimeString('fr-FR', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          </div>
          <p className="text-xs text-gray-500">Dernière vérif.</p>
        </div>
      </div>

      {/* Error Message */}
      {status.error && (
        <div className="px-6 py-3 bg-red-500/10 border-b border-red-500/20">
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertTriangle className="w-4 h-4" />
            <span>{status.error}</span>
          </div>
        </div>
      )}

      {/* Tools List */}
      {status.isOnline && status.tools.length > 0 && (
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Outils disponibles
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {status.tools.map((tool, index) => (
              <div
                key={index}
                onClick={() => onToolSelect?.(tool)}
                className={`p-3 rounded-lg bg-[#0f1020] border border-purple-500/10 hover:border-purple-500/30 transition ${
                  onToolSelect ? 'cursor-pointer' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-white text-sm">{tool.name}</span>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {status.isOnline && status.tools.length === 0 && (
        <div className="px-6 py-8 text-center">
          <Wrench className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">Aucun outil disponible</p>
        </div>
      )}

      {/* Offline State */}
      {!status.isOnline && !isLoading && (
        <div className="px-6 py-8 text-center">
          <XCircle className="w-8 h-8 text-red-500/50 mx-auto mb-2" />
          <p className="text-gray-500 text-sm mb-3">Le serveur MCP n'est pas accessible</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg text-sm hover:bg-purple-500/30 transition"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}
