# E10-Story10-2-Scalabilite-HA.md

## Epic 10: Déploiement & Production

### Story 10.2: Scalabilité et haute disponibilité

**Description**: Architecture scalable et haute disponibilité pour TwinMe IA

---

## Objectif

Mettre en place une architecture scalable et haute disponibilité avec auto-scaling, load balancing, failover et disaster recovery.

---

## Prérequis

- Infrastructure de production déployée (Story 10.1)
- Services monitoring en place
- Base de données configurée
- Load balancer configuré

---

## Spécifications Techniques

### 1. Architecture Scalable

#### 1.1 Auto-Scaling Configuration

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: twinme-api-hpa
  namespace: twinme-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: twinme-api
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
      - type: Pods
        value: 4
        periodSeconds: 15
      selectPolicy: Max
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
      selectPolicy: Min
---
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: twinme-api-vpa
  namespace: twinme-prod
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: twinme-api
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: api
      maxAllowed:
        cpu: 2
        memory: 2Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

#### 1.2 Cluster Auto-Scaling

```yaml
# k8s/cluster-autoscaler.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-autoscaler
  namespace: kube-system
spec:
  replicas: 1
  selector:
    matchLabels:
      app: cluster-autoscaler
  template:
    metadata:
      labels:
        app: cluster-autoscaler
    spec:
      containers:
      - image: k8s.gcr.io/autoscaling/cluster-autoscaler:v1.21.0
        name: cluster-autoscaler
        resources:
          limits:
            cpu: 100m
            memory: 300Mi
          requests:
            cpu: 100m
            memory: 300Mi
        command:
        - ./cluster-autoscaler
        - --v=4
        - --stderrthreshold=info
        - --cloud-provider=aws
        - --skip-nodes-with-local-storage=false
        - --expander=least-waste
        - --node-group-auto-discovery=asg:tag=k8s.io/cluster-autoscaler/enabled,k8s.io/cluster-autoscaler/twinme-prod
        - --balance-similar-node-groups
        - --skip-nodes-with-system-pods=false
```

#### 1.3 Load Balancing Avancé

```yaml
# k8s/advanced-lb.yaml
apiVersion: v1
kind: Service
metadata:
  name: twinme-api-lb
  namespace: twinme-prod
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: nlb
    service.beta.kubernetes.io/aws-load-balancer-backend-protocol: tcp
    service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled: "true"
    service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout: "3600"
spec:
  type: LoadBalancer
  selector:
    app: twinme-api
  ports:
  - port: 443
    targetPort: 3000
    protocol: TCP
  sessionAffinity: None
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: twinme-api-ingress
  namespace: twinme-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
    nginx.ingress.kubernetes.io/upstream-hash-by: "$request_id"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.twinme.ai
    secretName: twinme-api-tls
  rules:
  - host: api.twinme.ai
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: twinme-api-lb
            port:
              number: 443
```

### 2. Haute Disponibilité Base de Données

#### 2.1 PostgreSQL Cluster

```yaml
# k8s/postgres-cluster.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: twinme-postgres
  namespace: twinme-prod
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised
  
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: "256MB"
      effective_cache_size: "1GB"
      maintenance_work_mem: "64MB"
      checkpoint_completion_target: "0.9"
      wal_buffers: "16MB"
      default_statistics_target: "100"
      random_page_cost: "1.1"
      effective_io_concurrency: "200"
      
  bootstrap:
    initdb:
      database: twinme
      owner: twinme
      secret:
        name: postgres-credentials
        
  storage:
    size: 100Gi
    storageClass: fast-ssd
    
  monitoring:
    enabled: true
    
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: "s3://twinme-backups/postgres"
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-credentials
          key: SECRET_ACCESS_KEY
      region: "eu-west-3"
      wal:
        compression: gzip
        encryption: AES256
        
  externalClusters:
  - name: replica-cluster
    connectionParameters:
      host: replica.twinme.ai
      user: streaming_replica
      dbname: twinme
    password:
      name: replica-credentials
      key: password
    barmanObjectStore:
      destinationPath: "s3://twinme-backups/postgres"
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: ACCESS_KEY_ID
        secretAccessKey:
          name: backup-credentials
          key: SECRET_ACCESS_KEY
      region: "eu-west-3"
```

#### 2.2 Redis Cluster

```yaml
# k8s/redis-cluster.yaml
apiVersion: redis.redis.opstreelabs.in/v1beta1
kind: RedisCluster
metadata:
  name: twinme-redis
  namespace: twinme-prod
spec:
  clusterSize: 6
  clusterVersion: v7.0.5
  persistenceEnabled: true
  
  redisExporter:
    enabled: true
    image: oliver006/redis_exporter:latest
    
  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 20Gi
        storageClassName: fast-ssd
            
  securityContext:
    runAsUser: 999
    runAsGroup: 999
    fsGroup: 999
    
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
      
  config:
    maxmemory-policy: allkeys-lru
    timeout: 0
    tcp-keepalive: 300
    maxclients: 10000
    
  nodeSelector:
    node-type: redis
    
  tolerations:
  - key: "redis"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
```

### 3. Disaster Recovery

#### 3.1 Multi-Region Setup

```yaml
# k8s/multi-region.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: region-config
  namespace: twinme-prod
data:
  PRIMARY_REGION: "eu-west-3"
  SECONDARY_REGION: "eu-central-1"
  DR_REGION: "us-east-1"
  FAILOVER_THRESHOLD: "0.8"
  HEALTH_CHECK_INTERVAL: "30"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twinme-api-primary
  namespace: twinme-prod
  labels:
    app: twinme-api
    region: primary
spec:
  replicas: 3
  selector:
    matchLabels:
      app: twinme-api
      region: primary
  template:
    metadata:
      labels:
        app: twinme-api
        region: primary
    spec:
      nodeSelector:
        topology.kubernetes.io/zone: eu-west-3
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - twinme-api
              topologyKey: kubernetes.io/hostname
      containers:
      - name: api
        image: twinme/api:latest
        env:
        - name: REGION
          value: "primary"
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: region-config
              key: PRIMARY_DB_URL
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twinme-api-secondary
  namespace: twinme-prod
  labels:
    app: twinme-api
    region: secondary
spec:
  replicas: 2
  selector:
    matchLabels:
      app: twinme-api
      region: secondary
  template:
    metadata:
      labels:
        app: twinme-api
        region: secondary
    spec:
      nodeSelector:
        topology.kubernetes.io/zone: eu-central-1
      containers:
      - name: api
        image: twinme/api:latest
        env:
        - name: REGION
          value: "secondary"
        - name: DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: region-config
              key: SECONDARY_DB_URL
```

#### 3.2 Failover Automation

```typescript
// scripts/failover-manager.ts
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
```

### 4. Performance Monitoring

#### 4.1 Advanced Metrics

```typescript
// monitoring/performance-monitor.ts
import { PrometheusClient } from 'prometheus-client';
import { AlertManager } from './alert-manager';

export class PerformanceMonitor {
  private prometheus: PrometheusClient;
  private alertManager: AlertManager;

  constructor() {
    this.prometheus = new PrometheusClient();
    this.alertManager = new AlertManager();
    this.setupMetrics();
  }

  private setupMetrics(): void {
    // Métriques de performance
    this.responseTimeHistogram = new this.prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    this.requestRateGauge = new this.prometheus.Gauge({
      name: 'http_requests_per_second',
      help: 'HTTP requests per second',
      labelNames: ['method', 'route']
    });

    this.errorRateGauge = new this.prometheus.Gauge({
      name: 'http_error_rate',
      help: 'HTTP error rate',
      labelNames: ['method', 'route']
    });

    this.activeConnectionsGauge = new this.prometheus.Gauge({
      name: 'active_connections',
      help: 'Number of active connections'
    });

    this.queueLengthGauge = new this.prometheus.Gauge({
      name: 'queue_length',
      help: 'Length of processing queue',
      labelNames: ['queue_name']
    });
  }

  async trackRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    this.responseTimeHistogram
      .labels(method, route, statusCode.toString())
      .observe(duration);

    // Mise à jour du taux d'erreurs
    if (statusCode >= 400) {
      this.errorRateGauge
        .labels(method, route)
        .inc();
    }

    // Vérification des seuils d'alerte
    await this.checkPerformanceThresholds(method, route, statusCode, duration);
  }

  private async checkPerformanceThresholds(
    method: string,
    route: string,
    statusCode: number,
    duration: number
  ): Promise<void> {
    // Alertes de latence
    if (duration > 5) {
      await this.alertManager.createAlert({
        name: 'High Latency Detected',
        description: `Request to ${route} took ${duration}s`,
        severity: 'warning',
        labels: { method, route, duration: duration.toString() }
      });
    }

    // Alertes de taux d'erreurs
    const errorRate = await this.calculateErrorRate(method, route);
    if (errorRate > 0.05) { // 5%
      await this.alertManager.createAlert({
        name: 'High Error Rate',
        description: `Error rate for ${route} is ${(errorRate * 100).toFixed(2)}%`,
        severity: 'critical',
        labels: { method, route, errorRate: errorRate.toString() }
      });
    }
  }

  private async calculateErrorRate(method: string, route: string): Promise<number> {
    const totalRequests = await this.prometheus.query(
      `sum(rate(http_requests_total{method="${method}",route="${route}"}[5m]))`
    );

    const errorRequests = await this.prometheus.query(
      `sum(rate(http_requests_total{method="${method}",route="${route}",status_code=~"4.."}[5m]))`
    );

    return parseFloat(errorRequests) / parseFloat(totalRequests) || 0;
  }

  async trackResourceUsage(): Promise<void> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = await this.getMemoryUsage();
    const diskUsage = await this.getDiskUsage();

    // Alertes de ressources
    if (cpuUsage > 80) {
      await this.alertManager.createAlert({
        name: 'High CPU Usage',
        description: `CPU usage is ${cpuUsage}%`,
        severity: 'warning'
      });
    }

    if (memoryUsage > 85) {
      await this.alertManager.createAlert({
        name: 'High Memory Usage',
        description: `Memory usage is ${memoryUsage}%`,
        severity: 'critical'
      });
    }

    if (diskUsage > 90) {
      await this.alertManager.createAlert({
        name: 'High Disk Usage',
        description: `Disk usage is ${diskUsage}%`,
        severity: 'critical'
      });
    }
  }

  private async getCPUUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])))'
    );
    return parseFloat(result) || 0;
  }

  private async getMemoryUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'
    );
    return parseFloat(result) || 0;
  }

  private async getDiskUsage(): Promise<number> {
    const result = await this.prometheus.query(
      '100 * (1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes))'
    );
    return parseFloat(result) || 0;
  }
}
```

---

## Tâches Détaillées

### 1. Auto-Scaling
- [ ] Configurer HPA pour l'API
- [ ] Mettre en place VPA
- [ ] Configurer cluster auto-scaling
- [ ] Optimiser les thresholds

### 2. Load Balancing
- [ ] Configurer NLB/ALB
- [ ] Mettre en place le health checking
- [ ] Configurer le cross-zone load balancing
- [ ] Optimiser les timeouts

### 3. Haute Disponibilité
- [ ] Déployer PostgreSQL cluster
- [ ] Configurer Redis cluster
- [ ] Mettre en place la réplication
- [ ] Configurer le failover automatique

### 4. Disaster Recovery
- [ ] Configurer multi-région
- [ ] Mettre en place le DNS failover
- [ ] Automatiser le basculement
- [ ] Tester les procédures

### 5. Monitoring Avancé
- [ ] Configurer les métriques détaillées
- [ ] Mettre en place les alertes intelligentes
- [ ] Créer les dashboards de performance
- [ ] Configurer le SLO monitoring

### 6. Performance Optimization
- [ ] Optimiser les requêtes DB
- [ ] Mettre en place le caching avancé
- [ ] Optimiser les timeouts
- [ ] Configurer la compression

---

## Validation

### Tests de Scalabilité

```bash
#!/bin/bash
# scripts/scalability-tests.sh

# Test de charge progressive
echo "Running progressive load test..."
k6 run --vus 10 --duration 60s scripts/load-test.js &
k6 run --vus 50 --duration 60s scripts/load-test.js &
k6 run --vus 100 --duration 60s scripts/load-test.js &

# Test de montée en charge
echo "Running spike test..."
k6 run --vus 500 --duration 30s scripts/spike-test.js

# Test de stress
echo "Running stress test..."
k6 run --vus 1000 --duration 120s scripts/stress-test.js

# Test d'endurance
echo "Running endurance test..."
k6 run --vus 200 --duration 3600s scripts/endurance-test.js

echo "Scalability tests completed!"
```

---

## Architecture

### Composants

1. **Auto-Scaling**: HPA, VPA, Cluster Autoscaler
2. **Load Balancing**: NLB/ALB avec health checks
3. **HA Database**: PostgreSQL cluster avec réplication
4. **HA Cache**: Redis cluster avec sharding
5. **Failover**: Automatisé avec DNS management
6. **Monitoring**: Métriques détaillées et alertes

### Flux de Scalabilité

```
Load Increase → Auto-Scale → Health Check → Load Balance → Monitor → Adjust
```

---

## Performance

### Objectifs

- **Scale Time**: < 2 minutes
- **Failover Time**: < 30 secondes
- **Availability**: 99.95%
- **Response Time**: < 100ms (95th percentile)
- **Throughput**: 5000 req/s

### Monitoring

- **CPU Usage**: Auto-scale à 70%
- **Memory Usage**: Auto-scale à 80%
- **Request Rate**: Auto-scale à 100 req/s/pod
- **Error Rate**: Alert à 1%

---

## Haute Disponibilité

### Mesures

- **Multi-AZ**: Déploiement sur 3+ zones
- **Multi-Region**: Active-passive entre régions
- **Health Checks**: Monitoring continu
- **Auto-Failover**: Basculement automatique
- **Data Replication**: Synchrone/Asynchrone

### RTO/RPO

- **RTO**: < 30 secondes
- **RPO**: < 5 minutes
- **Recovery Time**: < 2 minutes
- **Data Loss**: < 1 minute

---

## Livrables

1. **Auto-Scaling Setup**: Configuration complète
2. **HA Database**: Cluster PostgreSQL
3. **HA Cache**: Cluster Redis
4. **Failover System**: Automatisé
5. **Performance Monitoring**: Dashboards et alertes
6. **Disaster Recovery**: Procédures testées

---

## Critères de Succès

- [ ] Auto-scaling fonctionnel
- [ ] Haute disponibilité validée
- [ ] Failover automatique testé
- [ ] Performance objectifs atteints
- [ ] Monitoring complet
- [ ] Documentation DR

---

## Suivi

### Post-Implémentation

1. **Performance Monitoring**: Surveillance continue
2. **Capacity Planning**: Planification proactive
3. **Failover Testing**: Tests réguliers
4. **Cost Optimization**: Optimisation des coûts
5. **Security Monitoring**: Surveillance sécurité
