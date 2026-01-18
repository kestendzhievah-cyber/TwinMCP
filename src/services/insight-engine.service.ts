import { InsightType, Insight, ReportConfig } from '../types/reporting.types';

export interface InsightGenerationRequest {
  type: InsightType;
  data: any;
  config: ReportConfig;
}

export class InsightEngine {
  async generateInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    switch (type.category) {
      case 'trend':
        return await this.generateTrendInsights(type, data, config);
      case 'anomaly':
        return await this.generateAnomalyInsights(type, data, config);
      case 'correlation':
        return await this.generateCorrelationInsights(type, data, config);
      case 'opportunity':
        return await this.generateOpportunityInsights(type, data, config);
      case 'risk':
        return await this.generateRiskInsights(type, data, config);
      default:
        return [];
    }
  }

  private async generateTrendInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (data.metrics && data.series) {
      for (const [metricName, metricData] of Object.entries(data.metrics)) {
        const trend = this.calculateTrend(data.series, metricName);
        
        if (Math.abs(trend.changePercent) > 10) {
          insights.push({
            id: crypto.randomUUID(),
            type,
            title: `Significant ${trend.direction} trend in ${metricName}`,
            description: `${metricName} has ${trend.direction} by ${Math.abs(trend.changePercent).toFixed(1)}% over the selected period.`,
            severity: Math.abs(trend.changePercent) > 25 ? 'critical' : 'warning',
            confidence: 0.85,
            impact: Math.abs(trend.changePercent) > 25 ? 'high' : 'medium',
            data: {
              metric: metricName,
              value: trend.currentValue,
              baseline: trend.baselineValue,
              change: trend.change,
              changePercent: trend.changePercent,
              period: `${config.period.start.toISOString()} - ${config.period.end.toISOString()}`,
              significance: trend.significance,
              context: { trendDirection: trend.direction }
            },
            recommendations: this.generateTrendRecommendations(trend),
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }

  private async generateAnomalyInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (data.metrics) {
      for (const [metricName, metricValue] of Object.entries(data.metrics)) {
        const anomaly = this.detectAnomaly(data.series, metricName, metricValue as number);
        
        if (anomaly.isAnomaly) {
          insights.push({
            id: crypto.randomUUID(),
            type,
            title: `Anomaly detected in ${metricName}`,
            description: `Unusual pattern detected in ${metricName}: ${anomaly.description}`,
            severity: anomaly.severity,
            confidence: anomaly.confidence,
            impact: anomaly.impact,
            data: {
              metric: metricName,
              value: metricValue as number,
              baseline: anomaly.expectedValue,
              change: (metricValue as number) - anomaly.expectedValue,
              changePercent: ((metricValue as number - anomaly.expectedValue) / anomaly.expectedValue) * 100,
              period: `${config.period.start.toISOString()} - ${config.period.end.toISOString()}`,
              significance: anomaly.significance,
              context: anomaly.context
            },
            recommendations: this.generateAnomalyRecommendations(anomaly),
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }

  private async generateCorrelationInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (data.metrics && Object.keys(data.metrics).length > 1) {
      const correlations = this.calculateCorrelations(data.metrics);
      
      for (const correlation of correlations) {
        if (Math.abs(correlation.coefficient) > 0.7) {
          insights.push({
            id: crypto.randomUUID(),
            type,
            title: `Strong correlation between ${correlation.metric1} and ${correlation.metric2}`,
            description: `Found a ${correlation.coefficient > 0 ? 'positive' : 'negative'} correlation of ${Math.abs(correlation.coefficient).toFixed(2)} between ${correlation.metric1} and ${correlation.metric2}.`,
            severity: 'info',
            confidence: 0.75,
            impact: 'medium',
            data: {
              metric: correlation.metric1,
              value: correlation.coefficient,
              baseline: 0,
              change: correlation.coefficient,
              changePercent: Math.abs(correlation.coefficient) * 100,
              period: `${config.period.start.toISOString()} - ${config.period.end.toISOString()}`,
              significance: Math.abs(correlation.coefficient),
              context: { 
                correlatedMetric: correlation.metric2,
                correlationType: correlation.coefficient > 0 ? 'positive' : 'negative'
              }
            },
            recommendations: this.generateCorrelationRecommendations(correlation),
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }

  private async generateOpportunityInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (data.metrics) {
      for (const [metricName, metricValue] of Object.entries(data.metrics)) {
        const opportunities = this.identifyOpportunities(metricName, metricValue as number, data);
        
        for (const opportunity of opportunities) {
          insights.push({
            id: crypto.randomUUID(),
            type,
            title: `Optimization opportunity for ${metricName}`,
            description: opportunity.description,
            severity: 'info',
            confidence: opportunity.confidence,
            impact: opportunity.impact,
            data: {
              metric: metricName,
              value: metricValue as number,
              baseline: opportunity.potentialValue,
              change: opportunity.potentialImprovement,
              changePercent: ((opportunity.potentialImprovement) / (metricValue as number)) * 100,
              period: `${config.period.start.toISOString()} - ${config.period.end.toISOString()}`,
              significance: opportunity.confidence,
              context: opportunity.context
            },
            recommendations: opportunity.recommendations,
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }

  private async generateRiskInsights(
    type: InsightType,
    data: any,
    config: ReportConfig
  ): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    if (data.metrics) {
      for (const [metricName, metricValue] of Object.entries(data.metrics)) {
        const risks = this.identifyRisks(metricName, metricValue as number, data);
        
        for (const risk of risks) {
          insights.push({
            id: crypto.randomUUID(),
            type,
            title: `Risk detected in ${metricName}`,
            description: risk.description,
            severity: risk.severity,
            confidence: risk.confidence,
            impact: risk.impact,
            data: {
              metric: metricName,
              value: metricValue as number,
              baseline: risk.threshold,
              change: (metricValue as number) - risk.threshold,
              changePercent: ((metricValue as number - risk.threshold) / risk.threshold) * 100,
              period: `${config.period.start.toISOString()} - ${config.period.end.toISOString()}`,
              significance: risk.confidence,
              context: risk.context
            },
            recommendations: risk.recommendations,
            timestamp: new Date()
          });
        }
      }
    }
    
    return insights;
  }

  private calculateTrend(series: any[], metricName: string): any {
    const metricData = series.filter(s => s.metric === metricName);
    if (metricData.length < 2) {
      return { changePercent: 0, direction: 'no change' };
    }

    const firstValue = metricData[0].value;
    const lastValue = metricData[metricData.length - 1].value;
    const change = lastValue - firstValue;
    const changePercent = (change / firstValue) * 100;
    const direction = changePercent > 0 ? 'increased' : 'decreased';

    return {
      currentValue: lastValue,
      baselineValue: firstValue,
      change,
      changePercent,
      direction,
      significance: Math.abs(changePercent) / 100
    };
  }

  private detectAnomaly(series: any[], metricName: string, currentValue: number): any {
    const metricData = series.filter(s => s.metric === metricName);
    if (metricData.length < 3) {
      return { isAnomaly: false };
    }

    const values = metricData.map(s => s.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    const zScore = Math.abs((currentValue - mean) / stdDev);

    const isAnomaly = zScore > 2;
    const severity = zScore > 3 ? 'critical' : 'warning';
    const confidence = Math.min(zScore / 3, 1);
    const impact = zScore > 3 ? 'high' : 'medium';

    return {
      isAnomaly,
      severity,
      confidence,
      impact,
      expectedValue: mean,
      significance: zScore,
      description: `Value ${currentValue} is ${zScore.toFixed(1)} standard deviations from the mean`,
      context: { zScore, mean, stdDev }
    };
  }

  private calculateCorrelations(metrics: Record<string, number>): any[] {
    const metricNames = Object.keys(metrics);
    const correlations: any[] = [];

    for (let i = 0; i < metricNames.length; i++) {
      for (let j = i + 1; j < metricNames.length; j++) {
        const metric1 = metricNames[i];
        const metric2 = metricNames[j];
        
        const coefficient = this.pearsonCorrelation(
          [metrics[metric1]],
          [metrics[metric2]]
        );

        correlations.push({
          metric1,
          metric2,
          coefficient
        });
      }
    }

    return correlations;
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumY = y.slice(0, n).reduce((sum, val) => sum + val, 0);
    const sumXY = x.slice(0, n).reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.slice(0, n).reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private identifyOpportunities(metricName: string, value: number, data: any): any[] {
    const opportunities: any[] = [];

    if (metricName.includes('cost') && value > 100) {
      opportunities.push({
        description: `High cost detected in ${metricName}. Consider optimization strategies.`,
        confidence: 0.7,
        impact: 'high',
        potentialValue: value * 0.8,
        potentialImprovement: value * 0.2,
        context: { currentCost: value, potentialSavings: value * 0.2 },
        recommendations: [{
          id: crypto.randomUUID(),
          action: 'Review cost optimization strategies',
          description: `Analyze ${metricName} for potential cost reductions`,
          priority: 'high',
          effort: 'medium',
          impact: 'high'
        }]
      });
    }

    return opportunities;
  }

  private identifyRisks(metricName: string, value: number, data: any): any[] {
    const risks: any[] = [];

    if (metricName.includes('error') && value > 5) {
      risks.push({
        description: `High error rate in ${metricName}: ${value}%`,
        severity: value > 10 ? 'critical' : 'warning',
        confidence: 0.9,
        impact: value > 10 ? 'high' : 'medium',
        threshold: 5,
        context: { errorRate: value, threshold: 5 },
        recommendations: [{
          id: crypto.randomUUID(),
          action: 'Investigate error sources',
          description: `Analyze and fix the root cause of high error rate in ${metricName}`,
          priority: 'high',
          effort: 'high',
          impact: 'high'
        }]
      });
    }

    return risks;
  }

  private generateTrendRecommendations(trend: any): any[] {
    const recommendations: any[] = [];

    if (trend.direction === 'increased' && Math.abs(trend.changePercent) > 25) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: 'Monitor growth trend',
        description: `Continue monitoring the positive growth trend and ensure scalability`,
        priority: 'medium',
        effort: 'low',
        impact: 'medium'
      });
    } else if (trend.direction === 'decreased' && Math.abs(trend.changePercent) > 25) {
      recommendations.push({
        id: crypto.randomUUID(),
        action: 'Investigate decline',
        description: `Investigate the causes of the decline and implement corrective actions`,
        priority: 'high',
        effort: 'medium',
        impact: 'high'
      });
    }

    return recommendations;
  }

  private generateAnomalyRecommendations(anomaly: any): any[] {
    return [{
      id: crypto.randomUUID(),
      action: 'Investigate anomaly',
      description: `Investigate the unusual pattern and determine if it requires intervention`,
      priority: anomaly.severity === 'critical' ? 'high' : 'medium',
      effort: 'medium',
      impact: anomaly.impact
    }];
  }

  private generateCorrelationRecommendations(correlation: any): any[] {
    return [{
      id: crypto.randomUUID(),
      action: 'Analyze correlation',
      description: `Investigate the relationship between ${correlation.metric1} and ${correlation.metric2} for potential optimizations`,
      priority: 'medium',
      effort: 'low',
      impact: 'medium'
    }];
  }
}
