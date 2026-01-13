# E10-Story10-1-Deploiement-Production.md

## Epic 10: Déploiement & Production

### Story 10.1: Déploiement en production

**Description**: Infrastructure de production scalable et sécurisée

---

## Objectif

Déployer l'application TwinMe IA en production avec une infrastructure scalable, sécurisée, haute disponibilité et monitoring complet.

---

## Prérequis

- Code source complet et testé
- Infrastructure cloud disponible
- Domaines et certificats SSL
- Services externes configurés

---

## Spécifications Techniques

### 1. Architecture de Production

#### 1.1 Infrastructure Cloud

```yaml
# infrastructure/production.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: twinme-prod
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: twinme-api
  namespace: twinme-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: twinme-api
  template:
    metadata:
      labels:
        app: twinme-api
    spec:
      containers:
      - name: api
        image: twinme/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: twinme-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: twinme-secrets
              key: redis-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: twinme-api-service
  namespace: twinme-prod
spec:
  selector:
    app: twinme-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: twinme-ingress
  namespace: twinme-prod
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
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
            name: twinme-api-service
            port:
              number: 80
```

#### 1.2 Configuration Docker

```dockerfile
# Dockerfile.production
FROM node:18-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installation des dépendances
RUN npm ci --only=production && npm cache clean --force

# Copie du code source
COPY . .

# Build de l'application
RUN npm run build

# Image de production
FROM node:18-alpine AS production

# Création de l'utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

WORKDIR /app

# Copie des fichiers build
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json

# Permissions
RUN mkdir -p /app/logs && chown -R nextjs:nodejs /app/logs

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

#### 1.3 Configuration CI/CD

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run tests
      run: npm run test:ci
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Security audit
      run: npm audit --audit-level moderate

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Build application
      run: npm run build
      env:
        NODE_ENV: production
    
    - name: Build Docker image
      run: |
        docker build -f Dockerfile.production -t twinme/api:${{ github.sha }} .
        docker tag twinme/api:${{ github.sha }} twinme/api:latest
    
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push twinme/api:${{ github.sha }}
        docker push twinme/api:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup kubectl
      uses: azure/setup-kubectl@v3
      with:
        version: 'v1.24.0'
    
    - name: Configure kubectl
      run: |
        echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
        export KUBECONFIG=kubeconfig
    
    - name: Deploy to Kubernetes
      run: |
        kubectl set image deployment/twinme-api api=twinme/api:${{ github.sha }} -n twinme-prod
        kubectl rollout status deployment/twinme-api -n twinme-prod
    
    - name: Verify deployment
      run: |
        kubectl get pods -n twinme-prod
        kubectl logs -l app=twinme-api -n twinme-prod --tail=50
```

### 2. Base de Données Production

#### 2.1 Configuration PostgreSQL

```sql
-- database/production-setup.sql
-- Configuration de la base de données production

-- Extension pour la recherche vectorielle
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Configuration des performances
ALTER SYSTEM SET shared_preload_libraries = 'vector';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Configuration du logging
ALTER SYSTEM SET log_statement = 'mod';
ALTER SYSTEM SET log_min_duration_statement = 1000;
ALTER SYSTEM SET log_checkpoints = on;
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;
ALTER SYSTEM SET log_lock_waits = on;

-- Application des changements
SELECT pg_reload_conf();

-- Création des indexes pour la performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_user_id_created 
ON conversations(user_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_id_timestamp 
ON messages(conversation_id, timestamp);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_chunks_embedding 
ON document_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id_start_time 
ON sessions(user_id, start_time);

-- Partitionnement des tables pour les grandes volumes
CREATE TABLE session_events_2024 PARTITION OF session_events
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Configuration de la réplication
CREATE PUBLICATION twinme_pub FOR TABLE 
  users, conversations, messages, document_chunks, sessions;

-- Configuration des RLS (Row Level Security)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Politiques de sécurité
CREATE POLICY user_conversations ON conversations
FOR ALL TO authenticated_users
USING (user_id = current_user_id());

CREATE POLICY user_messages ON messages
FOR ALL TO authenticated_users
USING (conversation_id IN (
  SELECT id FROM conversations WHERE user_id = current_user_id()
));
```

#### 2.2 Configuration Redis

```redis
# redis/production.conf
# Configuration Redis pour la production

# Réseau
port 6379
bind 0.0.0.0
protected-mode yes
requirepass ${REDIS_PASSWORD}

# Mémoire
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistance
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename twinme-prod.rdb
dir /data

# AOF
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Logging
loglevel notice
logfile /var/log/redis/redis-server.log

# Performance
tcp-keepalive 300
timeout 0
tcp-backlog 511

# Sécurité
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command KEYS ""
rename-command CONFIG ""
rename-command SHUTDOWN ""
rename-command DEBUG ""
```

### 3. Monitoring et Logging

#### 3.1 Configuration Prometheus

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alert_rules.yml"

scrape_configs:
  - job_name: 'twinme-api'
    static_configs:
      - targets: ['twinme-api-service:80']
    metrics_path: '/metrics'
    scrape_interval: 30s

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres-exporter:9187']

  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

#### 3.2 Configuration Grafana

```json
{
  "dashboard": {
    "title": "TwinMe IA Production",
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ]
      },
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "Requests/sec"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m])",
            "legendFormat": "Error Rate"
          }
        ]
      },
      {
        "title": "Database Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "Active Connections"
          }
        ]
      }
    ]
  }
}
```

### 4. Sécurité

#### 4.1 Configuration HTTPS

```nginx
# nginx/production.conf
server {
    listen 443 ssl http2;
    server_name api.twinme.ai;

    # Certificats SSL
    ssl_certificate /etc/ssl/certs/twinme-api.crt;
    ssl_certificate_key /etc/ssl/private/twinme-api.key;
    
    # Configuration SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Headers de sécurité
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; media-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Proxy vers l'API
    location / {
        proxy_pass http://twinme-api-service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeout
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check
    location /health {
        proxy_pass http://twinme-api-service/health;
        access_log off;
    }
}

# Redirection HTTP vers HTTPS
server {
    listen 80;
    server_name api.twinme.ai;
    return 301 https://$server_name$request_uri;
}
```

#### 4.2 Configuration Secrets

```yaml
# k8s/secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: twinme-secrets
  namespace: twinme-prod
type: Opaque
data:
  # Base64 encoded values
  database-url: <BASE64_ENCODED_DB_URL>
  redis-url: <BASE64_ENCODED_REDIS_URL>
  openai-api-key: <BASE64_ENCODED_OPENAI_KEY>
  anthropic-api-key: <BASE64_ENCODED_ANTHROPIC_KEY>
  jwt-secret: <BASE64_ENCODED_JWT_SECRET>
  encryption-key: <BASE64_ENCODED_ENCRYPTION_KEY>
---
apiVersion: v1
kind: Secret
metadata:
  name: twinme-ssl
  namespace: twinme-prod
type: kubernetes.io/tls
data:
  tls.crt: <BASE64_ENCODED_CERT>
  tls.key: <BASE64_ENCODED_KEY>
```

### 5. Backup et Recovery

#### 5.1 Script de Backup

```bash
#!/bin/bash
# scripts/backup-production.sh

set -e

# Configuration
BACKUP_DIR="/backups/twinme"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Création du répertoire de backup
mkdir -p $BACKUP_DIR

echo "Starting backup process at $(date)"

# Backup PostgreSQL
echo "Backing up PostgreSQL..."
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/postgres_$DATE.sql.gz

# Backup Redis
echo "Backing up Redis..."
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup des fichiers
echo "Backing up file storage..."
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /app/storage

# Upload vers S3
echo "Uploading to S3..."
aws s3 cp $BACKUP_DIR/postgres_$DATE.sql.gz s3://twinme-backups/database/
aws s3 cp $BACKUP_DIR/redis_$DATE.rdb s3://twinme-backups/redis/
aws s3 cp $BACKUP_DIR/files_$DATE.tar.gz s3://twinme-backups/files/

# Nettoyage des anciens backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.rdb" -mtime +$RETENTION_DAYS -delete

# Vérification
echo "Backup completed successfully at $(date)"
echo "Backup size: $(du -sh $BACKUP_DIR | cut -f1)"

# Notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ TwinMe backup completed successfully"}' \
  $SLACK_WEBHOOK_URL
```

#### 5.2 Script de Recovery

```bash
#!/bin/bash
# scripts/recover-production.sh

set -e

BACKUP_DATE=$1
if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date>"
    echo "Example: $0 20240115_143000"
    exit 1
fi

BACKUP_DIR="/backups/twinme"
S3_BUCKET="twinme-backups"

echo "Starting recovery process for backup: $BACKUP_DATE"

# Download depuis S3
echo "Downloading backup files..."
aws s3 cp s3://$S3_BUCKET/database/postgres_$BACKUP_DATE.sql.gz $BACKUP_DIR/
aws s3 cp s3://$S3_BUCKET/redis/redis_$BACKUP_DATE.rdb $BACKUP_DIR/
aws s3 cp s3://$S3_BUCKET/files/files_$BACKUP_DATE.tar.gz $BACKUP_DIR/

# Stop des services
echo "Stopping services..."
kubectl scale deployment twinme-api --replicas=0 -n twinme-prod

# Recovery PostgreSQL
echo "Recovering PostgreSQL..."
gunzip -c $BACKUP_DIR/postgres_$BACKUP_DATE.sql.gz | psql $DATABASE_URL

# Recovery Redis
echo "Recovering Redis..."
redis-cli FLUSHALL
redis-cli --rdb $BACKUP_DIR/redis_$BACKUP_DATE.rdb

# Recovery fichiers
echo "Recovering files..."
tar -xzf $BACKUP_DIR/files_$BACKUP_DATE.tar.gz -C /

# Redémarrage des services
echo "Restarting services..."
kubectl scale deployment twinme-api --replicas=3 -n twinme-prod

# Vérification
echo "Waiting for services to be ready..."
kubectl rollout status deployment/twinme-api -n twinme-prod

echo "Recovery completed successfully at $(date)"

# Notification
curl -X POST -H 'Content-type: application/json' \
  --data "{\"text\":\"🔄 TwinMe recovery completed for backup: $BACKUP_DATE\"}" \
  $SLACK_WEBHOOK_URL
```

---

## Tâches Détaillées

### 1. Infrastructure Cloud
- [ ] Déployer cluster Kubernetes
- [ ] Configurer networking et Ingress
- [ ] Mettre en place le load balancing
- [ ] Configurer l'autoscaling

### 2. Base de Données
- [ ] Déployer PostgreSQL en cluster
- [ ] Configurer Redis en haute disponibilité
- [ ] Mettre en place la réplication
- [ ] Optimiser les performances

### 3. Sécurité
- [ ] Configurer HTTPS/TLS
- [ ] Mettre en place les secrets
- [ ] Configurer les firewalls
- [ ] Activer le monitoring de sécurité

### 4. Monitoring et Logging
- [ ] Déployer Prometheus et Grafana
- [ ] Configurer ELK stack
- [ ] Mettre en place les alertes
- [ ] Configurer les dashboards

### 5. CI/CD
- [ ] Configurer GitHub Actions
- [ ] Mettre en place les tests automatisés
- [ ] Configurer le déploiement automatique
- [ ] Ajouter les rollback automatiques

### 6. Backup et Recovery
- [ ] Configurer les backups automatiques
- [ ] Mettre en place la rétention
- [ ] Tester les procédures de recovery
- [ ] Documenter les procédures

---

## Validation

### Tests de Déploiement

```bash
#!/bin/bash
# scripts/deployment-tests.sh

# Test de l'API
echo "Testing API endpoints..."
curl -f https://api.twinme.ai/health || exit 1
curl -f https://api.twinme.ai/ready || exit 1

# Test de la base de données
echo "Testing database connection..."
psql $DATABASE_URL -c "SELECT 1;" || exit 1

# Test de Redis
echo "Testing Redis connection..."
redis-cli -u $REDIS_URL ping || exit 1

# Test des performances
echo "Running performance tests..."
k6 run --vus 10 --duration 30s scripts/performance-test.js

echo "All deployment tests passed!"
```

---

## Architecture

### Composants

1. **Kubernetes Cluster**: Orchestration des conteneurs
2. **Load Balancer**: Distribution du trafic
3. **PostgreSQL Cluster**: Base de données principale
4. **Redis Cluster**: Cache et sessions
5. **Monitoring Stack**: Prometheus + Grafana
6. **Logging Stack**: ELK ou équivalent

### Flux de Déploiement

```
Git Push → CI/CD Pipeline → Tests → Build → Deploy → Verification → Monitoring
```

---

## Performance

### Objectifs

- **Uptime**: 99.9%
- **Response Time**: < 200ms (95th percentile)
- **Throughput**: 1000 req/s
- **Error Rate**: < 0.1%
- **Scalability**: Auto-scaling jusqu'à 10x

### Monitoring

- **CPU Usage**: < 70%
- **Memory Usage**: < 80%
- **Disk Usage**: < 85%
- **Network Latency**: < 50ms

---

## Sécurité

### Mesures

- **HTTPS**: TLS 1.3 obligatoire
- **Authentication**: JWT avec rotation
- **Authorization**: RBAC
- **Encryption**: AES-256 pour les données
- **Audit**: Logs complets
- **Compliance**: GDPR et RGPD

### Scans

- **Vulnerability**: Scans hebdomadaires
- **Penetration**: Tests trimestriels
- **Dependencies**: Automatisé
- **Code**: SAST/DAST

---

## Livrables

1. **Infrastructure Kubernetes**: Cluster production
2. **CI/CD Pipeline**: Pipeline complet
3. **Monitoring Stack**: Dashboards et alertes
4. **Backup System**: Automatisé et testé
5. **Security Setup**: Sécurité complète
6. **Documentation**: Procédures opérationnelles

---

## Critères de Succès

- [ ] Déploiement automatisé fonctionnel
- [ ] Monitoring complet en place
- [ ] Sécurité validée
- [ ] Performance objectifs atteints
- [ ] Backup et recovery testés
- [ ] Documentation complète

---

## Suivi

### Post-Déploiement

1. **Performance Monitoring**: Surveillance continue
2. **Security Monitoring**: Détection des menaces
3. **User Feedback**: Collecte des retours
4. **Cost Optimization**: Optimisation des coûts
5. **Capacity Planning**: Planification de la capacité
