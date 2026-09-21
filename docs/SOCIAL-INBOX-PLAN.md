# Plan d'action — Social Inbox (réponses automatiques aux messages clients)

> **Contexte.** Un prospect veut automatiser les réponses aux messages de ses
> clients sur ses réseaux sociaux. Ce document décrit comment l'intégrer dans
> TwinMCP **en tant que fonctionnalité produit** (pas en tant que dev sur mesure),
> avec un accès strictement limité au **client propriétaire** et à **l'admin**.
>
> Statut : proposition. Rien n'est encore implémenté.

---

## 0. Le principe directeur

Ne construis **pas** un projet séparé pour ce client. Construis un module
`Social Inbox` multi-tenant dans le backend existant, dont ce client est le
**locataire n°1**. Trois raisons :

1. Tu réutilises 80 % de l'infra déjà en prod (auth, chiffrement, queue, RAG,
   audit, billing) — voir §2.
2. Le deuxième client ne coûte presque rien.
3. **L'argument de vente différenciant** : le cerveau qui répond est branché sur
   le serveur MCP du client (Shopify, Postgres, Notion… déjà au catalogue). Il ne
   récite pas une FAQ, il **va chercher la vraie donnée**. C'est exactement ce que
   ManyChat / Chatfuel ne savent pas faire, et c'est le cœur de TwinMCP.

Formulé autrement : ce module est la **première application verticale qui
consomme ton propre runtime MCP**. C'est une démo produit qui paie.

---

## 1. Ce que le client demande vraiment — à cadrer avant la première ligne de code

À poser en rendez-vous, dans cet ordre :

| Question | Pourquoi c'est bloquant |
| --- | --- |
| **Quels canaux exactement ?** Instagram DM, Messenger, WhatsApp, commentaires ? | Les commentaires Instagram sont un webhook **différent** des DM. Beaucoup de clients disent « messages » et pensent « commentaires ». |
| **Volume/jour ?** | 20 msg/j = mode assisté suffisant. 2 000 msg/j = il faut l'autopilot + du budget LLM. |
| **Quelles questions reviennent ?** (top 10) | Détermine si une FAQ suffit ou s'il faut brancher un outil métier (commandes, stock, RDV). |
| **L'IA a le droit de dire quoi ?** Prix ? Remboursement ? Délais ? | C'est la clause qui te protège. À écrire noir sur blanc. |
| **Qui valide ?** | Décide entre mode `suggest` (humain valide) et `auto`. Commence **toujours** par `suggest`. |
| **Qui est propriétaire du compte Meta ?** Business Manager existant ? | Sans Business Manager vérifié, rien ne part (§5). |
| **Langues ?** | Impacte le prompt et le coût. |

⚠️ **À dire au client dès le premier rendez-vous** : LinkedIn et TikTok n'ont
**pas** d'API de messagerie ouverte. Ne promets que Meta (Instagram, Messenger,
WhatsApp) + éventuellement Telegram. Mieux vaut le dire maintenant que d'avoir à
le retirer du contrat.

---

## 2. Ce que tu as déjà (et qui fait gagner ~3 semaines)

| Brique nécessaire | Déjà en place | Fichier |
| --- | --- | --- |
| Client Meta Graph API | ✅ WhatsApp Cloud API v21.0 fonctionnel | [whatsapp.ts](../apps/backend/src/lib/whatsapp.ts) |
| Chiffrement des credentials tiers | ✅ AES-256-GCM | [config-encryption.ts](../apps/backend/src/lib/crypto/config-encryption.ts) |
| Queue durable + retries + signature | ✅ QStash | [qstash.ts](../apps/backend/src/lib/queue/qstash.ts), [jobs/run](../apps/backend/src/app/api/jobs/run/route.ts) |
| Vérification de webhook signé (patron) | ✅ Stripe | [webhooks/stripe](../apps/backend/src/app/api/webhooks/stripe/) |
| RAG (pgvector + HNSW + embeddings) | ✅ `libraries` / `documents` / `chunks` + `embed()` | [core.ts](../apps/backend/src/db/schema/core.ts), [openai.ts](../apps/backend/src/lib/openai.ts) |
| Multi-tenant par `userId` + ownership | ✅ | [rbac.ts](../apps/backend/src/lib/auth/rbac.ts) |
| Allowlist admin | ✅ `isAdminEmail()` | [admin.ts](../apps/backend/src/lib/admin.ts) |
| Journal d'audit append-only | ✅ | [audit.ts](../apps/backend/src/lib/audit.ts) |
| Gating par plan | ✅ | [plan-features.ts](../apps/backend/src/lib/plan-features.ts) |
| Runtime MCP par client (les outils métier) | ✅ | [provisioning.ts](../apps/backend/src/lib/provisioning.ts) |
| Timeline / kanban (patron UI réutilisable) | ✅ CRM prospection | [admin/prospects](../apps/backend/src/app/dashboard/admin/prospects/) |

**À construire vraiment** : le schéma inbox, le webhook Meta unifié, le moteur de
réponse, l'UI inbox, les credentials par locataire.

---

## 3. Architecture cible

```
Instagram DM ─┐
Messenger ────┼─► POST /api/webhooks/meta ──► vérif HMAC ──► dedupe (externalId)
WhatsApp ─────┘         (un seul endpoint)         │
                                                   ▼
                                       INSERT social_messages (in)
                                                   │
                                          enqueue QStash
                                       { type: "social-reply" }
                                                   │
                                                   ▼
                                   ┌───────────────────────────┐
                                   │  lib/social/agent.ts      │
                                   │  1. historique conv.      │
                                   │  2. RAG sur la KB client  │
                                   │  3. outils = MCP du client│──► proxy MCP existant
                                   │  4. LLM → {reply, conf.}  │     (Shopify, Postgres…)
                                   └───────────────────────────┘
                                                   │
                                         ┌─────────┴─────────┐
                                    autopilot=auto      autopilot=suggest
                                    & conf ≥ seuil            │
                                    & pas d'escalade          ▼
                                         │             brouillon en base
                                         ▼             → /dashboard/inbox
                                   Graph Send API      (le client valide)
```

**Un seul webhook pour les trois canaux** : Meta envoie Instagram, Messenger et
WhatsApp sur la même app, distingués par le champ `object`
(`instagram` | `page` | `whatsapp_business_account`). C'est le gros raccourci —
tu as déjà l'app Meta pour la prospection WhatsApp.

---

## 4. Détail technique

### 4.1 Schéma — `db/schema/social.ts` + migration `0014_social_inbox.sql`

```
social_channels        un compte social connecté, par locataire
  id, user_id → users(id) ON DELETE CASCADE
  provider               'instagram' | 'messenger' | 'whatsapp' | 'telegram'
  external_id            IG business account id / page id / phone_number_id
  display_name, avatar_url
  cred_ciphertext/iv/tag AES-256-GCM (jamais renvoyé par l'API)
  token_expires_at
  status                 'connected' | 'expired' | 'revoked' | 'error'
  autopilot              'off' | 'suggest' | 'auto'        ← le kill switch
  UNIQUE (provider, external_id)   ← clé de routage du webhook vers le locataire
  INDEX (user_id)

social_conversations
  id, channel_id, user_id (dénormalisé : contrôle d'accès en 1 requête)
  external_thread_id, contact_external_id, contact_name, contact_handle
  status                 'open' | 'pending_human' | 'closed'
  assigned_to            null = le bot
  last_inbound_at        ← pilote la fenêtre 24 h de Meta
  last_message_at, auto_reply_count, unread
  UNIQUE (channel_id, external_thread_id)
  INDEX (user_id, last_message_at DESC)

social_messages
  id, conversation_id ON DELETE CASCADE, user_id
  direction              'in' | 'out'
  external_id            id Meta — UNIQUE  ← idempotence (voir encadré)
  body, attachments jsonb
  author_type            'contact' | 'ai' | 'human'
  status                 'received' | 'draft' | 'queued' | 'sent' | 'failed'
  ai_model, ai_confidence, tokens_in, tokens_out, ai_cost_usd
  error, sent_at, created_at
  INDEX (conversation_id, created_at)

social_playbooks       la configuration IA du locataire
  user_id, channel_id (null = tous les canaux)
  system_prompt, tone, languages[]
  business_hours jsonb, out_of_hours_message
  escalate_keywords[]           'remboursement', 'avocat', 'résilier', 'plainte'
  confidence_threshold          défaut 0.75
  max_auto_replies_per_conv     défaut 3
  signature, fallback_message
  mcp_server_id → servers(id)   le runtime MCP utilisé comme couche outils
  knowledge_library_id → libraries(id)
  support_access_until          §6 — consentement à l'accès support
```

> **⚠️ L'index UNIQUE sur `social_messages.external_id` n'est pas décoratif.**
> Meta **redélivre** un webhook tant qu'il n'a pas reçu de 200, et QStash rejoue
> un job qui a échoué. Sans ce garde-fou, un client reçoit la même réponse 3 fois.
> Le webhook fait `onConflictDoNothing` : conflit → 200 immédiat, on ne fait rien.

**Pour la base de connaissance, ne crée rien de nouveau.** Réutilise
`libraries` / `documents` / `chunks` : une library privée par locataire
(`isPrivate: true`), l'index HNSW pgvector et `embed()` existent déjà et tournent
en prod. Zéro infra RAG à écrire.

### 4.2 Webhook — `app/api/webhooks/meta/route.ts`

- `GET` → handshake Meta : comparer `hub.verify_token` à `META_WEBHOOK_VERIFY_TOKEN`,
  renvoyer `hub.challenge`.
- `POST` → lire le **corps brut** (`await req.text()`) **avant** tout parsing,
  vérifier `X-Hub-Signature-256` = HMAC-SHA256(body, `META_APP_SECRET`) en
  comparaison *timing-safe*. Même patron que la vérification de signature dans
  [jobs/run](../apps/backend/src/app/api/jobs/run/route.ts).
- Normaliser les 3 formats Meta vers une forme unique `InboundMessage`.
- Router vers le locataire via `(provider, external_id)`.
- Insérer, `enqueue`, **répondre 200 en moins de 5 s**. Au-delà, Meta retente puis
  finit par désabonner l'app. Aucun appel LLM dans le webhook — jamais.

### 4.3 Le job

Deux fichiers à modifier **ensemble** (le commentaire en tête de
`app/api/jobs/run/route.ts` le rappelle déjà : un oubli = job rejeté en 400,
donc jamais retenté, donc silencieusement perdu **en prod uniquement**) :

1. `lib/queue/qstash.ts` → ajouter `{ type: "social-reply"; messageId: string }`
   à l'union `Job` + le `case` dans `runJob`.
2. `app/api/jobs/run/route.ts` → ajouter la variante au `jobSchema` zod.

### 4.4 Moteur de réponse — `lib/social/agent.ts`

1. Charger la conversation + les N derniers messages.
2. Charger le playbook.
3. RAG : `embed(question)` → recherche cosinus sur les `chunks` du locataire.
4. Outils : lister les tools du serveur MCP du client via le proxy existant.
5. Appel LLM en sortie structurée : `{ reply, confidence, intent, needs_human }`.
6. Décider :

| autopilot | escalade détectée | confiance | hors fenêtre 24 h | Action |
| --- | --- | --- | --- | --- |
| `off` | — | — | — | rien (log seulement) |
| `suggest` | — | — | — | brouillon + notification |
| `auto` | oui | — | — | `pending_human` + notification |
| `auto` | non | < seuil | — | brouillon + notification |
| `auto` | non | ≥ seuil | oui | template approuvé, sinon brouillon |
| `auto` | non | ≥ seuil | non | **envoi** |

Arrêts durs, quel que soit le mode : mot-clé d'escalade, `auto_reply_count ≥ max`,
contact ayant répondu STOP, canal `status != 'connected'`.

**Modèle** : `claude-sonnet-5` pour la rédaction (bon rapport qualité/latence sur
du dialogue court multilingue), `claude-haiku-4-5-20251001` pour la classification
d'intention et la détection d'escalade — c'est un appel par message entrant, il
doit être quasi gratuit. Garde `text-embedding-3-small` d'OpenAI pour les
embeddings : l'index HNSW en prod est en 1536 dimensions, en changer imposerait
de tout réindexer.

### 4.5 Envoi — `lib/social/send.ts`

Les trois canaux passent par Graph API avec des payloads voisins → un seul
helper `graphPost()`. **Refactor nécessaire** : `lib/whatsapp.ts` lit aujourd'hui
`WHATSAPP_ACCESS_TOKEN` dans l'environnement. Il faut le transformer pour
**recevoir les credentials en argument**, afin qu'il serve à la fois la
prospection admin (token global, ton numéro) et l'inbox (token du locataire).
La fonction `normalizePhone()` reste telle quelle.

### 4.6 UI — `/dashboard/inbox`

- **Liste** de conversations (filtres : tout / à valider / escaladées / fermées)
  + **fil** + **composeur pré-rempli avec le brouillon IA** : `Envoyer`,
  `Éditer`, `Régénérer`, `Prendre la main`.
- `/dashboard/inbox/settings` : canaux, playbook, base de connaissance,
  et un **interrupteur autopilot bien visible**.
- v1 : polling toutes les 5 s. Supabase Realtime plus tard si le volume le justifie.
- Réutilise `components/ui/*` (Radix déjà installé), `sonner` pour les toasts,
  `components/dashboard/empty-state.tsx`, et le patron de
  [timeline-dialog.tsx](../apps/backend/src/app/dashboard/admin/prospects/timeline-dialog.tsx).

---

## 5. Le vrai chemin critique : Meta (à lancer **le jour 1**)

C'est ici que les projets dérapent — pas dans le code.

1. **Vérification entreprise** du Business Manager (Kbis/SIREN). Plusieurs jours.
2. **App Review** pour l'accès avancé, une soumission avec screencast par lot :
   - Instagram : `instagram_business_manage_messages`
   - Messenger : `pages_messaging`, `pages_manage_metadata`
   - WhatsApp : `whatsapp_business_messaging`, `whatsapp_business_management`

   Compter **1 à 3 semaines**, refus possible en première passe.
3. **Instagram** : le compte doit être **professionnel**, **rattaché à une Page
   Facebook**, et l'option « Autoriser l'accès aux messages » activée dans
   l'application Instagram. C'est le point de blocage le plus fréquent.
4. **Fenêtre de 24 h**, sur les trois canaux. Au-delà du dernier message du
   contact : WhatsApp → template approuvé uniquement ; Messenger/Instagram →
   tag `HUMAN_AGENT` (7 jours, soumis à approbation).
5. **Credentials par locataire** — décision structurante :
   - **Voie rapide (recommandée pour le client n°1)** : le client génère son
     propre token système et le colle dans le dashboard → chiffré en base. Zéro
     dépendance à un statut partenaire, opérationnel immédiatement.
   - **Voie industrielle (avant le client n°3)** : Facebook Login for Business +
     WhatsApp Embedded Signup, tokens émis et rafraîchis automatiquement.
     Nécessite le statut *Tech Provider*.

> **Plan B pendant l'attente Meta** : brancher **Telegram** (Bot API, aucune
> revue, une journée de dev). Ça te donne une démo fonctionnelle bout-en-bout à
> montrer au client pendant que l'App Review avance. Excellent pour la confiance.

---

## 6. Accès : « seulement le client et l'admin »

C'est la contrainte la plus sensible du projet — il ne s'agit pas des données du
client, mais de celles **de ses clients à lui** (conversations privées de tiers).

**Quatre couches, toutes côté serveur :**

1. **Propriété.** Chaque ligne porte `user_id`. Un helper
   `lib/social/rbac.ts → assertConversationAccess(session, id)` renvoie
   `{ row, via: 'owner' | 'admin' }`, sur le modèle de
   [rbac.ts](../apps/backend/src/lib/auth/rbac.ts). Aucune route n'y échappe.
2. **Admin tracé.** `isAdminEmail()` ouvre l'accès, **mais chaque lecture ou
   envoi par un admin sur l'inbox d'un tiers écrit une ligne d'audit.** Ajouter
   à [audit.ts](../apps/backend/src/lib/audit.ts) : actions `social.admin_read` /
   `social.admin_send`, cible `social_conversation`. Sans ça, tu as un accès non
   journalisé à des données personnelles de tiers — indéfendable en cas de
   contrôle, et c'est le premier point que soulèvera le DPO du client.
3. **Consentement au support (recommandé, à mettre au contrat).** Champ
   `support_access_until` sur le playbook : l'admin ne peut ouvrir l'inbox d'un
   locataire que si celui-ci a activé « autoriser le support » (avec expiration
   automatique). Tu passes d'un « on peut tout lire » à un « on peut lire quand
   vous nous le demandez ».
4. **Gating par plan.** Ajouter `socialInbox: boolean` à `PlanCapabilities`
   (`team` uniquement), ou mieux : un add-on Stripe dédié. ⚠️ Le fichier
   [plan-features.ts](../apps/backend/src/lib/plan-features.ts) le dit lui-même en
   commentaire — **déclarer la capacité ne protège rien**, il faut appeler
   l'assertion dans chaque route.

Le lien de navigation est masqué sans la capacité, mais comme pour `isAdmin`
dans [layout.tsx](../apps/backend/src/app/dashboard/layout.tsx), **le masquage n'est
jamais la protection** : la page et l'API sont gardées côté serveur.

**RGPD** : le client est responsable de traitement, tu es sous-traitant → il faut
un **DPA signé**, la liste des sous-traitants ultérieurs (Anthropic, OpenAI,
Meta, Upstash, ton VPS), une durée de conservation des conversations (propose
12 mois avec purge automatique) et une procédure d'effacement. Ce n'est pas
optionnel sur des DM de particuliers.

---

## 7. Phasage

| Phase | Durée | Contenu | Livrable démontrable |
| --- | --- | --- | --- |
| **0 — Cadrage** | 2–3 j | §1 + devis + DPA + démarrage App Review Meta | Contrat signé, dossier Meta déposé |
| **1 — Socle** | 1 sem. | Schéma + migration, webhook unifié, dedupe, job stub, inbox **lecture seule** | « Vos DM Instagram arrivent dans TwinMCP en temps réel » |
| **2 — Réponse assistée** | 1 sem. | KB + RAG, génération de brouillon, mode `suggest`, envoi manuel | Le client valide chaque réponse d'un clic. **Risque nul.** |
| **3 — Autopilot encadré** | 1 sem. | Mode `auto`, seuil, escalade, compteur, horaires, kill switch | Auto sur **un seul canal et une seule intention** (horaires/adresse/tarifs) |
| **4 — Outils métier MCP** | 1–2 sem. | Serveur MCP du client branché comme couche outils | « Où est ma commande ? » → vraie réponse. **Ton avantage décisif.** |
| **5 — Industrialisation** | — | Embedded Signup, self-serve, facturation à la conversation, analytics | Client n°2 sans dev |

**Ne saute jamais la phase 2.** Deux à trois semaines en mode `suggest`
produisent le corpus de messages validés qui permet de régler le prompt et le
seuil de confiance avant de laisser l'IA parler seule. Un client qui voit un
mauvais message partir à *son* client ne revient pas.

---

## 8. Risques

| Risque | Impact | Mitigation |
| --- | --- | --- |
| App Review Meta refusée/lente | Bloque tout | Démarrer jour 1 ; Telegram en plan B pour la démo |
| L'IA répond une bêtise à un vrai client | Réputation, contrat | Phase 2 obligatoire, seuil de confiance, mots-clés d'escalade, plafond de réponses auto/conversation |
| Double envoi (redélivrance Meta / retry QStash) | Le contact reçoit 3 fois la même réponse | `UNIQUE(external_id)` + `onConflictDoNothing` |
| Fuite inter-locataires | Critique | `user_id` sur chaque table, assertion dans chaque route, tests dédiés |
| Coût LLM non maîtrisé | Marge | Haiku pour classer / Sonnet pour rédiger, plafond de tokens, coût stocké par message, quota mensuel |
| Token du client expiré | Panne silencieuse | `token_expires_at` + job de contrôle + email d'alerte + statut `expired` visible |
| Le client demande LinkedIn/TikTok | Promesse intenable | Le dire dès le RDV 1 (§1) |
| État en mémoire vs plusieurs conteneurs | Bug fantôme | La prod tourne **un seul conteneur** — garder l'état de l'inbox **en base**, contrairement au relais local-agent |

---

## 9. Décisions à trancher (avec ma recommandation)

1. **Module produit ou dev sur mesure ?** → **Module produit**, ce client en est
   le locataire n°1. Aucune branche « client spécial » dans le code.
2. **Canal de départ ?** → **Instagram DM** si c'est là qu'est son volume, sinon
   WhatsApp (tu as déjà le pipeline). **Un seul canal en phase 1.**
3. **Credentials ?** → Token système collé par le client (voie rapide), Embedded
   Signup plus tard.
4. **Modèle ?** → `claude-sonnet-5` pour rédiger, `claude-haiku-4-5-20251001`
   pour classer, embeddings OpenAI inchangés.
5. **Plan ?** → Add-on facturé séparément plutôt que le plan `team` : ce module a
   un coût variable (LLM + messages), il ne doit pas être noyé dans un forfait.
6. **Accès admin ?** → Autorisé **et journalisé**, avec consentement expirable
   au contrat.
7. **Conservation ?** → 12 mois, purge automatique, mentionnée au DPA.

---

## 10. Modèle économique (ordre de grandeur)

Trois lignes, parce que tes coûts sont de trois natures :

- **Mise en service** (une fois) : connexion des canaux, construction de la base
  de connaissance, réglage du playbook, accompagnement de la phase 2. C'est du
  temps humain, il se facture comme tel.
- **Abonnement mensuel** : hébergement, runtime MCP, support, quota de
  conversations inclus.
- **Au-delà du quota** : par conversation traitée (pas par message — le client
  comprend « une conversation », pas « un token »).

Deux points à ne pas négliger : le coût LLM est **variable et réel** (mets un
plafond mensuel par locataire, avec alerte), et la valeur vendue n'est pas
« l'IA » mais **les heures de réponse économisées** — chiffre-la avec le client
en RDV 1, elle justifie le prix bien mieux que la technique.

---

## 11. Première semaine, concrètement

- [ ] RDV de cadrage — les questions du §1, y compris DM **vs** commentaires
- [ ] Déposer la vérification entreprise Meta + démarrer l'App Review (§5)
- [ ] Rédiger le devis + le DPA
- [ ] `db/schema/social.ts` + migration `0014_social_inbox.sql`
- [ ] `app/api/webhooks/meta/route.ts` — handshake + HMAC + dedupe + enqueue
- [ ] Étendre `Job` dans `lib/queue/qstash.ts` **et** `jobSchema` dans `app/api/jobs/run/route.ts`
- [ ] `lib/social/rbac.ts` + les actions d'audit `social.admin_read` / `social.admin_send`
- [ ] `/dashboard/inbox` en lecture seule
- [ ] Bot Telegram en plan B pour démontrer la boucle complète avant l'accord Meta
- [ ] ⚠️ Rappel indépendant : le secret `DATABASE_URL_UNPOOLED` reste absent de
      GitHub Actions — la migration `0014` ne s'appliquera pas toute seule au
      déploiement (voir `TODO.md`).

---

## 12. Variables d'environnement à ajouter

```env
# --- Social Inbox (Meta) ---
META_APP_ID=xxx
META_APP_SECRET=xxx                  # signature X-Hub-Signature-256 des webhooks
META_WEBHOOK_VERIFY_TOKEN=xxx        # chaîne aléatoire, à recopier côté Meta
META_API_VERSION=v21.0               # partagé avec WHATSAPP_API_VERSION

# --- Moteur de réponse ---
ANTHROPIC_API_KEY=sk-ant-xxx
SOCIAL_REPLY_MODEL=claude-sonnet-5
SOCIAL_CLASSIFY_MODEL=claude-haiku-4-5-20251001
SOCIAL_MONTHLY_TOKEN_CAP=            # plafond par locataire (garde-fou de marge)

# --- Gouvernance ---
SOCIAL_SUPPORT_REQUIRES_CONSENT=1    # l'admin n'ouvre une inbox qu'avec accord
SOCIAL_RETENTION_DAYS=365
```
