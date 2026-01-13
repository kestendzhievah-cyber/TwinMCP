import { HealthCheck, HealthStatus } from '../types/gateway.types';

export class HealthCheckService {
  private checks: Map<string, () => Promise<HealthCheck>> = new Map();
  // TODO: Implement thresholds usage in health checks
  // private thresholds = {
  //   responseTime: 1000, // ms
  //   memoryUsage: 80,    // %
  //   cpuUsage: 80       // %
  // };

  constructor() {
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Check base du serveur
    this.register('server', this.checkServer.bind(this));
    
    // Check mémoire
    this.register('memory', this.checkMemory.bind(this));
    
    // Check CPU
    this.register('cpu', this.checkCPU.bind(this));
    
    // Check disque
    this.register('disk', this.checkDisk.bind(this));
  }

  register(name: string, checkFn: () => Promise<HealthCheck>): void {
    this.checks.set(name, checkFn);
  }

  async runAllChecks(): Promise<HealthStatus> {
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const startTime = Date.now();
          const result = await checkFn();
          result.latency = Date.now() - startTime;
          return result;
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            message: (error as Error).message,
            lastChecked: new Date()
          };
        }
      }
    );

    const results = await Promise.allSettled(checkPromises);
    const checks = results
      .filter((result): result is PromiseFulfilledResult<HealthCheck> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    // Calculer le statut global
    const summary = this.calculateSummary(checks);
    const globalStatus = this.determineGlobalStatus(summary);

    return {
      status: globalStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env['npm_package_version'] || '1.0.0',
      checks,
      summary
    };
  }

  private calculateSummary(checks: HealthCheck[]) {
    return {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length
    };
  }

  private determineGlobalStatus(summary: any): 'healthy' | 'unhealthy' | 'degraded' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    }
    if (summary.degraded > 0) {
      return 'degraded';
    }
    return 'healthy';
  }

  private async checkServer(): Promise<HealthCheck> {
    return {
      name: 'server',
      status: 'healthy',
      message: 'Server running normally',
      lastChecked: new Date(),
      details: {
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };
  }

  private async checkMemory(): Promise<HealthCheck> {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const usagePercent = (heapUsedMB / heapTotalMB) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (usagePercent > 90) {
      status = 'unhealthy';
    } else if (usagePercent > 80) {
      status = 'degraded';
    }

    return {
      name: 'memory',
      status,
      message: `Memory usage: ${usagePercent.toFixed(1)}%`,
      lastChecked: new Date(),
      details: {
        heap_used: `${heapUsedMB.toFixed(2)}MB`,
        heap_total: `${heapTotalMB.toFixed(2)}MB`,
        external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
        usage_percent: usagePercent.toFixed(1)
      }
    };
  }

  private async checkCPU(): Promise<HealthCheck> {
    // Pour l'instant, placeholder - nécessitera un module comme cpu-usage
    const cpuUsage = process.cpuUsage();
    
    return {
      name: 'cpu',
      status: 'healthy',
      message: 'CPU usage normal',
      lastChecked: new Date(),
      details: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  private async checkDisk(): Promise<HealthCheck> {
    // Pour l'instant, placeholder - nécessitera un module comme diskusage
    return {
      name: 'disk',
      status: 'healthy',
      message: 'Disk space sufficient',
      lastChecked: new Date(),
      details: {
        // Sera implémenté avec vérification réelle du disque
        free: 'N/A',
        total: 'N/A',
        usage_percent: 'N/A'
      }
    };
  }
}
