import { Dashboard, DashboardWidget, DashboardFilter } from '../types/reporting.types';

export interface WidgetDataSource {
  executeQuery(query: string, type: string): Promise<any>;
}

export interface DashboardRenderRequest {
  dashboard: Dashboard;
  filters?: Record<string, any>;
  dataSource?: WidgetDataSource;
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
    const { dashboard, filters, dataSource } = request;
    this.dataSource = dataSource || null;

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
          error: error instanceof Error ? error.message : 'Unknown error'
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

  private dataSource: WidgetDataSource | null = null;

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

    if (this.dataSource) {
      const result = await this.dataSource.executeQuery(query, 'metric');
      return {
        value: result?.value ?? 0,
        unit: result?.unit ?? 'units',
        trend: result?.trend ?? 'stable',
        change: result?.change ?? 0,
        timestamp: new Date(),
      };
    }

    return { value: 0, unit: 'units', trend: 'stable', change: 0, timestamp: new Date() };
  }

  private async fetchChartData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);

    if (this.dataSource) {
      const result = await this.dataSource.executeQuery(query, 'chart');
      if (result?.labels && result?.datasets) return result;
    }

    return { labels: [], datasets: [] };
  }

  private async fetchTableData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);

    if (this.dataSource) {
      const result = await this.dataSource.executeQuery(query, 'table');
      if (result?.columns && result?.rows) return result;
    }

    return { columns: [], rows: [], pagination: { page: 1, pageSize: 10, total: 0 } };
  }

  private async fetchKPIData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    const query = this.applyFiltersToQuery(widget.query, filters);

    if (this.dataSource) {
      const result = await this.dataSource.executeQuery(query, 'kpi');
      return {
        value: result?.value ?? 0,
        target: result?.target ?? 0,
        percentage: result?.target ? Math.round((result.value / result.target) * 100) : 0,
        status: result?.target && result?.value >= result.target ? 'good' : 'warning',
        trend: result?.trend ?? { direction: 'stable', percentage: 0 },
        metadata: { lastUpdated: new Date(), source: 'database' },
      };
    }

    return {
      value: 0, target: 0, percentage: 0, status: 'warning',
      trend: { direction: 'stable', percentage: 0 },
      metadata: { lastUpdated: new Date(), source: 'none' },
    };
  }

  private async fetchTextData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    if (this.dataSource) {
      const query = this.applyFiltersToQuery(widget.query, filters);
      const result = await this.dataSource.executeQuery(query, 'text');
      if (result?.content) return result;
    }
    return { content: widget.query || '', format: 'markdown', metadata: { lastUpdated: new Date() } };
  }

  private async fetchImageData(
    widget: DashboardWidget,
    filters?: Record<string, any>
  ): Promise<any> {
    if (this.dataSource) {
      const query = this.applyFiltersToQuery(widget.query, filters);
      const result = await this.dataSource.executeQuery(query, 'image');
      if (result?.url) return result;
    }
    return { url: '', alt: widget.title, metadata: { width: 0, height: 0, format: '' } };
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
      filteredQuery = filteredQuery.replaceAll(placeholder, String(value));
    }

    return filteredQuery;
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
