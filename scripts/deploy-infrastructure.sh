#!/bin/bash

# Script de déploiement d'infrastructure TwinMe IA
# Basé sur les spécifications E10-Story10-2-Scalabilite-HA.md

set -e

echo "🚀 Déploiement de l'infrastructure TwinMe IA..."

# Variables d'environnement
NAMESPACE=${NAMESPACE:-"twinme-prod"}
REGION=${REGION:-"eu-west-3"}
CLUSTER_NAME=${CLUSTER_NAME:-"twinme-prod"}

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérification des prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl n'est pas installé"
        exit 1
    fi
    
    if ! command -v helm &> /dev/null; then
        log_error "Helm n'est pas installé"
        exit 1
    fi
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI n'est pas installé"
        exit 1
    fi
    
    log_info "Prérequis vérifiés ✅"
}

# Création du namespace
create_namespace() {
    log_info "Création du namespace $NAMESPACE..."
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    log_info "Namespace créé ✅"
}

# Déploiement des secrets
deploy_secrets() {
    log_info "Déploiement des secrets..."
    
    # Secrets de base de données
    kubectl create secret generic postgres-credentials \
        --from-literal=username=twinme \
        --from-literal=password=$POSTGRES_PASSWORD \
        --from-literal=database=twinme \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Secrets AWS
    kubectl create secret generic aws-credentials \
        --from-literal=access-key=$AWS_ACCESS_KEY \
        --from-literal=secret-key=$AWS_SECRET_KEY \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Secrets de backup
    kubectl create secret generic backup-credentials \
        --from-literal=ACCESS_KEY_ID=$AWS_ACCESS_KEY \
        --from-literal=SECRET_ACCESS_KEY=$AWS_SECRET_KEY \
        -n $NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log_info "Secrets déployés ✅"
}

# Installation des opérateurs
install_operators() {
    log_info "Installation des opérateurs..."
    
    # CloudNativePG Operator
    helm repo add cnpg https://cloudnative-pg.github.io/charts
    helm repo update
    helm upgrade --install cnpg cnpg/cloudnative-pg \
        --namespace $NAMESPACE \
        --create-namespace \
        --wait
    
    # Redis Operator
    helm repo add redis https://ot-container-kit.github.io/helm-charts/
    helm upgrade --install redis-operator redis/redis-operator \
        --namespace $NAMESPACE \
        --create-namespace \
        --wait
    
    log_info "Opérateurs installés ✅"
}

# Déploiement de l'infrastructure de base de données
deploy_database() {
    log_info "Déploiement du cluster PostgreSQL..."
    kubectl apply -f k8s/postgres-cluster.yaml -n $NAMESPACE
    
    # Attendre que le cluster soit prêt
    kubectl wait --for=condition=ready pod -l app=cnpg -n $NAMESPACE --timeout=300s
    
    log_info "Cluster PostgreSQL déployé ✅"
}

# Déploiement du cache Redis
deploy_redis() {
    log_info "Déploiement du cluster Redis..."
    kubectl apply -f k8s/redis-cluster.yaml -n $NAMESPACE
    
    # Attendre que le cluster soit prêt
    kubectl wait --for=condition=ready pod -l app=redis-cluster -n $NAMESPACE --timeout=300s
    
    log_info "Cluster Redis déployé ✅"
}

# Déploiement du load balancer
deploy_loadbalancer() {
    log_info "Déploiement du load balancer..."
    kubectl apply -f k8s/advanced-lb.yaml -n $NAMESPACE
    
    # Attendre que le load balancer soit prêt
    kubectl wait --for=condition=ready ingress/twinme-api-ingress -n $NAMESPACE --timeout=300s
    
    log_info "Load balancer déployé ✅"
}

# Configuration de l'auto-scaling
configure_autoscaling() {
    log_info "Configuration de l'auto-scaling..."
    kubectl apply -f k8s/hpa.yaml -n $NAMESPACE
    kubectl apply -f k8s/cluster-autoscaler.yaml -n kube-system
    
    log_info "Auto-scaling configuré ✅"
}

# Configuration du monitoring
setup_monitoring() {
    log_info "Configuration du monitoring..."
    
    # Prometheus
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
        --set grafana.adminPassword=admin123 \
        --wait
    
    log_info "Monitoring configuré ✅"
}

# Configuration des alertes
setup_alerting() {
    log_info "Configuration des alertes..."
    
    # AlertManager
    kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertmanager-config
  namespace: monitoring
data:
  alertmanager.yml: |
    global:
      slack_api_url: "$SLACK_WEBHOOK_URL"
    route:
      group_by: ['alertname']
      group_wait: 10s
      group_interval: 10s
      repeat_interval: 1h
      receiver: 'web.hook'
    receivers:
    - name: 'web.hook'
      slack_configs:
      - api_url: "$SLACK_WEBHOOK_URL"
        channel: '#alerts'
        title: 'TwinMe IA Alert'
        text: '{{ range .Alerts }}{{ .Annotations.summary }}{{ end }}'
EOF
    
    log_info "Alertes configurées ✅"
}

# Tests de santé
health_checks() {
    log_info "Exécution des tests de santé..."
    
    # Test PostgreSQL
    kubectl exec -n $NAMESPACE deployment/twinme-postgres-1 -- psql -U twinme -d twinme -c "SELECT 1;"
    
    # Test Redis
    kubectl exec -n $NAMESPACE deployment/twinme-redis -- redis-cli ping
    
    # Test API
    LB_URL=$(kubectl get ingress twinme-api-ingress -n $NAMESPACE -o jsonpath='{.spec.rules[0].host}')
    curl -f https://$LB_URL/health || exit 1
    
    log_info "Tests de santé passés ✅"
}

# Tests de charge
load_tests() {
    log_info "Exécution des tests de charge..."
    
    # Attendre que tous les pods soient prêts
    kubectl wait --for=condition=ready pod -l app=twinme-api -n $NAMESPACE --timeout=300s
    
    # Lancer les tests de scalabilité
    chmod +x scripts/scalability-tests.sh
    ./scripts/scalability-tests.sh
    
    log_info "Tests de charge terminés ✅"
}

# Nettoyage en cas d'échec
cleanup_on_failure() {
    log_error "Échec du déploiement, nettoyage en cours..."
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    log_error "Nettoyage terminé"
}

# Configuration du handler d'erreur
trap 'cleanup_on_failure' ERR

# Fonction principale
main() {
    log_info "Début du déploiement de l'infrastructure TwinMe IA"
    
    check_prerequisites
    create_namespace
    deploy_secrets
    install_operators
    deploy_database
    deploy_redis
    deploy_loadbalancer
    configure_autoscaling
    setup_monitoring
    setup_alerting
    
    log_info "Attente de la stabilisation de l'infrastructure..."
    sleep 60
    
    health_checks
    load_tests
    
    log_info "🎉 Déploiement terminé avec succès!"
    log_info "📊 Tableau de bord disponible: https://grafana.$CLUSTER_NAME.$REGION.elb.amazonaws.com"
    log_info "🔍 Monitoring disponible: https://prometheus.$CLUSTER_NAME.$REGION.elb.amazonaws.com"
    log_info "🌐 API disponible: https://api.twinme.ai"
}

# Exécution
main "$@"
