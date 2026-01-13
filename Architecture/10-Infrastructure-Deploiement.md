# Infrastructure et déploiement

## 1. Architecture d'hébergement

### Option 1 : Kubernetes (Production)

```yaml
# Namespace dédié
apiVersion: v1
kind: Namespace
metadata:
  name: twinmcp

---

# Deployment MCP API
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-api
  namespace: twinmcp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-api
  template:
    metadata:
      labels:
        app: mcp-api
    spec:
      containers:
      - name: api
        image: twinmcp/api:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: twinmcp-secrets
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
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---

# Service
apiVersion: v1
kind: Service
metadata:
  name: mcp-api-service
  namespace: twinmcp
spec:
  selector:
    app: mcp-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---

# HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: mcp-api-hpa
  namespace: twinmcp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: mcp-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

### Option 2 : Railway / Render (MVP rapide)

**Railway** :
- Déploiement via GitHub (auto-deploy sur push)
- Provisioning automatique de PostgreSQL, Redis
- Scaling vertical simple

**Render** :
- Configuration via `render.yaml`
- Support Docker natif
- Managed PostgreSQL inclus

---

## 2. CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy TwinMCP

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run linter
        run: npm run lint
        
      - name: Run tests
        run: npm test
        
      - name: Run type check
        run: npm run type-check

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t twinmcp/api:${{ github.sha }} .
        
      - name: Push to registry
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push twinmcp/api:${{ github.sha }}
          docker tag twinmcp/api:${{ github.sha }} twinmcp/api:latest
          docker push twinmcp/api:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/mcp-api api=twinmcp/api:${{ github.sha }} -n twinmcp
          kubectl rollout status deployment/mcp-api -n twinmcp
```

---

## 3. Configuration environnement

### Variables d'environnement (.env)

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/twinmcp
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL=3600

# Vector Store
PINECONE_API_KEY=xxx
PINECONE_ENVIRONMENT=us-east-1-aws
PINECONE_INDEX_NAME=twinmcp-docs

# S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=twinmcp-docs
AWS_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=xxx

# GitHub
GITHUB_TOKEN=xxx

# Auth
JWT_SECRET=xxx
OAUTH_CLIENT_ID=xxx
OAUTH_CLIENT_SECRET=xxx

# API
API_BASE_URL=https://api.twinmcp.com
PORT=3000
NODE_ENV=production

# Rate Limiting
RATE_LIMIT_FREE_RPM=100
RATE_LIMIT_FREE_RPD=10000
RATE_LIMIT_PREMIUM_RPM=1000

# Monitoring
SENTRY_DSN=xxx
```

---

## 4. Backups & Disaster Recovery

### PostgreSQL
- **Snapshots automatiques** : 1x/jour (retention 30 jours)
- **WAL archiving** : Continuous backup
- **Restore time objective (RTO)** : < 1h
- **Recovery point objective (RPO)** : < 15 min

### Redis
- **RDB snapshots** : Toutes les 6h
- **AOF** : Append-only file pour durabilité

### S3
- **Versioning activé** : Récupération des docs supprimées
- **Cross-region replication** : us-east-1 → eu-west-1

---

## 5. Scaling Strategy

### Horizontal Scaling
- **API Gateway** : Load balancer (NGINX/Cloudflare)
- **Backend workers** : Auto-scaling basé sur CPU/RAM
- **Background jobs** : Queue workers scalables (BullMQ)

### Vertical Scaling
- **Database** : Upgrade de la taille d'instance selon charge
- **Redis** : Cluster mode si > 10GB données

### Caching Strategy
- **CDN** (Cloudflare) : Assets statiques (dashboard)
- **Redis** : Réponses API fréquentes (TTL 1h)
- **Application cache** : In-memory pour config
