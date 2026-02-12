# Guide de Déploiement TwinMe IA

Ce guide décrit le déploiement de l'infrastructure scalable et haute disponibilité de TwinMe IA selon les spécifications de l'Epic 10 Story 10.2.

## 🏗️ Architecture Déployée

### Composants Principaux

- **Auto-Scaling**: HPA (3-50 replicas), VPA, Cluster Autoscaler
- **Load Balancing**: NLB/ALB avec health checks et cross-zone
- **Base de Données**: PostgreSQL cluster (3 nœuds) avec réplication
- **Cache**: Redis cluster (6 nœuds) avec sharding
- **Monitoring**: Prometheus + Grafana + AlertManager
- **Facturation**: Système complet avec Stripe integration
- **Disaster Recovery**: Multi-région avec failover automatique

### Objectifs de Performance

| Métrique | Cible | Implémentation |
|-----------|---------|----------------|
| Scale Time | < 2 minutes | HPA avec seuils CPU 70%, Memory 80% |
| Failover Time | < 30 secondes | Health checks toutes les 30s |
| Availability | 99.95% | Multi-AZ, multi-région |
| Response Time | < 100ms (95th) | Monitoring temps réponse |
| Throughput | 5000 req/s | Auto-scaling jusqu'à 50 replicas |

## 🚀 Prérequis

### Outils Requis

- **kubectl** v1.24+
- **helm** v3.8+
- **AWS CLI** v2.0+
- **Docker** v20.0+
- **Node.js** v18.20.8+

### Infrastructure AWS

- **EKS Cluster** avec au moins 3 nœuds
- **VPC** avec au moins 3 Availability Zones
- **S3 Bucket** pour les backups
- **Route53** pour le DNS management
- **IAM Roles** avec permissions appropriées

## 📋 Étapes de Déploiement

### 1. Configuration Initiale

```bash
# Cloner le repository
git clone https://github.com/your-org/twinme-ia.git
cd twinme-ia

# Configurer les variables d'environnement
cp .env.production.example .env.production
# Éditer .env.production avec vos valeurs
```

### 2. Déploiement Automatisé

```bash
# Rendre le script exécutable
chmod +x scripts/deploy-infrastructure.sh

# Lancer le déploiement
./scripts/deploy-infrastructure.sh

# Ou avec variables personnalisées
NAMESPACE=twinme-staging REGION=eu-west-3 ./scripts/deploy-infrastructure.sh
```

### 3. Déploiement Manuel (Optionnel)

```bash
# Créer le namespace
kubectl create namespace twinme-prod

# Déployer les secrets
kubectl apply -f secrets/

# Installer les opérateurs
helm install cnpg cnpg/cloudnative-pg -n twinme-prod
helm install redis-operator redis/redis-operator -n twinme-prod

# Déployer l'infrastructure
kubectl apply -f k8s/postgres-cluster.yaml -n twinme-prod
kubectl apply -f k8s/redis-cluster.yaml -n twinme-prod
kubectl apply -f k8s/advanced-lb.yaml -n twinme-prod
kubectl apply -f k8s/hpa.yaml -n twinme-prod
```

## 🔧 Configuration

### Variables d'Environnement Clés

```bash
# Base de données
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379

# Kubernetes
NAMESPACE=twinme-prod
REGION=eu-west-3

# AWS
AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key

# Monitoring
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PROMETHEUS_URL=http://prometheus.monitoring.svc.cluster.local:9090

# Facturation
STRIPE_SECRET_KEY=sk_live_...
INVOICE_CURRENCY=EUR
```

### Configuration Auto-scaling

```yaml
# k8s/hpa.yaml
minReplicas: 3
maxReplicas: 50
cpuThreshold: 70
memoryThreshold: 80
requestRateThreshold: 100
```

## 📊 Monitoring et Alertes

### Accès aux Outils

- **Grafana**: `https://grafana.twinme.ai` (admin/admin123)
- **Prometheus**: `https://prometheus.twinme.ai`
- **AlertManager**: `https://alertmanager.twinme.ai`

### Métriques Clés

- **CPU/Memory Usage**: Auto-scaling triggers
- **Request Rate**: Performance monitoring
- **Error Rate**: Health checks
- **Response Time**: SLA monitoring
- **Database Connections**: Resource monitoring

### Alertes Configurées

- High CPU/Memory usage (>80%)
- High error rate (>5%)
- High latency (>5s)
- Database connection issues
- Service downtime

## 💰 Système de Facturation

### Configuration Stripe

```bash
# Clés API
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Webhooks
- invoice.payment_succeeded
- invoice.payment_failed
- customer.subscription.created
```

### Plans Tarifaires

| Plan | Prix/mois | Requêtes | Tokens | Features |
|-------|------------|-----------|---------|----------|
| Free | €0 | 1,000 | 10K | Support communautaire |
| Basic | €29 | 10,000 | 100K | Support email |
| Premium | €99 | Illimité | Illimité | Support prioritaire |
| Enterprise | €499 | Illimité | Illimité | SLA garanti |

## 🔄 Tests et Validation

### Tests de Santé

```bash
# Vérifier tous les pods
kubectl get pods -n twinme-prod

# Tester la base de données
kubectl exec -n twinme-prod deployment/twinme-postgres-1 -- psql -U twinme -d twinme -c "SELECT 1;"

# Tester Redis
kubectl exec -n twinme-prod deployment/twinme-redis -- redis-cli ping

# Tester l'API
curl https://api.twinme.ai/health
```

### Tests de Charge

```bash
# Lancer les tests de scalabilité
./scripts/scalability-tests.sh

# Test de montée en charge
k6 run --vus 500 --duration 30s scripts/spike-test.js

# Test d'endurance
k6 run --vus 200 --duration 3600s scripts/endurance-test.js
```

### Tests de Failover

```bash
# Simuler une panne de région
kubectl scale deployment twinme-api-primary --replicas=0 -n twinme-prod

# Vérifier le basculement automatique
kubectl get pods -n twinme-prod -w

# Tester la récupération
kubectl scale deployment twinme-api-primary --replicas=3 -n twinme-prod
```

## 🔒 Sécurité

### Bonnes Pratiques

- **Secrets Management**: Utiliser Kubernetes Secrets
- **Network Policies**: Isoler les services
- **RBAC**: Principe du moindre privilège
- **SSL/TLS**: Chiffrement bout en bout
- **Vulnerability Scanning**: Scan régulier des images

### Configuration Sécurité

```yaml
# Network Policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: twinme-network-policy
spec:
  podSelector:
    matchLabels:
      app: twinme-api
  policyTypes:
  - Ingress
  - Egress
```

## 🚨 Gestion des Incidents

### Procédures d'Urgence

1. **Détection**: Alertes Slack/PagerDuty
2. **Évaluation**: Impact et criticité
3. **Isolation**: Contenir l'incident
4. **Résolution**: Appliquer le fix
5. **Vérification**: Confirmer la résolution
6. **Post-mortem**: Analyse et amélioration

### Contacts d'Urgence

- **Infrastructure**: infra@twinme.ai
- **Sécurité**: security@twinme.ai
- **Support 24/7**: +33 1 234 567 890

## 📈 Performance et Optimisation

### Monitoring Continu

- **Métriques temps réel**: Dashboard Grafana
- **Alertes proactives**: Seuils configurés
- **Analyse des logs**: ELK Stack
- **Performance profiling**: APM integration

### Optimisations

- **Database**: Indexation, connection pooling
- **Cache**: Redis clustering, stratégies TTL
- **API**: Compression, HTTP/2, CDN
- **Infrastructure**: Right-sizing, spot instances

## 🔄 Maintenance et Mises à Jour

### Déploiement Continu

```bash
# Rolling update
kubectl set image deployment/twinme-api twinme-api=v2.0.0 -n twinme-prod

# Vérifier le statut
kubectl rollout status deployment/twinme-api -n twinme-prod

# Annulation si problème
kubectl rollout undo deployment/twinme-api -n twinme-prod
```

### Backup et Recovery

```bash
# Backup automatique (quotidien)
kubectl get cronjobs -n twinme-prod

# Restauration
kubectl apply -f backup/restore-job.yaml
```

## 📚 Documentation Additionnelle

- [Architecture complète](./Architecture/00-Architecture.md)
- [Guide de monitoring](./docs/monitoring.md)
- [Procédures de disaster recovery](./docs/disaster-recovery.md)
- [API Documentation](./docs/api.md)

## 🆘 Support

Pour toute question ou problème lors du déploiement :

- **Documentation**: https://docs.twinme.ai
- **Support**: support@twinme.ai
- **Issues GitHub**: https://github.com/your-org/twinme-ia/issues

---

**Note**: Ce guide est basé sur les spécifications de l'Epic 10 Story 10.2 et garantit une infrastructure scalable, haute disponibilité et un système de facturation robuste.
