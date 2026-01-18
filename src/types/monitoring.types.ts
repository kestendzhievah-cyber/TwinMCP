export interface PerformanceMetrics {
  timestamp: Date;
  system: SystemMetrics;
  application: ApplicationMetrics;
  database: DatabaseMetrics;
  network: NetworkMetrics;
  business: BusinessMetrics;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    swap: {
      total: number;
      used: number;
      free: number;
    };
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
    iops: {
      read: number;
      write: number;
    };
    throughput: {
      read: number;
      write: number;
    };
  };
  processes: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
  };
  network: NetworkMetrics;
  uptime: number;
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    success: number;
    error: number;
    rate: number;
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
  };
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpu: {
    user: number;
    system: number;
    idle: number;
  };
  errors: {
    rate: number;
    total: number;
    byType: Record<string, number>;
  };
  throughput: {
    requestsPerSecond: number;
    bytesPerSecond: number;
  };
}

export interface DatabaseMetrics {
  connections: {
    active: number;
    idle: number;
    total: number;
    max: number;
  };
  queries: {
    total: number;
    select: number;
    insert: number;
    update: number;
    delete: number;
    averageTime: number;
    averageLatency: number;
    slowQueries: number;
  };
  performance: {
    cacheHitRatio: number;
    indexUsage: number;
    tableBloat: number;
    indexBloat: number;
  };
  replication: {
    lag: number;
    status: 'healthy' | 'degraded' | 'failed';
  };
  size: {
    database: number;
    tables: Record<string, number>;
    indexes: Record<string, number>;
  };
}

export interface NetworkMetrics {
  interfaces: NetworkInterface[];
  bandwidth: {
    incoming: number;
    outgoing: number;
  };
  packets: {
    incoming: number;
    outgoing: number;
    dropped: number;
    errors: number;
  };
  connections: {
    established: number;
    listening: number;
    timeWait: number;
  };
  latency: {
    average: number;
    p95: number;
    p99: number;
  };
}

export interface NetworkInterface {
  name: string;
  status: 'up' | 'down';
  speed: number;
  duplex: boolean;
  mtu: number;
  rx: {
    bytes: number;
    packets: number;
    errors: number;
    dropped: number;
  };
  tx: {
    bytes: number;
    packets: number;
    errors: number;
    dropped: number;
  };
}

export interface BusinessMetrics {
  users: {
    active: number;
    total: number;
    new: number;
    returning: number;
    churned: number;
  };
  conversations: {
    total: number;
    active: number;
    completed: number;
    averageDuration: number;
  };
  revenue: {
    total: number;
    recurring: number;
    averagePerUser: number;
  };
  features: {
    usage: Record<string, number>;
    adoption: Record<string, number>;
    used: number;
  };
}

export interface Alert {
  id: string;
  name: string;
  description: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved';
  source: string;
  metric: string;
  threshold: AlertThreshold;
  currentValue: number;
  timestamp: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  acknowledgedBy?: string;
  resolvedBy?: string;
  tags: string[];
  annotations: AlertAnnotation[];
}

export interface AlertThreshold {
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
  duration: number; // en secondes
}

export interface AlertAnnotation {
  id: string;
  timestamp: Date;
  author: string;
  message: string;
  type: 'note' | 'action' | 'resolution';
}

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  responseTime: number;
  details: Record<string, any>;
  dependencies: HealthCheck[];
}

export interface SLO {
  id: string;
  name: string;
  description: string;
  service: string;
  indicator: string;
  target: number; // pourcentage
  window: string; // ex: "30d"
  alerting: {
    burnRateAlerts: boolean;
    errorBudgetAlerts: boolean;
  };
  current: {
    availability: number;
    errorBudget: number;
    burnRate: number;
  };
}

export interface SLAReport {
  period: {
    start: Date;
    end: Date;
  };
  services: SLAService[];
  summary: {
    overallAvailability: number;
    totalDowntime: number;
    incidents: number;
    mttr: number; // Mean Time To Repair
  };
}

export interface SLAService {
  name: string;
  availability: number;
  uptime: number;
  downtime: number;
  incidents: SLAIncident[];
  sli: {
    name: string;
    value: number;
    target: number;
  };
}

export interface SLAIncident {
  id: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  impact: string;
  resolution?: string;
}

export interface PerformanceDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  filters: DashboardFilter[];
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'gauge' | 'status';
  title: string;
  query: string;
  visualization: {
    type: string;
    options: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  refreshInterval?: number;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'select' | 'date' | 'text' | 'number';
  field: string;
  options?: string[];
  defaultValue?: any;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  threshold: AlertThreshold;
  severity: Alert['severity'];
  source: string;
  tags: string[];
  enabled: boolean;
  cooldown: number; // en secondes
}

export interface MetricsQuery {
  id: string;
  name: string;
  query: string;
  description: string;
  category: string;
  tags: string[];
}

export interface MonitoringConfig {
  collection: {
    interval: number; // en secondes
    retention: number; // en jours
    batchSize: number;
  };
  alerts: {
    enabled: boolean;
    channels: NotificationChannel[];
    escalation: EscalationPolicy[];
  };
  dashboards: {
    refreshInterval: number;
    autoSave: boolean;
  };
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export interface EscalationPolicy {
  id: string;
  name: string;
  rules: EscalationRule[];
  enabled: boolean;
}

export interface EscalationRule {
  delay: number; // en minutes
  channel: string;
  conditions: {
    severity?: Alert['severity'][];
    duration?: number; // en minutes
  };
}

export interface MonitoringStats {
  totalMetrics: number;
  totalAlerts: number;
  activeAlerts: number;
  healthyServices: number;
  totalServices: number;
  uptime: number;
  lastUpdate: Date;
}

export interface SystemResource {
  name: string;
  type: 'cpu' | 'memory' | 'disk' | 'network';
  usage: number;
  capacity: number;
  available: number;
  status: 'healthy' | 'warning' | 'critical';
}
