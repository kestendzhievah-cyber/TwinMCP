// src/types/analytics.types.ts

export interface UserAnalytics {
  userId: string;
  period: {
    start: Date;
    end: Date;
  };
  activity: {
    totalSessions: number;
    totalDuration: number;
    averageSessionDuration: number;
    lastActiveAt: Date;
    daysActive: number;
    retentionRate: number;
  };
  usage: {
    messagesSent: number;
    messagesReceived: number;
    conversationsCreated: number;
    tokensUsed: number;
    costIncurred: number;
    providersUsed: string[];
    modelsUsed: string[];
  };
  behavior: {
    peakHours: number[];
    preferredProvider: string;
    preferredModel: string;
    averageResponseTime: number;
    errorRate: number;
    featureUsage: Record<string, number>;
  };
  engagement: {
    sharesCreated: number;
    exportsGenerated: number;
    customizationsMade: number;
    feedbackGiven: number;
    supportTickets: number;
  };
}

export interface SessionAnalytics {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration: number;
  device: DeviceInfo;
  browser: BrowserInfo;
  location: LocationInfo;
  events: SessionEvent[];
  funnels: FunnelData[];
  conversions: ConversionData[];
}

export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet';
  os: string;
  osVersion: string;
  device: string;
  screenResolution: string;
  viewport: string;
  language: string;
  timezone: string;
}

export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
  cookiesEnabled: boolean;
  javascriptEnabled: boolean;
  doNotTrack: boolean;
}

export interface LocationInfo {
  country: string;
  region: string;
  city: string;
  timezone: string;
  isp: string;
}

export interface SessionEvent {
  id: string;
  sessionId: string;
  timestamp: Date;
  type: EventType;
  category: EventCategory;
  action: string;
  label?: string;
  value?: number;
  properties: Record<string, any>;
  page: PageContext;
  userContext: UserContext;
}

export interface EventType {
  name: string;
  category: 'navigation' | 'interaction' | 'conversation' | 'error' | 'performance' | 'conversion';
  schema: EventSchema;
}

export interface EventCategory {
  id: string;
  name: string;
  description: string;
  parentCategory?: string;
  metrics: string[];
}

export interface EventSchema {
  required: string[];
  optional: string[];
  types: Record<string, 'string' | 'number' | 'boolean' | 'object' | 'array'>;
}

export interface PageContext {
  url: string;
  title: string;
  referrer?: string;
  path: string;
  search: string;
  hash: string;
}

export interface UserContext {
  userId: string;
  sessionId: string;
  isNewUser: boolean;
  isNewSession: boolean;
  userProperties: Record<string, any>;
  sessionProperties: Record<string, any>;
}

export interface FunnelData {
  id: string;
  name: string;
  steps: FunnelStep[];
  users: number;
  conversionRate: number;
  averageTime: number;
  dropOffPoints: DropOffPoint[];
}

export interface FunnelStep {
  id: string;
  name: string;
  description: string;
  event: string;
  order: number;
  users: number;
  conversionRate: number;
  averageTime: number;
}

export interface DropOffPoint {
  stepId: string;
  percentage: number;
  reasons: string[];
  users: number;
}

export interface ConversionData {
  id: string;
  type: ConversionType;
  value: number;
  currency?: string;
  timestamp: Date;
  properties: Record<string, any>;
  attribution: AttributionData;
}

export interface ConversionType {
  id: string;
  name: string;
  description: string;
  value: number;
  category: 'signup' | 'subscription' | 'upgrade' | 'referral' | 'engagement';
}

export interface AttributionData {
  source: string;
  medium: string;
  campaign?: string;
  term?: string;
  content?: string;
  touchpoints: TouchpointData[];
}

export interface TouchpointData {
  timestamp: Date;
  channel: string;
  action: string;
  properties: Record<string, any>;
}

export interface UsageMetrics {
  period: {
    start: Date;
    end: Date;
  };
  users: {
    total: number;
    active: number;
    new: number;
    returning: number;
    churned: number;
    retained: number;
  };
  sessions: {
    total: number;
    averageDuration: number;
    bounceRate: number;
    pagesPerSession: number;
  };
  conversations: {
    total: number;
    averageMessages: number;
    averageTokens: number;
    averageCost: number;
    completionRate: number;
  };
  performance: {
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
    pageLoadTime: number;
  };
  revenue: {
    total: number;
    averagePerUser: number;
    averagePerSession: number;
    growth: number;
  };
}

export interface BehaviorPattern {
  id: string;
  name: string;
  description: string;
  type: 'usage' | 'engagement' | 'retention' | 'churn' | 'conversion';
  pattern: PatternDefinition;
  confidence: number;
  frequency: number;
  impact: 'low' | 'medium' | 'high';
  recommendations: string[];
  createdAt: Date;
}

export interface PatternDefinition {
  conditions: PatternCondition[];
  timeWindow: number;
  minOccurrences: number;
  aggregation: 'count' | 'sum' | 'average' | 'unique';
}

export interface PatternCondition {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains';
  value: any;
  weight?: number;
}

export interface AnalyticsInsight {
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  recommendations: string[];
  metrics: Record<string, number>;
}

export interface RealTimeMetrics {
  timestamp: Date;
  activeUsers: number;
  activeSessions: number;
  eventsPerSecond: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
}

export interface AnalyticsFilter {
  period?: {
    start: Date;
    end: Date;
  };
  userId?: string;
  provider?: string;
  model?: string;
  country?: string;
  device?: string;
  eventType?: string;
  conversion?: string;
}

export interface AnalyticsReport {
  id: string;
  name: string;
  description: string;
  type: 'user' | 'usage' | 'performance' | 'revenue' | 'custom';
  filters: AnalyticsFilter;
  metrics: string[];
  dimensions: string[];
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'funnel' | 'heatmap';
  title: string;
  description?: string;
  query: AnalyticsQuery;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    xAxis?: string;
    yAxis?: string;
    groupBy?: string;
    aggregation?: 'sum' | 'average' | 'count' | 'unique';
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  refreshInterval?: number;
}

export interface AnalyticsQuery {
  metrics: string[];
  dimensions: string[];
  filters: AnalyticsFilter;
  timeRange: {
    start: Date;
    end: Date;
  };
  granularity: 'minute' | 'hour' | 'day' | 'week' | 'month';
  limit?: number;
  offset?: number;
}

export interface AnalyticsExport {
  id: string;
  format: 'csv' | 'json' | 'xlsx' | 'pdf';
  query: AnalyticsQuery;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface EventTrackingConfig {
  events: EventType[];
  categories: EventCategory[];
  sampling: {
    enabled: boolean;
    rate: number;
  };
  privacy: {
    anonymizeIp: boolean;
    respectDoNotTrack: boolean;
    dataRetention: number; // days
  };
  performance: {
    bufferSize: number;
    flushInterval: number;
    batchSize: number;
  };
}

export interface AnalyticsSettings {
  tracking: EventTrackingConfig;
  dashboards: {
    defaultWidgets: DashboardWidget[];
    refreshInterval: number;
  };
  reports: {
    autoGenerate: boolean;
    schedule: string;
    recipients: string[];
  };
  privacy: {
    gdprCompliant: boolean;
    dataMinimization: boolean;
    userConsent: boolean;
  };
}

// Types pour les erreurs et validation
export interface AnalyticsError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  context?: string;
}

export interface ValidationRule {
  field: string;
  required: boolean;
  type: string;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface AnalyticsValidation {
  isValid: boolean;
  errors: AnalyticsError[];
  warnings: string[];
}

// Types pour l'agrégation et les calculs
export interface AggregationRule {
  metric: string;
  function: 'sum' | 'average' | 'count' | 'min' | 'max' | 'unique';
  groupBy?: string[];
  timeWindow?: string;
}

export interface MetricDefinition {
  name: string;
  description: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  unit: string;
  aggregation: AggregationRule[];
  tags?: Record<string, string>;
}

// Types pour les alertes et notifications
export interface AnalyticsAlert {
  id: string;
  name: string;
  description: string;
  condition: AlertCondition;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  enabled: boolean;
  channels: NotificationChannel[];
  cooldown: number; // minutes
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  timeWindow: number;
  aggregation: string;
  filters?: AnalyticsFilter;
}

export interface NotificationChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}
