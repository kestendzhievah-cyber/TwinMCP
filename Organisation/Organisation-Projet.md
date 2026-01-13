# Organisation du Projet TwinMCP - Epic et Stories

## Vue d'ensemble

TwinMCP est un serveur MCP (Model Context Protocol) conçu pour fournir aux IDE et LLM des extraits de documentation et de code toujours à jour pour n'importe quelle bibliothèque logicielle.

---

## Epic 1: Infrastructure Core et Foundation

**Objectif**: Mettre en place l'infrastructure de base nécessaire au fonctionnement du système TwinMCP.

### Stories détaillées:

#### Story 1.1: Configuration de l'environnement de développement
- **Description**: Mise en place de l'environnement de développement avec TypeScript, Node.js 20+, et les outils de build
- **Tâches**:
  - Initialiser le projet TypeScript avec configuration stricte
  - Configurer ESLint, Prettier, et Husky pour la qualité du code
  - Mettre en place Jest pour les tests unitaires
  - Créer les scripts de build et de développement
- **Livrables**: Projet TypeScript fonctionnel avec tooling de qualité

#### Story 1.2: Configuration des bases de données
- **Description**: Mise en place de PostgreSQL pour les métadonnées et Redis pour le cache
- **Tâches**:
  - Installer et configurer PostgreSQL avec schéma initial
  - Configurer Redis pour le cache et les sessions
  - Créer les migrations Prisma pour le schéma de données
  - Mettre en place les connexions et pools de connexions
- **Livrables**: Bases de données configurées avec schéma fonctionnel

#### Story 1.3: Infrastructure de vector store
- **Description**: Configuration de Pinecone/Qdrant pour le stockage et la recherche vectorielle
- **Tâches**:
  - Créer un compte et configurer l'index vector store
  - Définir la dimension (1536) et la métrique (cosine similarity)
  - Implémenter le client d'accès au vector store
  - Créer les utilitaires d'insertion et de recherche
- **Livrables**: Vector store opérationnel avec client intégré

#### Story 1.4: Stockage objet (S3/MinIO)
- **Description**: Configuration du stockage pour les documents bruts et les snapshots
- **Tâches**:
  - Configurer le bucket S3 ou MinIO
  - Définir les politiques d'accès et permissions
  - Implémenter le client d'upload/download
  - Créer la structure de dossiers pour les bibliothèques
- **Livrables**: Stockage objet configuré avec client fonctionnel

---

## Epic 2: Serveur MCP Core

**Objectif**: Développer le serveur MCP qui expose les outils de résolution et d'interrogation de documentation.

### Stories détaillées:

#### Story 2.1: Package NPM TwinMCP Server
- **Description**: Création du package NPM @twinmcp/mcp avec le SDK MCP officiel
- **Tâches**:
  - Initialiser le package NPM avec configuration TypeScript
  - Intégrer @modelcontextprotocol/sdk
  - Implémenter la structure de base des outils MCP
  - Créer les interfaces TypeScript pour les outils
- **Livrables**: Package NPM @twinmcp/mcp publié localement

#### Story 2.2: Implémentation de l'outil resolve-library-id
- **Description**: Développer l'outil MCP pour résoudre les noms de bibliothèques
- **Tâches**:
  - Définir le schéma d'entrée pour l'outil
  - Implémenter la logique de parsing de query
  - Intégrer avec le Library Resolution Engine
  - Ajouter la validation et la gestion des erreurs
- **Livrables**: Outil resolve-library-id fonctionnel

#### Story 2.3: Implémentation de l'outil query-docs
- **Description**: Développer l'outil MCP pour interroger la documentation
- **Tâches**:
  - Définir le schéma d'entrée pour l'outil
  - Implémenter la logique de recherche vectorielle
  - Assembler le contexte optimisé pour LLM
  - Formater la réponse avec métadonnées
- **Livrables**: Outil query-docs fonctionnel

#### Story 2.4: Gestion des connexions stdio et HTTP
- **Description**: Support des deux modes de connexion MCP
- **Tâches**:
  - Implémenter le serveur stdio pour usage local
  - Implémenter le serveur HTTP pour usage distant
  - Gérer la sérialisation/désérialisation MCP
  - Ajouter le logging et le monitoring
- **Livrables**: Serveur MCP supportant stdio et HTTP

---

## Epic 3: API Gateway et Authentification

**Objectif**: Créer la passerelle API pour les connexions distantes avec authentification et rate limiting.

### Stories détaillées:

#### Story 3.1: API Gateway de base
- **Description**: Mise en place du serveur Fastify/Express avec endpoints MCP
- **Tâches**:
  - Créer le serveur API avec Fastify
  - Implémenter les endpoints /mcp et /mcp/oauth
  - Ajouter le middleware de logging et CORS
  - Créer le endpoint /health pour monitoring
- **Livrables**: API Gateway fonctionnelle avec endpoints de base

#### Story 3.2: Service d'authentification API Keys
- **Description**: Validation des clés API avec gestion des quotas
- **Tâches**:
  - Implémenter la validation de clés API hashées
  - Créer le système de quotas par clé
  - Ajouter le tracking d'utilisation (last_used_at)
  - Gérer la révocation de clés
- **Livrables**: Authentification par API key fonctionnelle

#### Story 3.3: Flux OAuth 2.0
- **Description**: Implémentation complète du flow OAuth 2.0 pour les IDE
- **Tâches**:
  - Configurer Passport.js avec stratégies OAuth
  - Implémenter l'endpoint d'autorisation
  - Créer l'échange de code contre token
  - Gérer les refresh tokens et expiration
- **Livrables**: Flow OAuth 2.0 complet et fonctionnel

#### Story 3.4: Rate limiting et quotas
- **Description**: Système de limitation de débit par utilisateur et IP
- **Tâches**:
  - Implémenter le rate limiting avec Redis sliding window
  - Créer les quotas par niveau (free/premium)
  - Ajouter les headers X-RateLimit-* dans les réponses
  - Gérer les dépassements de quotas
- **Livrables**: Rate limiting robuste avec quotas configurables

---

## Epic 4: Library Resolution Engine

**Objectif**: Développer le moteur de recherche et de correspondance des bibliothèques.

### Stories détaillées:

#### Story 4.1: Index de bibliothèques
- **Description**: Création et peuplement de l'index des bibliothèques supportées
- **Tâches**:
  - Créer la table libraries avec full-text search
  - Peupler l'index avec les bibliothèques populaires
  - Ajouter les métadonnées (tags, catégories, popularité)
  - Implémenter la recherche PostgreSQL GIN
- **Livrables**: Index de bibliothèques fonctionnel et peuplé

#### Story 4.2: Algorithmes de matching
- **Description**: Implémentation des algorithmes de correspondance floue
- **Tâches**:
  - Développer l'extraction d'entités depuis les queries
  - Implémenter la distance de Levenshtein
  - Créer le scoring par popularité et pertinence
  - Ajouter le cache Redis des résolutions
- **Livrables**: Moteur de matching avec scoring et cache

#### Story 4.3: Interface de recherche
- **Description**: API pour rechercher et résoudre les bibliothèques
- **Tâches**:
  - Créer l'endpoint de recherche de bibliothèques
  - Implémenter la pagination et filtrage
  - Ajouter les suggestions auto-complétion
  - Optimiser les performances avec index
- **Livrables**: Interface de recherche performante

---

## Epic 5: Documentation Query Engine

**Objectif**: Développer le moteur de recherche vectorielle pour la documentation.

### Stories détaillées:

#### Story 5.1: Génération d'embeddings
- **Description**: Intégration avec OpenAI API pour générer les embeddings
- **Tâches**:
  - Configurer le client OpenAI avec clé API
  - Implémenter la génération batch d'embeddings
  - Ajouter le cache des embeddings fréquents
  - Gérer les erreurs et retry logic
- **Livrables**: Service de génération d'embeddings robuste

#### Story 5.2: Recherche vectorielle
- **Description**: Implémentation de la recherche K-NN dans le vector store
- **Tâches**:
  - Développer la recherche par similarité cosine
  - Implémenter le filtrage par bibliothèque et version
  - Ajouter le reranking avec cross-encoder
  - Optimiser les temps de réponse
- **Livrables**: Moteur de recherche vectorielle performant

#### Story 5.3: Assemblage de contexte
- **Description**: Assemblage optimisé des résultats pour les LLM
- **Tâches**:
  - Implémenter la concaténation des chunks pertinents
  - Ajouter les métadonnées (URL, version, source)
  - Limiter à ~4000 tokens pour compatibilité LLM
  - Formater la sortie pour lisibilité
- **Livrables**: Assembleur de contexte optimisé

---

## Epic 6: Crawling Service

**Objectif**: Développer le service de monitoring et de téléchargement des documentations.

### Stories détaillées:

#### Story 6.1: Monitoring GitHub API
- **Description**: Surveillance des releases et mises à jour des bibliothèques
- **Tâches**:
  - Configurer Octokit pour GitHub API
  - Implémenter le monitoring des releases
  - Gérer les rate limits GitHub
  - Créer les webhooks pour notifications push
- **Livrables**: Service de monitoring GitHub fonctionnel

#### Story 6.2: Téléchargement des sources
- **Description**: Download automatique des docs et code source
- **Tâches**:
  - Implémenter le clonage Git shallow
  - Ajouter le scraping de sites web de documentation
  - Stocker les fichiers bruts dans S3
  - Gérer les erreurs de téléchargement
- **Livrables**: Service de téléchargement robuste

#### Story 6.3: Queue de jobs BullMQ
- **Description**: Système de file d'attente pour le crawling asynchrone
- **Tâches**:
  - Configurer BullMQ avec Redis
  - Créer les jobs crawl:library et crawl:all
  - Implémenter la gestion des priorités
  - Ajouter le monitoring des queues
- **Livrables**: Système de crawling asynchrone fonctionnel

---

## Epic 7: Parsing Service

**Objectif**: Développer le service de parsing et de traitement des documentations.

### Stories détaillées:

#### Story 7.1: Parsing Markdown
- **Description**: Extraction de contenu structuré depuis les fichiers Markdown
- **Tâches**:
  - Intégrer unified/remark pour parsing Markdown
  - Extraire les sections, code snippets, et métadonnées
  - Gérer les différents formats (MDX, CommonMark)
  - Nettoyer et normaliser le contenu
- **Livrables**: Parser Markdown robuste et flexible

#### Story 7.2: Chunking sémantique
- **Description**: Découpage intelligent du contenu en chunks optimisés
- **Tâches**:
  - Implémenter le découpage par taille (512-1024 tokens)
  - Ajouter le chunking sémantique par sections
  - Préserver le contexte entre chunks
  - Optimiser pour la recherche vectorielle
- **Livrables**: Système de chunking performant

#### Story 7.3: Pipeline complet
- **Description**: Intégration du pipeline complet de traitement
- **Tâches**:
  - Orchestrer le flux: S3 → Parsing → Chunking → Embedding → Vector Store
  - Ajouter le monitoring et logging
  - Implémenter la reprise sur erreur
  - Optimiser les performances batch
- **Livrables**: Pipeline de traitement complet et robuste

---

## Epic 8: Dashboard Web

**Objectif**: Créer l'interface web pour la gestion des comptes et configuration.

### Stories détaillées:

#### Story 8.1: Infrastructure Next.js
- **Description**: Mise en place de l'application Next.js avec styling
- **Tâches**:
  - Initialiser Next.js 14+ avec App Router
  - Configurer Tailwind CSS et shadcn/ui
  - Mettre en place l'authentification NextAuth
  - Créer le layout et navigation
- **Livrables**: Application Next.js fonctionnelle

#### Story 8.2: Gestion des clés API
- **Description**: Interface pour créer et gérer les clés API
- **Tâches**:
  - Créer la page /dashboard/api-keys
  - Implémenter la création/édition/suppression de clés
  - Afficher les quotas et utilisation
  - Ajouter la copie et régénération
- **Livrables**: Interface de gestion des clés complète

#### Story 8.3: Catalogue de bibliothèques
- **Description**: Visualisation des bibliothèques supportées
- **Tâches**:
  - Créer la page /dashboard/libraries
  - Afficher la liste avec recherche et filtrage
  - Montrer les statistiques (snippets, versions)
  - Ajouter la demande de nouvelles bibliothèques
- **Livrables**: Catalogue de bibliothèques interactif

#### Story 8.4: Statistiques d'utilisation
- **Description**: Tableau de bord des métriques d'utilisation
- **Tâches**:
  - Créer la page /dashboard/usage
  - Afficher les graphiques d'utilisation temporels
  - Montrer les top bibliothèques et queries
  - Ajouter l'export des données
- **Livrables**: Dashboard analytique complet

---

## Epic 9: Tests et Qualité

**Objectif**: Assurer la qualité et la fiabilité du système through tests complets.

### Stories détaillées:

#### Story 9.1: Tests unitaires
- **Description**: Couverture complète des composants avec Jest
- **Tâches**:
  - Écrire les tests pour tous les services
  - Couvrir les cas d'erreur et edge cases
  - Mock les dépendances externes (API, DB)
  - Atteindre >90% de couverture
- **Livrables**: Suite de tests unitaires complète

#### Story 9.2: Tests d'intégration
- **Description**: Tests end-to-end des workflows principaux
- **Tâches**:
  - Tester les workflows MCP complets
  - Valider l'intégration avec les APIs externes
  - Simuler les scénarios d'utilisation réels
  - Automatiser avec Playwright/Cypress
- **Livrables**: Suite d'intégration robuste

#### Story 9.3: Tests de performance
- **Description**: Validation des performances et scalabilité
- **Tâches**:
  - Benchmark des temps de réponse MCP
  - Test de charge sur l'API Gateway
  - Validation du cache et rate limiting
  - Optimisation des requêtes DB
- **Livrables**: Performance validée et optimisée

---

## Epic 10: Déploiement et Infrastructure

**Objectif**: Déployer l'application en production avec monitoring et maintenance.

### Stories détaillées:

#### Story 10.1: Dockerisation
- **Description**: Créer les images Docker pour tous les services
- **Tâches**:
  - Écrire les Dockerfiles optimisés
  - Créer docker-compose pour développement
  - Configurer les variables d'environnement
  - Optimiser la taille et sécurité des images
- **Livrables**: Application fully containerisée

#### Story 10.2: CI/CD Pipeline
- **Description**: Automatiser le build, test et déploiement
- **Tâches**:
  - Configurer GitHub Actions
  - Automatiser les tests sur chaque PR
  - Mettre en place le déploiement automatique
  - Gérer les environnements (dev/staging/prod)
- **Livrables**: Pipeline CI/CD complet

#### Story 10.3: Monitoring et Alerting
- **Description**: Mettre en place le monitoring de production
- **Tâches**:
  - Configurer Prometheus + Grafana
  - Ajouter Sentry pour error tracking
  - Créer les alertes importantes
  - Mettre en place les health checks
- **Livrables**: Système de monitoring complet

---

## Chronologie Suggérée

### Phase 1 (Mois 1-2): Foundation
- Epic 1: Infrastructure Core
- Epic 2: Serveur MCP Core (partie base)

### Phase 2 (Mois 3-4): Core Features
- Epic 3: API Gateway et Authentification
- Epic 4: Library Resolution Engine
- Epic 5: Documentation Query Engine

### Phase 3 (Mois 5-6): Data Processing
- Epic 6: Crawling Service
- Epic 7: Parsing Service

### Phase 4 (Mois 7-8): User Interface
- Epic 8: Dashboard Web

### Phase 5 (Mois 9-10): Quality & Production
- Epic 9: Tests et Qualité
- Epic 10: Déploiement et Infrastructure

---

## Dépendances entre Epic

1. **Epic 1** → Prérequis pour toutes les autres Epic
2. **Epic 2** → Dépend de Epic 1, Epic 4, Epic 5
3. **Epic 3** → Dépend de Epic 1
4. **Epic 4** → Dépend de Epic 1
5. **Epic 5** → Dépend de Epic 1, Epic 7
6. **Epic 6** → Dépend de Epic 1
7. **Epic 7** → Dépend de Epic 1, Epic 6
8. **Epic 8** → Dépend de Epic 1, Epic 3
9. **Epic 9** → Dépend de Epic 2, 3, 4, 5, 6, 7, 8
10. **Epic 10** → Dépend de toutes les Epic précédentes

Cette organisation permet un développement structuré et progressif du projet TwinMCP, avec des livrables clairs à chaque étape.
