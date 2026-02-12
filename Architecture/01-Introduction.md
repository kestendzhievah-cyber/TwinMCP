# Introduction

## Contexte du projet

TwinMCP est un serveur MCP (Model Context Protocol) conçu pour fournir aux IDE et LLM des extraits de documentation et de code toujours à jour pour n'importe quelle bibliothèque logicielle.

## Objectifs

- **Reproduire les fonctionnalités de Context7** : offrir une alternative open-source et extensible
- **Support multi-bibliothèques** : Node.js, Python, TypeScript, et autres écosystèques
- **Intégration IDE** : Cursor, Claude Code, Opencode et autres clients MCP
- **Architecture SaaS** : multi-tenant avec authentification et quotas
- **Documentation à jour** : crawling automatique et versioning des bibliothèques

## Périmètre

### Inclus
- Serveur MCP avec protocole stdio et HTTP
- API backend pour gestion des comptes et rate-limiting
- Moteur de parsing et crawling de documentation
- Dashboard utilisateur
- Support OAuth 2.0 et API key

### Exclus (Phase 1)
- Interface de contribution collaborative
- Support des bibliothèques propriétaires privées
- Intégration CI/CD avancée

## Parties prenantes

- **Utilisateurs finaux** : Développeurs utilisant des IDE compatibles MCP
- **Administrateurs** : Équipe DevOps gérant l'infrastructure
- **Contributeurs** : Développeurs ajoutant le support de nouvelles bibliothèques
