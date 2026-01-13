import { EventEmitter } from 'events';
import { MCPRequestEvent, MCPToolCallEvent, MCPServerMetrics as IMCPServerMetrics, MCPHealthStatus } from '../types';

export class MCPServerMetrics extends EventEmitter {
  private metrics: Map<string, number> = new Map();
  private startTime: Date = new Date();
  private requestHistory: MCPRequestEvent[] = [];
  private toolCallHistory: MCPToolCallEvent[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    super();
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    this.metrics.set('requests_total', 0);
    this.metrics.set('requests_success', 0);
    this.metrics.set('requests_error', 0);
    this.metrics.set('response_time_avg', 0);
    this.metrics.set('response_time_min', Infinity);
    this.metrics.set('response_time_max', 0);
    this.metrics.set('active_connections', 0);
    this.metrics.set('tools_calls_total', 0);
    this.metrics.set('tools_calls_success', 0);
    this.metrics.set('tools_calls_error', 0);
    this.metrics.set('tools_response_time_avg', 0);
    this.metrics.set('tools_response_time_min', Infinity);
    this.metrics.set('tools_response_time_max', 0);
  }

  recordRequest(method: string, duration: number, success: boolean): void {
    this.metrics.set('requests_total', this.metrics.get('requests_total')! + 1);
    
    if (success) {
      this.metrics.set('requests_success', this.metrics.get('requests_success')! + 1);
    } else {
      this.metrics.set('requests_error', this.metrics.get('requests_error')! + 1);
    }
    
    // Mettre à jour les temps de réponse
    this.updateResponseTimeMetrics('response_time', duration);
    
    // Ajouter à l'historique
    const event: MCPRequestEvent = {
      method,
      duration,
      success,
      timestamp: new Date()
    };
    
    this.requestHistory.push(event);
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }
    
    this.emit('request', event);
  }

  recordToolCall(toolName: string, duration: number, success: boolean): void {
    this.metrics.set('tools_calls_total', this.metrics.get('tools_calls_total')! + 1);
    
    if (success) {
      this.metrics.set('tools_calls_success', this.metrics.get('tools_calls_success')! + 1);
    } else {
      this.metrics.set('tools_calls_error', this.metrics.get('tools_calls_error')! + 1);
    }
    
    // Mettre à jour les temps de réponse des outils
    this.updateResponseTimeMetrics('tools_response_time', duration);
    
    // Ajouter à l'historique
    const event: MCPToolCallEvent = {
      toolName,
      duration,
      success,
      timestamp: new Date()
    };
    
    this.toolCallHistory.push(event);
    if (this.toolCallHistory.length > this.maxHistorySize) {
      this.toolCallHistory.shift();
    }
    
    this.emit('tool_call', event);
  }

  private updateResponseTimeMetrics(prefix: string, duration: number): void {
    const avgKey = `${prefix}_avg`;
    const minKey = `${prefix}_min`;
    const maxKey = `${prefix}_max`;
    
    // Mettre à jour le temps de réponse moyen
    const currentAvg = this.metrics.get(avgKey)!;
    const totalRequests = this.metrics.get('requests_total')!;
    const newAvg = (currentAvg * (totalRequests - 1) + duration) / totalRequests;
    this.metrics.set(avgKey, newAvg);
    
    // Mettre à jour le min
    const currentMin = this.metrics.get(minKey)!;
    this.metrics.set(minKey, Math.min(currentMin, duration));
    
    // Mettre à jour le max
    const currentMax = this.metrics.get(maxKey)!;
    this.metrics.set(maxKey, Math.max(currentMax, duration));
  }

  incrementActiveConnections(): void {
    this.metrics.set('active_connections', this.metrics.get('active_connections')! + 1);
  }

  decrementActiveConnections(): void {
    const current = this.metrics.get('active_connections')!;
    this.metrics.set('active_connections', Math.max(0, current - 1));
  }

  getMetrics(): IMCPServerMetrics {
    return {
      requestsTotal: this.metrics.get('requests_total')!,
      requestsSuccess: this.metrics.get('requests_success')!,
      requestsError: this.metrics.get('requests_error')!,
      responseTimeAvg: this.metrics.get('response_time_avg')!,
      activeConnections: this.metrics.get('active_connections')!,
      toolsCallsTotal: this.metrics.get('tools_calls_total')!,
      toolsCallsSuccess: this.metrics.get('tools_calls_success')!,
      toolsCallsError: this.metrics.get('tools_calls_error')!,
      uptimeSeconds: Math.floor((Date.now() - this.startTime.getTime()) / 1000),
      timestamp: new Date().toISOString()
    };
  }

  getDetailedMetrics(): any {
    return {
      ...this.getMetrics(),
      responseTimeMin: this.metrics.get('response_time_min') === Infinity ? 0 : this.metrics.get('response_time_min'),
      responseTimeMax: this.metrics.get('response_time_max'),
      toolsResponseTimeAvg: this.metrics.get('tools_response_time_avg'),
      toolsResponseTimeMin: this.metrics.get('tools_response_time_min') === Infinity ? 0 : this.metrics.get('tools_response_time_min'),
      toolsResponseTimeMax: this.metrics.get('tools_response_time_max'),
      requestRate: this.calculateRequestRate(),
      toolCallRate: this.calculateToolCallRate(),
      errorRate: this.calculateErrorRate(),
      successRate: this.calculateSuccessRate()
    };
  }

  private calculateRequestRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestHistory.filter(req => req.timestamp.getTime() > oneMinuteAgo);
    return recentRequests.length;
  }

  private calculateToolCallRate(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentToolCalls = this.toolCallHistory.filter(call => call.timestamp.getTime() > oneMinuteAgo);
    return recentToolCalls.length;
  }

  private calculateErrorRate(): number {
    const total = this.metrics.get('requests_total')!;
    if (total === 0) return 0;
    return this.metrics.get('requests_error')! / total;
  }

  private calculateSuccessRate(): number {
    const total = this.metrics.get('requests_total')!;
    if (total === 0) return 0;
    return this.metrics.get('requests_success')! / total;
  }

  getHealthStatus(): MCPHealthStatus {
    const issues: string[] = [];
    const errorRate = this.calculateErrorRate();
    const avgResponseTime = this.metrics.get('response_time_avg')!;
    const activeConnections = this.metrics.get('active_connections')!;
    
    // Seuils d'alerte
    if (errorRate > 0.1) { // 10% d'erreurs
      issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    if (avgResponseTime > 1000) { // 1 seconde
      issues.push(`High response time: ${avgResponseTime.toFixed(2)}ms`);
    }
    
    if (activeConnections > 100) {
      issues.push(`High connection count: ${activeConnections}`);
    }
    
    // Vérifier si le serveur est récemment actif
    const timeSinceLastRequest = Date.now() - this.getLastRequestTime();
    if (timeSinceLastRequest > 300000) { // 5 minutes
      issues.push('No recent activity');
    }
    
    return {
      healthy: issues.length === 0,
      issues
    };
  }

  private getLastRequestTime(): number {
    if (this.requestHistory.length === 0) {
      return this.startTime.getTime();
    }
    const lastRequest = this.requestHistory[this.requestHistory.length - 1];
    return lastRequest ? lastRequest.timestamp.getTime() : this.startTime.getTime();
  }

  getToolUsageStats(): any {
    const toolStats: Map<string, { count: number; success: number; error: number; avgDuration: number }> = new Map();
    
    this.toolCallHistory.forEach(call => {
      const existing = toolStats.get(call.toolName) || { count: 0, success: 0, error: 0, avgDuration: 0 };
      
      existing.count++;
      if (call.success) {
        existing.success++;
      } else {
        existing.error++;
      }
      
      // Mettre à jour la durée moyenne
      existing.avgDuration = (existing.avgDuration * (existing.count - 1) + call.duration) / existing.count;
      
      toolStats.set(call.toolName, existing);
    });
    
    return Object.fromEntries(toolStats);
  }

  getMethodUsageStats(): any {
    const methodStats: Map<string, { count: number; success: number; error: number; avgDuration: number }> = new Map();
    
    this.requestHistory.forEach(req => {
      const existing = methodStats.get(req.method) || { count: 0, success: 0, error: 0, avgDuration: 0 };
      
      existing.count++;
      if (req.success) {
        existing.success++;
      } else {
        existing.error++;
      }
      
      // Mettre à jour la durée moyenne
      existing.avgDuration = (existing.avgDuration * (existing.count - 1) + req.duration) / existing.count;
      
      methodStats.set(req.method, existing);
    });
    
    return Object.fromEntries(methodStats);
  }

  reset(): void {
    this.initializeMetrics();
    this.requestHistory = [];
    this.toolCallHistory = [];
    this.startTime = new Date();
    this.emit('reset');
  }

  // Méthodes pour l'exportation des métriques
  exportMetrics(): string {
    return JSON.stringify(this.getDetailedMetrics(), null, 2);
  }

  // Méthodes pour le monitoring en temps réel
  startRealtimeMonitoring(intervalMs: number = 1000): void {
    setInterval(() => {
      this.emit('realtime_metrics', this.getDetailedMetrics());
    }, intervalMs);
  }

  // Méthodes pour les alertes
  setupAlerts(_thresholds: { errorRate?: number; responseTime?: number; connections?: number }): void {
    this.on('request', () => {
      const health = this.getHealthStatus();
      if (!health.healthy) {
        this.emit('alert', health);
      }
    });
  }
}
