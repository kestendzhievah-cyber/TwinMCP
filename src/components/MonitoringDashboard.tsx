'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Server,
  Database,
  Wifi,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw
} from 'lucide-react';

interface Metrics {
  timestamp: string;
  system: {
    cpu: { usage: number };
    memory: { used: number; total: number };
    disk: { used: number; total: number };
  };
  application: {
    requests: { total: number; averageLatency: number };
    errors: { total: number };
  };
}

interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  description: string;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: string;
}

interface StatusResponse {
  timestamp: string;
  service: {
    isRunning: boolean;
    uptime: number;
    alertsCount: number;
  };
  system: {
    status: string;
    services: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  metrics: {
    current: {
      cpu: number;
      memory: number;
      responseTime: number;
      requests: number;
      errors: number;
    };
    averages: {
      cpu: number;
      memory: number;
      responseTime: number;
    };
  };
  alerts: {
    total: number;
    bySeverity: Record<string, number>;
  };
}

export default function MonitoringDashboard() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const [statusRes, metricsRes, alertsRes, healthRes] = await Promise.all([
        fetch('/api/monitoring/status'),
        fetch('/api/monitoring/metrics'),
        fetch('/api/monitoring/alerts'),
        fetch('/api/monitoring/health')
      ]);

      if (!statusRes.ok || !metricsRes.ok || !alertsRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const [statusData, metricsData, alertsData, healthData] = await Promise.all([
        statusRes.json(),
        metricsRes.json(),
        alertsRes.json(),
        healthRes.json()
      ]);

      setStatus(statusData);
      setMetrics(metricsData.metrics || []);
      setAlerts(alertsData.alerts || []);
      setHealthChecks(healthData.services || []);
    } catch (error) {
      console.error('Error fetching monitoring data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, refreshInterval]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'error': return 'bg-red-400 text-white';
      case 'warning': return 'bg-yellow-500 text-white';
      case 'info': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="w-4 h-4" />;
      case 'degraded': return <AlertTriangle className="w-4 h-4" />;
      case 'unhealthy': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Monitoring Dashboard</h1>
          <p className="text-gray-600">System performance and health monitoring</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
          <Button onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Status</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                {getStatusIcon(status.system.status)}
                <span className={`text-2xl font-bold ${getStatusColor(status.system.status)}`}>
                  {status.system.status.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {status.system.healthy}/{status.system.services} services healthy
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{status.metrics.current.cpu.toFixed(1)}%</span>
                {status.metrics.averages.cpu < status.metrics.current.cpu ? (
                  <TrendingUp className="w-4 h-4 text-red-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {status.metrics.averages.cpu.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{status.metrics.current.memory.toFixed(1)}%</span>
                {status.metrics.averages.memory < status.metrics.current.memory ? (
                  <TrendingUp className="w-4 h-4 text-red-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-green-500" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {status.metrics.averages.memory.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{status.alerts.total}</div>
              <p className="text-xs text-muted-foreground">
                {Object.entries(status.alerts.bySeverity).map(([severity, count]) => (
                  <span key={severity} className="mr-2">
                    <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(severity)}`}>
                      {severity}: {count}
                    </span>
                  </span>
                ))}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Health Checks */}
      <Card>
        <CardHeader>
          <CardTitle>Service Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {healthChecks.map((health) => (
              <div key={health.service} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(health.status)}
                  <div>
                    <p className="font-medium">{health.service}</p>
                    <p className="text-sm text-gray-500">{health.responseTime}ms</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(health.status)}`}>
                  {health.status}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getSeverityColor(alert.severity)}`} />
                  <div>
                    <p className="font-medium">{alert.name}</p>
                    <p className="text-sm text-gray-500">{alert.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-1 rounded text-xs ${getStatusColor(alert.status)}`}>
                    {alert.status}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <p className="text-center text-gray-500 py-8">No active alerts</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <Zap className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold">{status?.metrics.current.requests || 0}</p>
              <p className="text-sm text-gray-500">Total Requests</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Clock className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">{status?.metrics.current.responseTime.toFixed(0) || 0}ms</p>
              <p className="text-sm text-gray-500">Avg Response Time</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-2xl font-bold">{status?.metrics.current.errors || 0}</p>
              <p className="text-sm text-gray-500">Total Errors</p>
            </div>
            <div className="text-center p-4 border rounded-lg">
              <Server className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold">{status?.service.uptime.toFixed(1) || 0}h</p>
              <p className="text-sm text-gray-500">Uptime</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
