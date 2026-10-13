# ⚠️ ARCHIVE — NE JAMAIS PUBLIER

Ce dossier contient l'ancien site de documentation Mintlify **hérité du fork Context7**
(archivé le 2026-10-13). Il décrit **un autre produit** (Context7 — « up-to-date code
docs for any prompt ») et contient des affirmations **fausses pour TwinMCP** :

- « built by Upstash… backed by a16z » (usurpation d'identité d'Upstash)
- « SOC 2 Type II », « ISO 27001 in progress » (certifications inexistantes)
- SSO/SAML, déploiement on-premise Kubernetes (fonctionnalités inexistantes)
- domaine `twinmcp.com`, contacts `@upstash.com`, repo `upstash/twinmcp` (erronés)
- un paquet npm `@upstash/twinmcp-mcp` et des endpoints API qui n'existent pas

**Ne pas déployer `docs.json` sur Mintlify. Ne pas citer ces pages à un client.**

La vraie documentation client vit dans l'app : `apps/backend/src/app/docs/page.tsx`
(+ `/docs/api-reference`, généré depuis `apps/backend/src/lib/openapi/spec.ts`).

Conservé uniquement comme référence de structure (navigation Mintlify, format des
pages clients/intégrations) si un vrai site de docs est construit un jour.
Supprimer entièrement ce dossier est une option parfaitement acceptable.
