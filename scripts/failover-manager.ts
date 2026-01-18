import { KubernetesAPI } from '@kubernetes/client-node';
import { CloudflareAPI } from 'cloudflare-api';
import { SlackNotifier } from './slack-notifier';

export class FailoverManager {
  private k8s: KubernetesAPI;
  private cloudflare: CloudflareAPI;
  private slack: SlackNotifier;
  private healthCheckInterval: NodeJS.Timeout;
  private isFailoverInProgress = false;

  constructor() {
    this.k8s = new KubernetesAPI();
    this.cloudflare = new CloudflareAPI();
    this.slack = new SlackNotifier();
    this.startHealthChecks();
  }

  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, 30000); // 30 secondes
  }

  private async performHealthChecks(): Promise<void> {
    if (this.isFailoverInProgress) return;

    try {
      const primaryHealth = await this.checkRegionHealth('primary');
      const secondaryHealth = await this.checkRegionHealth('secondary');

      console.log(`Health check - Primary: ${primaryHealth}, Secondary: ${secondaryHealth}`);

      if (!primaryHealth && secondaryHealth) {
        await this.initiateFailover('primary', 'secondary');
      } else if (primaryHealth && !secondaryHealth) {
        await this.initiateFailover('secondary', 'primary');
      }

    } catch (error) {
      console.error('Health check failed:', error);
      await this.slack.notify('❌ Health check failed', error.message);
    }
  }

  private async checkRegionHealth(region: string): Promise<boolean> {
    const endpoints = {
      primary: 'https://api.twinme.ai/health',
      secondary: 'https://api-secondary.twinme.ai/health'
    };

    try {
      const response = await fetch(endpoints[region], {
        method: 'GET',
        timeout: 5000
      });

      if (!response.ok) return false;

      const health = await response.json();
      return health.status === 'healthy' && 
             health.database === 'connected' &&
             health.redis === 'connected';

    } catch (error) {
      console.error(`Health check failed for ${region}:`, error);
      return false;
    }
  }

  private async initiateFailover(from: string, to: string): Promise<void> {
    this.isFailoverInProgress = true;

    try {
      await this.slack.notify(`🚨 Initiating failover from ${from} to ${to}`);

      // 1. Mettre à jour le DNS
      await this.updateDNS(to);

      // 2. Scaler le service de destination
      await this.scaleService(to, 5);

      // 3. Attendre que le service soit prêt
      await this.waitForServiceReady(to);

      // 4. Mettre à jour le load balancer
      await this.updateLoadBalancer(to);

      // 5. Scaler down le service source
      await this.scaleService(from, 0);

      await this.slack.notify(`✅ Failover completed from ${from} to ${to}`);

    } catch (error) {
      await this.slack.notify(`❌ Failover failed: ${error.message}`);
      throw error;
    } finally {
      this.isFailoverInProgress = false;
    }
  }

  private async updateDNS(region: string): Promise<void> {
    const records = {
      primary: 'api.twinme.ai',
      secondary: 'api-secondary.twinme.ai'
    };

    const targetIPs = {
      primary: process.env.PRIMARY_LB_IP,
      secondary: process.env.SECONDARY_LB_IP
    };

    await this.cloudflare.updateDNSRecord(
      records.api,
      'A',
      targetIPs[region]
    );
  }

  private async scaleService(region: string, replicas: number): Promise<void> {
    const deploymentName = `twinme-api-${region}`;
    
    await this.k8s.patchNamespacedDeployment(
      deploymentName,
      'twinme-prod',
      {
        spec: {
          replicas: replicas
        }
      }
    );

    if (replicas > 0) {
      await this.waitForDeploymentReady(deploymentName);
    }
  }

  private async waitForServiceReady(region: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const health = await this.checkRegionHealth(region);
      if (health) return;

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Service ${region} not ready after 5 minutes`);
  }

  private async waitForDeploymentReady(deploymentName: string): Promise<void> {
    const maxWaitTime = 300000; // 5 minutes
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const deployment = await this.k8s.readNamespacedDeployment(
        deploymentName,
        'twinme-prod'
      );

      if (deployment.body.status.readyReplicas === deployment.body.spec.replicas) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    throw new Error(`Deployment ${deploymentName} not ready after 5 minutes`);
  }

  private async updateLoadBalancer(region: string): Promise<void> {
    const ingressName = 'twinme-api-ingress';
    
    await this.k8s.patchNamespacedIngress(
      ingressName,
      'twinme-prod',
      {
        spec: {
          rules: [{
            host: 'api.twinme.ai',
            http: {
              paths: [{
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: `twinme-api-${region}-lb`,
                    port: { number: 443 }
                  }
                }
              }]
            }
          }]
        }
      }
    );
  }

  async gracefulShutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}
