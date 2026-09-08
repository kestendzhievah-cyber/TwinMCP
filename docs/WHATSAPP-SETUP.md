# Prospection WhatsApp — configuration (Meta Cloud API)

Le CRM peut envoyer un message d'introduction WhatsApp **personnalisé** à un
prospect (bouton **WhatsApp** dans `/dashboard/admin/prospects`). L'envoi passe
par l'**API WhatsApp Business Cloud** de Meta. Ce guide te fait passer de zéro à
« ça envoie ».

> ⚠️ **À lire d'abord.** La prospection WhatsApp à froid n'est possible qu'avec un
> **modèle (template) approuvé par Meta** — le texte libre est interdit tant que
> la personne ne t'a pas écrit en premier. Même bien fait, envoyer à des gens qui
> n'ont rien demandé peut entraîner des signalements → **bannissement du numéro**.
> Envoie **un contact à la fois**, ciblé et pertinent. Jamais de masse.

## 1. Compte Meta + app

1. Va sur <https://developers.facebook.com/> → **Mes apps** → **Créer une app** →
   type **Entreprise**.
2. Dans l'app, ajoute le produit **WhatsApp**.
3. Tu obtiens un **numéro de test** gratuit (pour valider), et un
   **Phone Number ID** (ID du numéro). Note-le → variable `WHATSAPP_PHONE_NUMBER_ID`.
   Pour la prod, ajoute ton **vrai numéro business** (il ne doit pas déjà être sur
   WhatsApp perso/Business App).

## 2. Créer le modèle de message

WhatsApp Manager → **Modèles de message** → **Créer un modèle** :

- **Catégorie** : Marketing
- **Nom** : `prospection_intro` (doit correspondre à `WHATSAPP_TEMPLATE_NAME`)
- **Langue** : Français (`fr`)
- **Corps** (copie-colle exactement — 2 variables) :

  ```
  Bonjour {{1}}, je suis le fondateur de TwinMCP. Nous aidons {{2}} à connecter leurs assistants IA (comme ChatGPT ou Claude) à leurs outils internes, en toute sécurité. Seriez-vous ouvert(e) à un échange de 15 min pour en discuter ? Répondez STOP pour ne plus être contacté.
  ```

- **Exemples de valeurs** (demandés à la soumission) : `{{1}}` = `Marie`,
  `{{2}}` = `Acme SAS`.
- Soumets → approbation Meta (quelques minutes à 24 h).

> Le code remplit `{{1}}` avec le prénom du contact (ou « à vous » s'il est
> inconnu) et `{{2}}` avec l'entreprise. C'est ce qui rend le message personnalisé.

## 3. Jeton d'accès

- **Test** : l'onglet WhatsApp de l'app fournit un **token temporaire (24 h)** —
  suffisant pour un premier essai.
- **Production (permanent)** : Business Settings → **Utilisateurs système** → crée
  un system user → assigne le WhatsApp Business Account → **Générer un token** avec
  les permissions `whatsapp_business_messaging` + `whatsapp_business_management`.
  → variable `WHATSAPP_ACCESS_TOKEN`.

## 4. Variables d'environnement (Dokploy)

| Variable                   | Obligatoire | Défaut               | Rôle                                |
| -------------------------- | ----------- | -------------------- | ----------------------------------- |
| `WHATSAPP_PHONE_NUMBER_ID` | ✅          | —                    | ID du numéro expéditeur (étape 1)   |
| `WHATSAPP_ACCESS_TOKEN`    | ✅          | —                    | Jeton d'accès (étape 3)             |
| `WHATSAPP_TEMPLATE_NAME`   | ❌          | `prospection_intro`  | Nom du modèle approuvé              |
| `WHATSAPP_TEMPLATE_LANG`   | ❌          | `fr`                 | Code langue du modèle               |
| `WHATSAPP_API_VERSION`     | ❌          | `v21.0`              | Version de l'API Graph              |

Ajoute-les dans Dokploy → l'app → Environment, puis redéploie. Tant que les deux
obligatoires sont absentes, l'API renvoie proprement `503 WhatsApp non configuré`.

## 5. Tester

1. Avec un **numéro de test** Meta, ajoute d'abord ton propre numéro dans la liste
   des **destinataires autorisés** (onglet WhatsApp de l'app).
2. Dans le CRM : bouton **WhatsApp** → colle un numéro (+ entreprise) → **Créer +
   envoyer**. Le prospect est créé, le message part, et l'envoi apparaît dans sa
   **timeline** (icône WhatsApp).
3. Sur un prospect existant qui a un numéro : icône WhatsApp dans la colonne
   **Actions**.

## Format des numéros

Peu importe la mise en forme (`+33 6 12 34 56 78`, `06 12 34 56 78`, `0033…`) : le
serveur normalise en chiffres internationaux. Un numéro français à 10 chiffres
commençant par `0` est automatiquement préfixé `33`.
