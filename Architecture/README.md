# TwinMCP - Architecture Documentation

## Vue d'ensemble

Ce dossier contient la documentation complète de l'architecture du projet TwinMCP, un serveur MCP (Model Context Protocol) conçu pour fournir aux IDE et LLM des extraits de documentation et de code toujours à jour pour n'importe quelle bibliothèque logicielle.

## Structure de la documentation

### 📋 [00-Architecture.md](./00-Architecture.md)
Document principal contenant toute l'architecture consolidée

### 📚 Documentation détaillée

1. **[01-Introduction.md](./01-Introduction.md)** - Contexte, objectifs et périmètre du projet
2. **[02-Architecture-Haut-Niveau.md](./02-Architecture-Haut-Niveau.md)** - Vue d'ensemble système et principes
3. **[03-Stack-Technique.md](./03-Stack-Technique.md)** - Technologies et frameworks utilisés
4. **[04-Composants.md](./04-Composants.md)** - Architecture détaillée des composants
5. **[05-Modeles-Donnees.md](./05-Modeles-Donnees.md)** - Schéma de base de données et modèles
6. **[06-Workflows-Principaux.md](./06-Workflows-Principaux.md)** - Flux de travail principaux
7. **[07-APIs-Externes.md](./07-APIs-Externes.md)** - Intégrations avec services externes
8. **[08-Securite.md](./08-Securite.md)** - Stratégie de sécurité
9. **[09-Gestion-Erreurs.md](./09-Gestion-Erreurs.md)** - Gestion des erreurs et monitoring
10. **[10-Infrastructure-Deploiement.md](./10-Infrastructure-Deploiement.md)** - Infrastructure et déploiement
11. **[11-Standards-Code.md](./11-Standards-Code.md)** - Standards de développement
12. **[12-Strategie-Tests.md](./12-Strategie-Tests.md)** - Stratégie de tests
13. **[13-Arborescence-Projet.md](./13-Arborescence-Projet.md)** - Structure du projet
14. **[14-Checklist-Rapport.md](./14-Checklist-Rapport.md)** - Checklist et rapport de conformité
15. **[15-Prochaines-Etapes.md](./15-Prochaines-Etapes.md)** - Roadmap et prochaines étapes

## Pour commencer

### Pour les nouveaux développeurs
1. Commencer par [01-Introduction.md](./01-Introduction.md) pour comprendre le contexte
2. Lire [02-Architecture-Haut-Niveau.md](./02-Architecture-Haut-Niveau.md) pour la vue d'ensemble
3. Consulter [13-Arborescence-Projet.md](./13-Arborescence-Projet.md) pour la structure du code

### Pour les architectes
1. Étudier [02-Architecture-Haut-Niveau.md](./02-Architecture-Haut-Niveau.md) pour l'architecture système
2. Analyser [04-Composants.md](./04-Composants.md) pour les détails d'implémentation
3. Examiner [05-Modeles-Donnees.md](./05-Modeles-Donnees.md) pour la conception des données

### Pour les DevOps
1. Se concentrer sur [10-Infrastructure-Deploiement.md](./10-Infrastructure-Deploiement.md)
2. Consulter [09-Gestion-Erreurs.md](./09-Gestion-Erreurs.md) pour le monitoring
3. Examiner [12-Strategie-Tests.md](./12-Strategie-Tests.md) pour la CI/CD

### Pour les QA
1. Étudier [12-Strategie-Tests.md](./12-Strategie-Tests.md) pour la stratégie de tests
2. Comprendre [06-Workflows-Principaux.md](./06-Workflows-Principaux.md) pour les flux à tester
3. Consulter [08-Securite.md](./08-Securite.md) pour les tests de sécurité

## Architecture système

### Vue d'ensemble
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Clients MCP  │    │   TwinMCP      │    │   Backend      │
│                 │    │   Server       │    │   Services     │
│ - Cursor       │◄──►│                 │◄──►│                 │
│ - Claude Code  │    │ - stdio/HTTP   │    │ - Auth         │
│ - VS Code      │    │ - Tools        │    │ - Resolution   │
│ - Others       │    │ - Validation   │    │ - Query Engine │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌───────────────▼──────────────────────┐
                    │        Data Layer                 │
                    │                                   │
                    │  ┌──────────────┐  ┌──────────────┐ │
                    │  │ PostgreSQL  │  │ Vector Store │ │
                    │  │ (metadata)  │  │ (embeddings) │ │
                    │  └──────────────┘  └──────────────┘ │
                    │                                   │
                    │  ┌──────────────┐  ┌──────────────┐ │
                    │  │    Redis     │  │  S3/Storage  │ │
                    │  │   (cache)    │  │   (docs)     │ │
                    │  └──────────────┘  └──────────────┘ │
                    └───────────────────────────────────────┘
```

## Principes clés

### 1. Séparation des préoccupations
- **Serveur MCP** : Interface protocol-compliant, légère
- **Backend** : Logique métier, orchestration
- **Data Layer** : Persistence et caching

### 2. Scalabilité
- Architecture stateless pour le serveur MCP
- Cache distribué (Redis) pour réduire la latence
- Queue de jobs pour le crawling asynchrone

### 3. Extensibilité
- Plugin system pour ajouter de nouvelles bibliothèques
- API modulaire pour intégrer de nouveaux IDE/clients

### 4. Résilience
- Rate limiting par tenant
- Circuit breakers sur les services externes
- Fallback sur cache en cas de défaillance

## Technologies principales

### Backend
- **TypeScript** (Node.js 20+) - Typage fort
- **Fastify/Express** - Framework API performant
- **@modelcontextprotocol/sdk** - SDK MCP officiel

### Base de données
- **PostgreSQL 15+** - Métadonnées et relations
- **Pinecone/Qdrant** - Vector store pour embeddings
- **Redis 7+** - Cache et sessions

### Infrastructure
- **Docker** - Containerisation
- **Kubernetes** - Orchestration production
- **GitHub Actions** - CI/CD
- **AWS** - Cloud provider (S3, etc.)

## Contribuer à la documentation

### Guidelines
- Maintenir la documentation à jour avec les changements de code
- Utiliser un langage clair et concis
- Inclure des exemples de code quand approprié
- Suivre le format et la structure établis

### Processus
1. Créer une branche pour les modifications de documentation
2. Mettre à jour les fichiers pertinents
3. Ajouter des diagrammes ou visuels si nécessaire
4. Soumettre une pull request avec "docs:" dans le titre

## Support et contact

### Pour l'assistance technique
- **Documentation API** : Référence complète des endpoints
- **Guides d'installation** : Instructions pas à pas
- **FAQ** : Questions fréquentes et dépannage

### Pour les contributions
- **Architecture decisions** : Enregistrement des décisions importantes
- **RFC process** : Propositions de changements majeurs
- **Code reviews** : Revue par les pairs pour la qualité

---
*Cette documentation est un document vivant qui évoluera avec le projet TwinMCP.*
