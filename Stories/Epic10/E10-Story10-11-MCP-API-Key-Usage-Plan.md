# E10-Story10-11-MCP-API-Key-Usage-Plan.md

## Epic 10: Déploiement & Production

### Story 10.11: Authentification MCP par clé API + crédit d'usage + plan utilisateur

**Description**: Permettre au LLM d’envoyer des requêtes vers le serveur MCP en fournissant une clé API, afin d’identifier l’utilisateur, créditer l’usage (tokens/requests), et détecter son plan (gratuit ou payant) pour appliquer les quotas et politiques.

---

## Objectif

Mettre en place un flux end-to-end où :
1. Le LLM envoie une requête MCP (tools/list, execute, etc.) avec une clé API.
2. Le serveur MCP valide la clé, identifie l’utilisateur et son plan.
3. L’usage est comptabilisé (requests/tokens) et crédité sur le compte.
4. Les quotas/limites sont appliqués selon le plan (gratuit vs payant).

---

## Contexte & dépendances

- S’appuyer sur **Story 3.2 — Service d’authentification API Keys** (validation, quotas, tracking).
- API MCP existante : endpoints `/api/v1/mcp/*`.
- Modèle de plan : au minimum `free` et `paid` (ou `basic/premium` existants si déjà définis).

---

## Portée

**Inclus**
- Authentification MCP via clé API (header `X-API-Key` ou `Authorization: Bearer`).
- Détection du plan utilisateur et du tier (free vs payant).
- Comptabilisation d’usage (requests/tokens) par requête MCP.
- Réponses adaptées (quota dépassé, plan invalide, clé inactive).

**Exclus**
- UI de gestion des clés API (déjà couverte ailleurs).
- Refactor massif du backend (doit rester minimal).

---

## Spécifications fonctionnelles

1. **Identification par clé API**
   - Le serveur MCP accepte `X-API-Key` ou `Authorization: Bearer <key>`.
   - La clé est validée via le service API key.
   - Le serveur associe la clé à un utilisateur et à un plan.

2. **Détection du plan**
   - Si la clé est liée à un plan `free`, appliquer les quotas “free”.
   - Si la clé est liée à un plan payant, appliquer les quotas “paid/premium/etc.”.
   - Retourner des erreurs explicites si plan inconnu ou inactif.

3. **Crédit d’usage**
   - Chaque requête MCP incrémente :
     - compteur de requêtes,
     - compteur de tokens estimés (request/response).
   - Stockage : base + cache (si Redis est en place).

4. **Gestion des erreurs**
   - 401 si clé absente/invalide/inactive.
   - 429 si quota dépassé (inclure `quota_info`).

---

## Spécifications techniques (proposition)

### Points d’intégration MCP
- Middleware de validation et tracking attaché aux routes `/api/v1/mcp/*`.
- Estimation tokens : simple (taille payload + réponse / 4) ou usage réel si disponible.

### Modèle minimal de plan
- `free` vs `paid` (ou `basic/premium/enterprise` si déjà en base).
- Mapping vers quotas via config centralisée.

---

## Tâches détaillées

1. **Middleware API Key pour MCP**
   - Extraire la clé API des headers.
   - Valider via `APIKeyService`.
   - Injecter `request.apiKey` + `request.plan`.

2. **Validation plan & quotas**
   - Vérifier le plan et la tier.
   - Bloquer la requête si quota dépassé.

3. **Tracking & crédit d’usage**
   - Incrémenter `requests_count` et `tokens_used`.
   - Mettre à jour `last_used_at`.

4. **Tests**
   - Test MCP valid key → 200.
   - Test MCP invalid key → 401.
   - Test quota dépassé → 429.

---

## Critères de succès

- [ ] Les requêtes MCP acceptent `X-API-Key` et `Authorization: Bearer`.
- [ ] L’utilisateur est identifié et le plan est détecté.
- [ ] L’usage est crédité (requests/tokens).
- [ ] Les quotas sont appliqués selon le plan.
- [ ] Tests de non-régression présents.

---

## Notes

- S’appuyer sur la Story 3.2 pour éviter duplication.
- Garder un impact minimal sur le reste du système MCP.
