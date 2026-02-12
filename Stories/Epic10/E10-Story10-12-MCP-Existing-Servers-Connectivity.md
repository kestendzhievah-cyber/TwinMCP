# E10-Story10-12-MCP-Existing-Servers-Connectivity.md

## Epic 10: Déploiement & Production

### Story 10.12: Connexion aux serveurs MCP déjà existants

**Description**: Offrir aux utilisateurs la possibilité de connecter leur compte TwinMCP à des serveurs MCP externes déjà déployés (self-hosted, partenaires, ou marketplace) afin d’exposer leurs outils immédiatement dans l’application sans devoir reconfigurer ou migrer leur infrastructure.

---

## Objectif

Définir et implémenter un parcours complet qui permet :
1. La déclaration sécurisée d’un serveur MCP externe (URL, protocole, schéma d’authentification, métadonnées).
2. La vérification de santé et la découverte automatique des outils (`tools/list`) pour hydrater l’UX TwinMCP.
3. La gestion sécurisée des secrets (API Key, Bearer, Basic, OAuth token, mTLS) associés à chaque serveur.
4. L’utilisation transparente des outils distants dans les conversations/agents TwinMCP avec suivi d’usage, quotas et alertes.
5. Le suivi détaillé des utilisations par utilisateur (requests, tokens, latence) afin d’alimenter la facturation et le reporting.
6. L’application automatique d’un plafond quotidien de 200 utilisations pour chaque utilisateur au plan gratuit.

---

## Contexte & dépendances

- Story 3.2 (Service API Keys) et Story 10.11 (usage plan) pour la validation côté TwinMCP.
- Configurations existantes du MCP interne (`/app/api/mcp/*`) pour réutiliser les middlewares auth/logging.
- Secret manager (Firebase, GCP Secret Manager ou vault interne) déjà exploité par d’autres intégrations.
- UI d’administration (app/admin/mcp-configurations) disponible pour accueillir le module de connexion.

---

## Portée

**Inclus**
- UI & API pour enregistrer un serveur MCP externe (CRUD sécurisé + tests d’intégration).
- Gestion des schémas d’authentification usuels (None, Static API Key, Basic Auth, Bearer Token, mTLS cert upload).
- Workflow de validation (ping `/.well-known/mcp` + `tools/list`).
- Mémoire de configuration par workspace / organisation (multi-tenant).
- Routage des requêtes MCP via un proxy TwinMCP pour journaliser et appliquer quotas.
- Instrumentation fine pour tracer chaque requête par utilisateur (compteurs requêtes/tokens, latence, erreurs) et exposer ces données au reste de la plateforme (facturation, analytics).
- Application stricte d’un quota de 200 requêtes/jour/utilisateur pour le plan gratuit, avec messagerie d’erreur standardisée (HTTP 429 + détails quota).

**Exclus**
- Marketplace publique ou découverte automatique des serveurs (à planifier plus tard).
- UI avancée de gestion des certificats (simple upload + stockage suffit pour cette story).
- Support OAuth 2.0 complet (préparer hooks mais hors périmètre si non critique).

---

## Architecture cible

1. **Backend**
   - Nouveau module `ExternalMcpService` (lib/services/mcp) pour gérer stockage + health-check.
   - Table `external_mcp_servers` + `external_mcp_credentials` (Prisma) avec champs : `name`, `base_url`, `auth_type`, `status`, `last_checked_at`, `owner_id`.
   - Proxy `/api/v1/external-mcp/:serverId/*` qui forwarde vers le serveur cible tout en injectant les en-têtes d’authentification et en journalisant.

2. **Frontend / Admin**
   - Page "Ajouter un serveur MCP" avec formulaire (nom, URL, auth, credentials upload) + bouton "Tester la connexion".
   - Liste des serveurs avec statut (Healthy / Warning / Down) et actions (Test, Edit, Delete).

3. **Sécurité**
   - Secrets chiffrés au repos + rotation possible.
   - Validation stricte des URL (HTTPS obligatoire par défaut, exceptions via feature flag).
   - Limitation par organisation (RBAC : seuls les admins peuvent enregistrer or modifier).

4. **Flux d’usage**
   - Lorsqu’un agent TwinMCP invoque un outil provenant d’un serveur externe, TwinMCP récupère la config, applique auth, envoie la requête, rapatrie la réponse et crédite l’usage dans les compteurs internes (Story 10.11).
   - Avant l’appel proxifié, un `UsageLimiter` vérifie le compteur quotidien de l’utilisateur et bloque au-delà de 200 requêtes pour les plans gratuits.

5. **Observabilité & reporting par utilisateur**
   - Table d’agrégation `external_mcp_usage_logs` (ou extension des tables existantes) stockant : `user_id`, `workspace_id`, `server_id`, `tool_name`, `request_id`, `tokens_in/out`, `latency_ms`, `status_code`.
   - Pipelines d’export (BigQuery/ClickHouse) alimentés via jobs asynchrones pour permettre dashboards et facturation détaillée.
   - Tableau de bord admin affichant l’utilisation par utilisateur/serveur/période avec filtres.

---

## Pré-requis techniques

- Migration Prisma pour les tables de configuration + indexes (`owner_id + name` unique).
- Support du stockage chiffré (libs existantes `lib/services/secret.service.ts`).
- Variables d’environnement :
  - `EXTERNAL_MCP_PROXY_TIMEOUT_MS`
  - `EXTERNAL_MCP_ALLOWED_PROTOCOLS`
  - `EXTERNAL_MCP_MAX_PER_ORG`
  - `EXTERNAL_MCP_USAGE_RETENTION_DAYS`
  - `EXTERNAL_MCP_FREE_DAILY_LIMIT` (par défaut 200, utilisé par le limiter).
- Feature flag `feature.externalMcpConnect` pour déploiement progressif.

---

## Tâches détaillées

1. **Modélisation & migrations**
   - Créer les tables `external_mcp_servers` et `external_mcp_credentials` avec relations utilisateur/organisation.
   - Ajouter champs `status`, `error_message`, `last_latency_ms`.
   - Scripts Prisma + seed de test.

2. **Service backend**
   - Implémenter `ExternalMcpService` (CRUD sécurisé, validation URL, chiffrement credentials, health-check `/.well-known/mcp`).
   - Ajouter `ExternalMcpProxyController` (Next.js route handler) pour forwarder les requêtes MCP (méthodes GET/POST/STREAM).
   - Gérer la journalisation + mesure d’usage (requests/tokens) en s’appuyant sur Story 10.11.
   - Intégrer `UsageLimiter` (Redis/Prisma) pour incrémenter et valider le quota quotidien de 200 requêtes pour les utilisateurs gratuits (reset automatique à minuit UTC).

3. **UI Admin**
   - Nouveau composant `ExternalMcpForm` (React) avec sections : Informations générales, Authentification, Tests.
   - Intégrer un tableau `ExternalMcpList` avec filtres et statut en temps réel (polling 30s ou websocket léger si existant).
   - Gestion des états d’erreur (échec handshake, certificat invalide, quota atteint).

4. **Tests & observabilité**
   - Tests unitaires (service + validation) et tests d’intégration (proxy end-to-end avec serveur MCP mocké).
   - Ajout de métriques Prometheus / logs structurés : `external_mcp_availability`, `external_mcp_latency`, `external_mcp_errors_total`.
   - Alerting (Story 8.x) : déclencher alerte si >30% des checks échouent sur 5 minutes.

5. **Tracking & reporting utilisateur**
   - Instrumenter le proxy pour générer des événements `ExternalMcpUsageEvent` contenant user/workspace/server/tool.
   - Créer un job de consolidation (cron ou queue worker) qui agrège les événements par utilisateur et les écrit dans `external_mcp_usage_daily`.
   - Exposer une API `/api/v1/external-mcp/usage` filtrable par utilisateur, période, serveur.
   - Brancher les compteurs sur le moteur de facturation et sur le module analytics (charts Uniques, latence moyenne, erreurs par user).

6. **Documentation & ops**
   - Ajouter guide dans `docs/` expliquant comment connecter un serveur existant.
   - Préparer runbook incident (serveur externe down, secret expiré, certificat invalide).
   - Mettre à jour `README-TwinMCP.md` avec la feature flag et prérequis TLS.

---

## Scénarios utilisateur clés

1. **Admin ajoute un serveur**
   - Renseigne nom + URL + auth.
   - Soumet → le backend stocke, chiffre les secrets, lance un health-check.
   - Si succès, l’UI affiche les outils découverts et autorise l’activation.

2. **Agent consomme un outil externe**
   - L’agent choisit un outil provenant du serveur externe (listé via `tools/list`).
   - TwinMCP proxifie l’appel, applique la clé API externe, journalise l’usage et renvoie la réponse.

3. **Serveur instable**
   - Health-check échoue → statut "Warning" avec message + dernière erreur.
   - Notification envoyée à l’admin, possibilité de retester ou désactiver.

4. **Admin consulte l’utilisation**
   - Filtre par utilisateur/serveur/période sur le tableau de bord.
   - Visualise les requêtes, tokens consommés, erreurs et latence.
   - Exporte le rapport (CSV/JSON) ou déclenche alertes ciblées.

5. **Utilisateur gratuit atteint 200 requêtes/jour**
   - Le limiter renvoie HTTP 429 + payload quota (`limit=200`, `remaining=0`, `reset_at`).
   - L’UI affiche une bannière incitant à upgrader.
   - Les métriques d’usage reflètent l’événement pour reporting.

---

## Critères de succès

- [ ] Au moins un serveur MCP externe peut être déclaré, validé et utilisé depuis TwinMCP sans code custom.
- [ ] Les secrets et certificats sont stockés chiffrés, jamais renvoyés en clair.
- [ ] Les outils exposés par le serveur externe apparaissent dans l’UX et sont exploitables par les agents.
- [ ] Les requêtes proxifiées sont traçables et créditées dans le système de quotas (Story 10.11).
- [ ] Les métriques d’utilisation par utilisateur (requêtes, tokens, latence, erreurs) sont disponibles via API et dashboard.
- [ ] Les utilisateurs gratuits sont automatiquement bridés à 200 requêtes/jour avec retour 429 cohérent et compteur reset quotidien.
- [ ] Les tests (unitaires + intégration) couvrent >80% des parcours critiques (création, proxy, erreurs).

---

## Points de vigilance / risques

- Dérives de sécurité (serveur malicieux) → sandboxer les réponses et limiter les protocoles.
- Gestion des certificats mTLS (taille, rotation) → prévoir documentation claire.
- Latence accrue due au proxy → ajouter timeout configurable + retenter 1 fois maximum.
- Multiplicité des schémas auth → prévoir interface pour en ajouter facilement (factory pattern).
- Confidentialité des données d’usage → pseudonymiser les exports externes et respecter la gouvernance RGPD.

---

## Suivi & prochaines étapes

- Phase pilote avec 2–3 serveurs partenaires pour valider la stabilité.
- Préparer Story 10.13 pour la marketplace et la découverte automatisée.
- Évaluer besoin d’un cache `tools/list` pour réduire la charge sur les serveurs externes.
