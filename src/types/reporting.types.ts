export interface Report {
  id: string;
  name: string;
  description: string;
  type: ReportType;
  category: ReportCategory;
  frequency: ReportFrequency;
  status: 'draft' | 'scheduled' | 'generating' | 'completed' | 'failed';
  config: ReportConfig;
  schedule?: ReportSchedule;
  lastRun?: Date;
  nextRun?: Date;
  createdBy: string;
  recipients: ReportRecipient[];
  output: ReportOutput;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
    tags: string[];
  };
}

export interface ReportType {
  id: string;
  name: string;
  description: string;
  category: 'analytics' | 'performance' | 'business' | 'compliance' | 'custom';
  template: ReportTemplate;
  requiredData: string[];
  outputFormats: ReportFormat[];
}

export interface ReportCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export interface ReportFrequency {
  type: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  interval?: number;
  timezone: string;
}

export interface ReportConfig {
  period: {
    start: Date;
    end: Date;
    dynamic?: boolean;
    relative?: string;
  };
  filters: ReportFilter[];
  metrics: ReportMetric[];
  dimensions: ReportDimension[];
  visualizations: ReportVisualization[];
  insights: {
    enabled: boolean;
    types: InsightType[];
    threshold: number;
  };
  output: {
    format: ReportFormat;
    template?: string;
    branding: boolean;
    watermark?: boolean;
  };
}

export interface ReportFilter {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains';
  value: any;
  label?: string;
}

export interface ReportMetric {
  id: string;
  name: string;
  formula?: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' | 'percentile';
  format: 'number' | 'percentage' | 'currency' | 'duration';
  precision?: number;
}

export interface ReportDimension {
  id: string;
  name: string;
  field: string;
  type: 'categorical' | 'temporal' | 'numerical';
  hierarchy?: string[];
}

export interface ReportVisualization {
  id: string;
  type: 'table' | 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'gauge';
  title: string;
  metrics: string[];
  dimensions: string[];
  options: VisualizationOptions;
}

export interface VisualizationOptions {
  colors?: string[];
  legend?: boolean;
  grid?: boolean;
  axes?: {
    x?: AxisOptions;
    y?: AxisOptions;
  };
  tooltip?: boolean;
  animation?: boolean;
}

export interface AxisOptions {
  title?: string;
  format?: string;
  min?: number;
  max?: number;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: ReportFrequency;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
  };
  notifications: {
    onSuccess: boolean;
    onFailure: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
  };
}

export interface ReportRecipient {
  id: string;
  type: 'user' | 'group' | 'email' | 'webhook';
  address: string;
  permissions: {
    view: boolean;
    edit: boolean;
    share: boolean;
  };
}

export interface ReportOutput {
  format: ReportFormat;
  url?: string;
  size?: number;
  pages?: number;
  generatedAt?: Date;
  expiresAt?: Date;
  downloadCount?: number;
}

export interface ReportFormat {
  id: string;
  name: string;
  extension: string;
  mimeType: string;
  template: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  layout: TemplateLayout;
  sections: TemplateSection[];
  styling: TemplateStyling;
}

export interface TemplateLayout {
  type: 'single-page' | 'multi-page' | 'dashboard';
  orientation: 'portrait' | 'landscape';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TemplateSection {
  id: string;
  type: 'header' | 'content' | 'chart' | 'table' | 'footer';
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  content: any;
  styling: SectionStyling;
}

export interface TemplateStyling {
  theme: string;
  colors: Record<string, string>;
  fonts: Record<string, string>;
  logo?: string;
  footer?: string;
}

export interface SectionStyling {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  padding?: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  impact: 'low' | 'medium' | 'high';
  data: InsightData;
  recommendations: InsightRecommendation[];
  timestamp: Date;
  reportId?: string;
}

export interface InsightType {
  id: string;
  name: string;
  description: string;
  category: 'trend' | 'anomaly' | 'correlation' | 'opportunity' | 'risk';
  algorithm: string;
  parameters: Record<string, any>;
}

export interface InsightData {
  metric: string;
  value: number;
  baseline: number;
  change: number;
  changePercent: number;
  period: string;
  significance: number;
  context: Record<string, any>;
}

export interface InsightRecommendation {
  id: string;
  action: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  timeline?: string;
  resources?: string[];
}

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  type: 'operational' | 'analytical' | 'strategic';
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  filters: DashboardFilter[];
  refreshInterval: number;
  permissions: DashboardPermissions;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive: boolean;
}

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'kpi' | 'text' | 'image';
  title: string;
  query: string;
  visualization: WidgetVisualization;
  position: WidgetPosition;
  refreshInterval?: number;
  interactions: WidgetInteraction[];
}

export interface WidgetVisualization {
  type: string;
  options: Record<string, any>;
  colors?: string[];
  thresholds?: Array<{
    value: number;
    color: string;
    label?: string;
  }>;
}

export interface WidgetPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetInteraction {
  type: 'click' | 'hover' | 'filter' | 'drill-down';
  action: string;
  target?: string;
}

export interface DashboardFilter {
  id: string;
  name: string;
  type: 'select' | 'date' | 'range' | 'text';
  field: string;
  options?: string[];
  defaultValue?: any;
  required?: boolean;
}

export interface DashboardPermissions {
  view: string[];
  edit: string[];
  share: string[];
  public: boolean;
}

export interface ReportGeneration {
  id: string;
  reportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: {
    percentage: number;
    currentStep: string;
    estimatedTime?: number;
  };
  config: ReportConfig;
  data: any;
  output: ReportOutput;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

export interface Invoice {
  id: string;
  userId: string;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issueDate: Date;
  dueDate: Date;
  paidDate?: Date;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  items: InvoiceItem[];
  billingAddress: BillingAddress;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: number;
  };
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  period?: string;
  metadata?: Record<string, any>;
}

export interface BillingAddress {
  name: string;
  email: string;
  phone?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}
