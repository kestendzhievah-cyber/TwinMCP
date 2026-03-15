'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Server,
  Database,
  Cpu,
  HardDrive,
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Shield,
  Bell,
  BarChart3,
  Wifi,
  ChevronDown,
  ChevronUp,
  Eye,
  CheckCheck,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface StatusResponse {
  timestamp: string;
  service: {
    isRunning: boolean;
    uptime: number;
    uptimeSeconds: number;
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
  uptime: number;
}

interface Alert {
  id: string;
  name: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  timestamp: string;
  description: string;
  source: string;
  metric: string;
  currentValue: number;
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: string;
  details?: Record<string, any>;
}

interface SLO {
  id: string;
  name: string;
  service: string;
  target: number;
  current: {
    availability: number;
    errorBudget: number;
    burnRate: number;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  error: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const severityBadge: Record<string, string> = {
  critical: 'bg-red-500',
  error: 'bg-orange-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-500',
};

const statusIcon = (s: string) => {
  switch (s) {
    case 'healthy':
      return <CheckCircle className="w-4 h-4 text-green-400" />;
    case 'degraded':
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    case 'unhealthy':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const statusColor = (s: string) => {
  switch (s) {
    case 'healthy':
      return 'text-green-400';
    case 'degraded':
      return 'text-yellow-400';
    case 'unhealthy':
      return 'text-red-400';
    default:
      return 'text-gray-400';
  }
};

const serviceIcon = (name: string) => {
  if (name.includes('database') || name.includes('redis')) return <Database className="w-4 h-4" />;
  if (name.includes('api')) return <Server className="w-4 h-4" />;
  if (name.includes('auth')) return <Shield className="w-4 h-4" />;
  if (name.includes('llm') || name.includes('chat')) return <Zap className="w-4 h-4" />;
  if (name.includes('vector')) return <BarChart3 className="w-4 h-4" />;
  return <Wifi className="w-4 h-4" />;
};

function formatUptime(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  return `${days}d ${rem.toFixed(0)}h`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ── Progress bar component ─────────────────────────────────────────────────────

function ProgressBar({
  value,
  max = 100,
  color = 'purple',
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : `bg-${color}-500`;
  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-purple-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function MonitoringPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [slos, setSlos] = useState<SLO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<string>('all');

  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (!user) return {};
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {
      return {};
    }
  }, [user]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const headers = await getAuthHeaders();
      const [statusRes, alertsRes, healthRes, slosRes] = await Promise.allSettled([
        fetch('/api/monitoring/status', { headers }),
        fetch('/api/monitoring/alerts', { headers }),
        fetch('/api/monitoring/health', { headers }),
        fetch('/api/monitoring/slos', { headers }),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        setStatus(await statusRes.value.json());
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.ok) {
        const data = await alertsRes.value.json();
        setAlerts(data.alerts || []);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        const data = await healthRes.value.json();
        setHealthChecks(data.services || []);
      }
      if (slosRes.status === 'fulfilled' && slosRes.value.ok) {
        const data = await slosRes.value.json();
        setSlos(data.slos || []);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
    if (autoRefresh) {
      const interval = setInterval(fetchData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [autoRefresh, refreshInterval, fetchData]);

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts;
    return alerts.filter(a => a.severity === alertFilter);
  }, [alerts, alertFilter]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      fetchData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      fetchData();
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  // ── Loading State ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-700/50 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-800/50 rounded-xl border border-gray-700/50" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-800/50 rounded-xl border border-gray-700/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-purple-400" />
            Monitoring
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {lastRefresh
              ? `Dernière mise à jour : ${lastRefresh.toLocaleTimeString()}`
              : 'Chargement...'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={refreshInterval}
            onChange={e => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value={10}>10s</option>
            <option value={30}>30s</option>
            <option value={60}>1m</option>
            <option value={300}>5m</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              autoRefresh
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>
          <button
            onClick={fetchData}
            className="p-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* ── Status Overview Cards ──────────────────────────────────────────── */}
      {status && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* System Status */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">Système</span>
              <Activity className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              {statusIcon(status.system.status)}
              <span className={`text-xl font-bold ${statusColor(status.system.status)}`}>
                {status.system.status === 'healthy'
                  ? 'Opérationnel'
                  : status.system.status === 'degraded'
                    ? 'Dégradé'
                    : 'Incident'}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              {status.system.healthy}/{status.system.services} services OK
            </p>
          </div>

          {/* CPU */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">CPU</span>
              <Cpu className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-bold text-white">
                {status.metrics.current.cpu.toFixed(1)}%
              </span>
              {status.metrics.averages.cpu < status.metrics.current.cpu ? (
                <TrendingUp className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-400" />
              )}
            </div>
            <ProgressBar value={status.metrics.current.cpu} />
            <p className="text-xs text-gray-500 mt-1">
              Moy: {status.metrics.averages.cpu.toFixed(1)}%
            </p>
          </div>

          {/* Memory */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">Mémoire</span>
              <HardDrive className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl font-bold text-white">
                {status.metrics.current.memory.toFixed(1)}%
              </span>
              {status.metrics.averages.memory < status.metrics.current.memory ? (
                <TrendingUp className="w-4 h-4 text-red-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-green-400" />
              )}
            </div>
            <ProgressBar value={status.metrics.current.memory} />
            <p className="text-xs text-gray-500 mt-1">
              Moy: {status.metrics.averages.memory.toFixed(1)}%
            </p>
          </div>

          {/* Alerts */}
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-400">Alertes actives</span>
              <Bell className="w-4 h-4 text-gray-500" />
            </div>
            <div className="text-xl font-bold text-white mb-2">{status.alerts.total}</div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(status.alerts.bySeverity).map(([sev, count]) => (
                <span
                  key={sev}
                  className={`px-2 py-0.5 rounded text-xs font-medium ${severityColors[sev] || 'bg-gray-700 text-gray-400'}`}
                >
                  {sev}: {count}
                </span>
              ))}
              {Object.keys(status.alerts.bySeverity).length === 0 && (
                <span className="text-xs text-gray-500">Aucune alerte</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Performance Summary ────────────────────────────────────────────── */}
      {status && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
            <Zap className="w-6 h-6 mx-auto mb-2 text-blue-400" />
            <p className="text-lg font-bold text-white">{status.metrics.current.requests}</p>
            <p className="text-xs text-gray-500">Requêtes</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
            <Clock className="w-6 h-6 mx-auto mb-2 text-green-400" />
            <p className="text-lg font-bold text-white">
              {status.metrics.current.responseTime.toFixed(0)}ms
            </p>
            <p className="text-xs text-gray-500">Latence moy.</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-400" />
            <p className="text-lg font-bold text-white">{status.metrics.current.errors}</p>
            <p className="text-xs text-gray-500">Erreurs</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 text-center">
            <Server className="w-6 h-6 mx-auto mb-2 text-purple-400" />
            <p className="text-lg font-bold text-white">{formatUptime(status.uptime)}</p>
            <p className="text-xs text-gray-500">Uptime</p>
          </div>
        </div>
      )}

      {/* ── Service Health + Alerts ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Health */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-purple-400" />
              Santé des services
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {healthChecks.length === 0 && (
              <p className="text-center text-gray-500 py-6">Aucune donnée de santé</p>
            )}
            {healthChecks.map(hc => (
              <div key={hc.service}>
                <button
                  onClick={() =>
                    setExpandedService(expandedService === hc.service ? null : hc.service)
                  }
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-700/30 transition"
                >
                  <div className="flex items-center gap-3">
                    {serviceIcon(hc.service)}
                    <div className="text-left">
                      <p className="text-sm font-medium text-white">{hc.service}</p>
                      <p className="text-xs text-gray-500">{hc.responseTime}ms</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusIcon(hc.status)}
                    <span className={`text-xs font-medium ${statusColor(hc.status)}`}>
                      {hc.status}
                    </span>
                    {expandedService === hc.service ? (
                      <ChevronUp className="w-3 h-3 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-gray-500" />
                    )}
                  </div>
                </button>
                {expandedService === hc.service && hc.details && (
                  <div className="ml-10 mr-3 mb-2 p-3 bg-gray-900/50 rounded-lg text-xs text-gray-400">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(hc.details, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Active Alerts */}
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-700/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-purple-400" />
              Alertes
            </h2>
            <div className="flex gap-1">
              {['all', 'critical', 'error', 'warning', 'info'].map(f => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={`px-2 py-1 text-xs rounded-md transition ${
                    alertFilter === f
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {f === 'all' ? 'Tout' : f}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
            {filteredAlerts.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="w-8 h-8 text-green-500/50 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">Aucune alerte active</p>
              </div>
            )}
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border ${severityColors[alert.severity] || 'border-gray-700'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${severityBadge[alert.severity]}`} />
                      <p className="text-sm font-medium text-white truncate">{alert.name}</p>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{alert.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(alert.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {alert.status === 'active' && (
                      <>
                        <button
                          onClick={() => handleAcknowledge(alert.id)}
                          title="Acquitter"
                          className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-yellow-400 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResolve(alert.id)}
                          title="Résoudre"
                          className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-green-400 transition"
                        >
                          <CheckCheck className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SLOs ───────────────────────────────────────────────────────────── */}
      {slos.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl">
          <div className="px-5 py-4 border-b border-gray-700/50">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              SLOs (Service Level Objectives)
            </h2>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {slos.map(slo => {
                const onTrack = slo.current.availability >= slo.target;
                const budgetLow = slo.current.errorBudget < 20;
                return (
                  <div
                    key={slo.id}
                    className="p-4 bg-gray-900/50 rounded-lg border border-gray-700/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-white truncate">{slo.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${onTrack ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                      >
                        {onTrack ? 'On Track' : 'At Risk'}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Disponibilité</span>
                          <span className="text-white">
                            {slo.current.availability.toFixed(2)}% / {slo.target}%
                          </span>
                        </div>
                        <ProgressBar value={slo.current.availability} />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Error Budget</span>
                          <span className={budgetLow ? 'text-red-400' : 'text-white'}>
                            {slo.current.errorBudget.toFixed(1)}%
                          </span>
                        </div>
                        <ProgressBar value={slo.current.errorBudget} />
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Burn Rate</span>
                        <span
                          className={`${slo.current.burnRate > 2 ? 'text-red-400' : slo.current.burnRate > 1 ? 'text-yellow-400' : 'text-green-400'}`}
                        >
                          {slo.current.burnRate.toFixed(2)}x
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">{slo.service}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
