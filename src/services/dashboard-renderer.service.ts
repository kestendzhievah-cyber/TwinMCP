import { Dashboard, DashboardWidget, DashboardFilter } from '../types/reporting.types';

export interface DashboardRenderRequest {
  dashboard: Dashboard;
  filters?: Record<string, any>;
}

export interface RenderedDashboard {
  id: string;
  name: string;
  description: string;
  widgets: RenderedWidget[];
  filters: DashboardFilter[];
  metadata: {
    renderedAt: Date;
    renderTime: number;
    dataPoints: number;
  };
}

export interface RenderedWidget {
  id: string;
  type: string;
  title: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  data: any;
  visualization: any;
  loading: boolean;
  error?: string;
}

export class DashboardRenderer {
  async render(request: DashboardRenderRequest): Promise<RenderedDashboard> {
    const startTime = Date.now();
    const { dashboard, filters } = request;

    const renderedWidgets: RenderedWidget[] = [];

    for (const widget of dashboard.widgets) {
      try {
        const renderedWidget = await this.renderWidget(widget, filters);
        renderedWidgets.push(renderedWidget);
      } catch (error) {
        renderedWidgets.push({
          id: widget.id,
          type: widget.type,
          title: widget.title,
          position: widget.position,
          data: null,
          visualization: widget.visualization,
          loading: false,
          error: error instanceof Error ? (error instanceof Error ? error.message : String(error)) : 'Unknown error'
        });
      }
    }

    const renderTime = Date.now() - startTime;
    const dataPoints = this.calculateDataPoints(renderedWidgets);

    return {
      id: dashboard.id,
      name: dashboard.name,
      description: dashboard.description,
      widgets: renderedWidgets,
      filters: dashboard.filters,
      metadata: {
        renderedAt: new Date(),
        renderTime,
        dataPoints
      }
    };
  }

  private async renderWidget(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<RenderedWidget> {
    const data = await this.fetchWidgetData(widget, filters);
    const visualization = await this.applyVisualization(widget, data);

    return {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      position: widget.position,
      data,
      visualization,
      loading: false
    };
  }

  private async fetchWidgetData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    switch (widget.type) {
      case 'metric':
        return await this.fetchMetricData(widget, filters);
      case 'chart':
        return await this.fetchChartData(widget, filters);
      case 'table':
        return await this.fetchTableData(widget, filters);
      case 'kpi':
        return await this.fetchKPIData(widget, filters);
      case 'text':
        return await this.fetchTextData(widget, filters);
      case 'image':
        return await this.fetchImageData(widget, filters);
      default:
        throw new Error(`Unsupported widget type: ${widget.type}`);
    }
  }

  private async fetchMetricData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);
    
    return {
      value: Math.random() * 1000,
      unit: 'units',
      trend: Math.random() > 0.5 ? 'up' : 'down',
      change: (Math.random() - 0.5) * 20,
      timestamp: new Date()
    };
  }

  private async fetchChartData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);
    
    const chartType = widget.visualization.type;
    
    switch (chartType) {
      case 'line':
        return this.generateLineChartData();
      case 'bar':
        return this.generateBarChartData();
      case 'pie':
        return this.generatePieChartData();
      case 'scatter':
        return this.generateScatterChartData();
      case 'heatmap':
        return this.generateHeatmapData();
      default:
        return this.generateDefaultChartData();
    }
  }

  private async fetchTableData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);
    
    return {
      columns: ['Name', 'Value', 'Status', 'Date'],
      rows: [
        ['Item 1', Math.floor(Math.random() * 100), 'Active', new Date().toISOString()],
        ['Item 2', Math.floor(Math.random() * 100), 'Pending', new Date().toISOString()],
        ['Item 3', Math.floor(Math.random() * 100), 'Inactive', new Date().toISOString()],
        ['Item 4', Math.floor(Math.random() * 100), 'Active', new Date().toISOString()],
        ['Item 5', Math.floor(Math.random() * 100), 'Pending', new Date().toISOString()]
      ],
      pagination: {
        page: 1,
        pageSize: 10,
        total: 25
      }
    };
  }

  private async fetchKPIData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);
    
    return {
      value: Math.floor(Math.random() * 1000),
      target: 1200,
      percentage: Math.floor(Math.random() * 100),
      status: Math.random() > 0.3 ? 'good' : 'warning',
      trend: {
        direction: Math.random() > 0.5 ? 'up' : 'down',
        percentage: (Math.random() - 0.5) * 20
      },
      metadata: {
        lastUpdated: new Date(),
        source: 'database'
      }
    };
  }

  private async fetchTextData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    return {
      content: 'This is a text widget with important information.',
      format: 'markdown',
      metadata: {
        lastUpdated: new Date()
      }
    };
  }

  private async fetchImageData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    return {
      url: '/api/images/dashboard-widget.png',
      alt: 'Dashboard image',
      metadata: {
        width: 400,
        height: 300,
        format: 'png'
      }
    };
  }

  private async applyVisualization(
    widget: DashboardWidget,
    data: any
  ): Promise<any> {
    const visualization = { ...widget.visualization };
    
    if (widget.visualization.thresholds) {
      visualization.thresholds = widget.visualization.thresholds.map(threshold => ({
        ...threshold,
        active: this.isThresholdActive(threshold, data)
      }));
    }

    if (widget.visualization.colors) {
      visualization.colors = this.applyColorMapping(widget.visualization.colors, data);
    }

    return visualization;
  }

  private applyFiltersToQuery(query: string, filters?: Record<string, any>): string {
    if (!filters) return query;

    let filteredQuery = query;
    
    for (const [key, value] of Object.entries(filters)) {
      const placeholder = `{{${key}}}`;
      filteredQuery = filteredQuery.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return filteredQuery;
  }

  private generateLineChartData(): any {
    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const datasets = [
      {
        label: 'Revenue',
        data: labels.map(() => Math.random() * 1000),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)'
      },
      {
        label: 'Costs',
        data: labels.map(() => Math.random() * 800),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)'
      }
    ];

    return { labels, datasets };
  }

  private generateBarChartData(): any {
    const labels = ['Product A', 'Product B', 'Product C', 'Product D'];
    const data = labels.map(() => Math.random() * 500);

    return { labels, datasets: [{ label: 'Sales', data }] };
  }

  private generatePieChartData(): any {
    const labels = ['Category A', 'Category B', 'Category C', 'Category D'];
    const data = labels.map(() => Math.random() * 100);

    return { labels, datasets: [{ data }] };
  }

  private generateScatterChartData(): any {
    const data = Array.from({ length: 50 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100
    }));

    return { datasets: [{ label: 'Data Points', data }] };
  }

  private generateHeatmapData(): any {
    const data = Array.from({ length: 10 }, (_, i) =>
      Array.from({ length: 10 }, (_, j) => ({
        x: j,
        y: i,
        value: Math.random()
      }))
    ).flat();

    return { data };
  }

  private generateDefaultChartData(): any {
    return this.generateLineChartData();
  }

  private isThresholdActive(threshold: any, data: any): boolean {
    if (typeof data.value === 'number') {
      return data.value >= threshold.value;
    }
    return false;
  }

  private applyColorMapping(colors: string[], data: any): string[] {
    if (typeof data.value === 'number') {
      const index = Math.floor((data.value / 100) * colors.length);
      return colors.slice(0, index + 1);
    }
    return colors;
  }

  private calculateDataPoints(widgets: RenderedWidget[]): number {
    return widgets.reduce((total, widget) => {
      if (widget.data && typeof widget.data === 'object') {
        if (Array.isArray(widget.data)) {
          return total + widget.data.length;
        } else if (widget.data.rows && Array.isArray(widget.data.rows)) {
          return total + widget.data.rows.length;
        } else if (widget.data.datasets && Array.isArray(widget.data.datasets)) {
          return total + widget.data.datasets.reduce((sum: number, dataset: any) => 
            sum + (dataset.data ? dataset.data.length : 0), 0);
        }
      }
      return total + 1;
    }, 0);
  }

  async getWidgetTypes(): Promise<any[]> {
    return [
      {
        type: 'metric',
        name: 'Metric',
        description: 'Display a single key metric',
        icon: 'chart-line',
        category: 'basic'
      },
      {
        type: 'chart',
        name: 'Chart',
        description: 'Display various chart types',
        icon: 'chart-bar',
        category: 'visualization'
      },
      {
        type: 'table',
        name: 'Table',
        description: 'Display tabular data',
        icon: 'table',
        category: 'data'
      },
      {
        type: 'kpi',
        name: 'KPI',
        description: 'Display key performance indicators',
        icon: 'target',
        category: 'business'
      },
      {
        type: 'text',
        name: 'Text',
        description: 'Display text content',
        icon: 'file-text',
        category: 'content'
      },
      {
        type: 'image',
        name: 'Image',
        description: 'Display images',
        icon: 'image',
        category: 'media'
      }
    ];
  }

  async getVisualizationTypes(): Promise<any[]> {
    return [
      {
        type: 'line',
        name: 'Line Chart',
        description: 'Display data as connected points',
        category: 'time-series'
      },
      {
        type: 'bar',
        name: 'Bar Chart',
        description: 'Display data as vertical bars',
        category: 'categorical'
      },
      {
        type: 'pie',
        name: 'Pie Chart',
        description: 'Display data as pie slices',
        category: 'proportional'
      },
      {
        type: 'scatter',
        name: 'Scatter Plot',
        description: 'Display data as points',
        category: 'correlation'
      },
      {
        type: 'heatmap',
        name: 'Heatmap',
        description: 'Display data as color-coded matrix',
        category: 'matrix'
      },
      {
        type: 'gauge',
        name: 'Gauge',
        description: 'Display data as gauge meter',
        category: 'indicator'
      }
    ];
  }
}
