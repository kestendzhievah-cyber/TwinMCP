# Outils MCP — Architecture Technique

## 1. Vue d'ensemble

La fonctionnalité **Outils MCP** remplace l'ancienne section "Serveurs MCP Externes" par un catalogue de 146 intégrations MCP pré-configurées, accessibles exclusivement aux utilisateurs du **plan Pro** (14,99€/mois).

Les utilisateurs gratuits peuvent consulter le catalogue mais ne peuvent pas activer d'outils.

## 2. Catalogue des 146 outils

| # | ID | Nom | Provider | Catégorie | API Key requise |
|---|-----|------|----------|-----------|-----------------|
| 1 | `brave-search` | Brave Search | Brave | Recherche | ✅ |
| 2 | `perplexity` | Perplexity | Perplexity AI | Recherche | ✅ |
| 3 | `arxiv` | ArXiv | jasonleinart | Recherche | ❌ |
| 4 | `github` | GitHub | GitHub | Développement | ✅ |
| 5 | `playwright` | Playwright | Microsoft | Développement | ❌ |
| 6 | `desktop-commander` | Desktop Commander | wonderwhy-er | Développement | ❌ |
| 7 | `context7` | Context7 | Upstash | Développement | ❌ |
| 8 | `docker-hub` | Docker Hub | Docker | Développement | ✅ |
| 9 | `arm` | Arm | Arm | Développement | ❌ |
| 10 | `mongodb` | MongoDB | MongoDB | Base de données | ✅ |
| 11 | `couchbase` | Couchbase | Couchbase Ecosystem | Base de données | ✅ |
| 12 | `elasticsearch` | Elasticsearch | Elastic | Base de données | ✅ |
| 13 | `neon` | Neon | Neon Database | Base de données | ✅ |
| 14 | `amazon-neptune` | Amazon Neptune | AWS | Base de données | ✅ |
| 15 | `aws-core` | AWS Core | AWS Labs | Cloud & Infra | ✅ |
| 16 | `azure-aks` | Azure Kubernetes (AKS) | Microsoft Azure | Cloud & Infra | ✅ |
| 17 | `heroku` | Heroku | Heroku | Cloud & Infra | ✅ |
| 18 | `aws-bedrock` | AWS Bedrock AgentCore | AWS | Cloud & Infra | ✅ |
| 19 | `notion` | Notion | Notion | Productivité | ✅ |
| 20 | `airtable` | Airtable | domdomegg | Productivité | ✅ |
| 21 | `stripe` | Stripe | Stripe | Productivité | ✅ |
| 22 | `amazon-kendra` | Amazon Kendra Index | AWS | IA & ML | ✅ |
| 23 | `amazon-q-business` | Amazon Q Business | AWS | IA & ML | ✅ |
| 24 | `grafana` | Grafana | Grafana | Monitoring | ✅ |
| 25 | `apify` | Apify | Apify | Données | ✅ |
| 26 | `ais-fleet` | AIS Fleet | AIS Fleet | Données | ✅ |
| 27 | `slack` | Slack | Model Context Protocol | Productivité | ✅ |
| 28 | `google-maps` | Google Maps | Model Context Protocol | Données | ✅ |
| 29 | `sentry` | Sentry | Sentry | Monitoring | ✅ |
| 30 | `cloudflare` | Cloudflare | Cloudflare | Cloud & Infra | ✅ |
| 31 | `supabase` | Supabase | Supabase | Base de données | ✅ |
| 32 | `firebase` | Firebase | gannonh | Base de données | ✅ |
| 33 | `linear` | Linear | jerhadf | Productivité | ✅ |
| 34 | `figma` | Figma | Figma | Productivité | ✅ |
| 35 | `vercel` | Vercel | Vercel | Cloud & Infra | ✅ |
| 36 | `postman` | Postman | Postman Labs | Développement | ✅ |
| 37 | `redis` | Redis | Model Context Protocol | Base de données | ✅ |
| 38 | `prisma` | Prisma | Prisma | Base de données | ✅ |
| 39 | `twilio` | Twilio | Twilio | Productivité | ✅ |
| 40 | `jira` | Jira | Atlassian | Productivité | ✅ |
| 41 | `confluence` | Confluence | Atlassian | Productivité | ✅ |
| 42 | `datadog` | Datadog | Datadog | Monitoring | ✅ |
| 43 | `pagerduty` | PagerDuty | PagerDuty | Monitoring | ✅ |
| 44 | `pinecone` | Pinecone | Pinecone | IA & ML | ✅ |
| 45 | `turbopuffer` | Turbopuffer | Turbopuffer | IA & ML | ✅ |
| 46 | `gitlab` | GitLab | GitLab | Développement | ✅ |
| 47 | `shopify` | Shopify | Shopify | Productivité | ✅ |
| 48 | `snowflake` | Snowflake | Snowflake | Données | ✅ |
| 49 | `bigquery` | Google BigQuery | Google Cloud | Données | ✅ |
| 50 | `discord` | Discord | Discord | Productivité | ✅ |
| 51 | `terraform` | Terraform | HashiCorp | Cloud & Infra | ✅ |
| 52 | `kubernetes` | Kubernetes | Model Context Protocol | Cloud & Infra | ✅ |
| 53 | `sendgrid` | SendGrid | Twilio SendGrid | Productivité | ✅ |
| 54 | `hubspot` | HubSpot | HubSpot | Productivité | ✅ |
| 55 | `zendesk` | Zendesk | Zendesk | Productivité | ✅ |
| 56 | `asana` | Asana | Asana | Productivité | ✅ |
| 57 | `openai` | OpenAI | OpenAI | IA & ML | ✅ |
| 58 | `anthropic` | Anthropic | Anthropic | IA & ML | ✅ |
| 59 | `huggingface` | Hugging Face | Hugging Face | IA & ML | ✅ |
| 60 | `weaviate` | Weaviate | Weaviate | IA & ML | ✅ |
| 61 | `bitbucket` | Bitbucket | Atlassian | Développement | ✅ |
| 62 | `circleci` | CircleCI | CircleCI | Développement | ✅ |
| 63 | `npm` | npm | npm | Développement | ❌ |
| 64 | `dynamodb` | Amazon DynamoDB | AWS | Base de données | ✅ |
| 65 | `cockroachdb` | CockroachDB | Cockroach Labs | Base de données | ✅ |
| 66 | `clickhouse` | ClickHouse | ClickHouse | Base de données | ✅ |
| 67 | `digitalocean` | DigitalOcean | DigitalOcean | Cloud & Infra | ✅ |
| 68 | `flyio` | Fly.io | Fly.io | Cloud & Infra | ✅ |
| 69 | `google-drive` | Google Drive | Model Context Protocol | Productivité | ✅ |
| 70 | `dropbox` | Dropbox | Dropbox | Productivité | ✅ |
| 71 | `microsoft-teams` | Microsoft Teams | Microsoft | Productivité | ✅ |
| 72 | `salesforce` | Salesforce | Salesforce | Productivité | ✅ |
| 73 | `mailchimp` | Mailchimp | Mailchimp | Productivité | ✅ |
| 74 | `newrelic` | New Relic | New Relic | Monitoring | ✅ |
| 75 | `kaggle` | Kaggle | Google | Données | ✅ |
| 76 | `tableau` | Tableau | Salesforce | Données | ✅ |
| 77 | `snyk` | Snyk | Snyk | Développement | ✅ |
| 78 | `sonarqube` | SonarQube | SonarSource | Développement | ✅ |
| 79 | `raycast` | Raycast | Raycast | Développement | ✅ |
| 80 | `cursor` | Cursor | Cursor | Développement | ❌ |
| 81 | `tidb` | TiDB | PingCAP | Base de données | ✅ |
| 82 | `fauna` | Fauna | Fauna | Base de données | ✅ |
| 83 | `upstash` | Upstash | Upstash | Base de données | ✅ |
| 84 | `pulumi` | Pulumi | Pulumi | Cloud & Infra | ✅ |
| 85 | `render` | Render | Render | Cloud & Infra | ✅ |
| 86 | `railway` | Railway | Railway | Cloud & Infra | ✅ |
| 87 | `trello` | Trello | Atlassian | Productivité | ✅ |
| 88 | `monday` | Monday.com | Monday.com | Productivité | ✅ |
| 89 | `intercom` | Intercom | Intercom | Productivité | ✅ |
| 90 | `calendly` | Calendly | Calendly | Productivité | ✅ |
| 91 | `replicate` | Replicate | Replicate | IA & ML | ✅ |
| 92 | `cohere` | Cohere | Cohere | IA & ML | ✅ |
| 93 | `mistral` | Mistral AI | Mistral AI | IA & ML | ✅ |
| 94 | `segment` | Segment | Twilio Segment | Données | ✅ |
| 95 | `airbyte` | Airbyte | Airbyte | Données | ✅ |
| 96 | `dbt` | dbt | dbt Labs | Données | ✅ |
| 97 | `twitch` | Twitch | Twitch | Productivité | ✅ |
| 98 | `spotify` | Spotify | Spotify | Productivité | ✅ |
| 99 | `youtube` | YouTube | Google | Données | ✅ |
| 100 | `whatsapp` | WhatsApp Business | Meta | Productivité | ✅ |
| 101 | `telegram` | Telegram | Telegram | Productivité | ✅ |
| 102 | `zoom` | Zoom | Zoom | Productivité | ✅ |
| 103 | `gitkraken` | GitKraken | GitKraken | Développement | ✅ |
| 104 | `jenkins` | Jenkins | Jenkins | Développement | ✅ |
| 105 | `travisci` | Travis CI | Travis CI | Développement | ✅ |
| 106 | `github-actions` | GitHub Actions | GitHub | Développement | ✅ |
| 107 | `aws-lambda` | AWS Lambda | AWS | Cloud & Infra | ✅ |
| 108 | `google-cloud-run` | Google Cloud Run | Google Cloud | Cloud & Infra | ✅ |
| 109 | `azure-functions` | Azure Functions | Microsoft Azure | Cloud & Infra | ✅ |
| 110 | `ovhcloud` | OVHcloud | OVHcloud | Cloud & Infra | ✅ |
| 111 | `linode` | Linode (Akamai) | Akamai | Cloud & Infra | ✅ |
| 112 | `mysql` | MySQL | Model Context Protocol | Base de données | ✅ |
| 113 | `postgres` | PostgreSQL | Model Context Protocol | Base de données | ✅ |
| 114 | `sqlite` | SQLite | Model Context Protocol | Base de données | ❌ |
| 115 | `mariadb` | MariaDB | MariaDB | Base de données | ✅ |
| 116 | `neo4j` | Neo4j | Neo4j | Base de données | ✅ |
| 117 | `qdrant` | Qdrant | Qdrant | IA & ML | ✅ |
| 118 | `chroma` | Chroma | Chroma | IA & ML | ❌ |
| 119 | `milvus` | Milvus | Zilliz | IA & ML | ✅ |
| 120 | `langchain` | LangChain | LangChain | IA & ML | ❌ |
| 121 | `llamaindex` | LlamaIndex | LlamaIndex | IA & ML | ❌ |
| 122 | `vault` | HashiCorp Vault | HashiCorp | Cloud & Infra | ✅ |
| 123 | `consul` | HashiCorp Consul | HashiCorp | Cloud & Infra | ✅ |
| 124 | `packer` | HashiCorp Packer | HashiCorp | Cloud & Infra | ❌ |
| 125 | `ansible` | Ansible | Red Hat | Cloud & Infra | ❌ |
| 126 | `prometheus` | Prometheus | CNCF | Monitoring | ✅ |
| 127 | `loki` | Grafana Loki | Grafana | Monitoring | ✅ |
| 128 | `tempo` | Grafana Tempo | Grafana | Monitoring | ✅ |
| 129 | `puppeteer-browser` | Puppeteer | Google | Développement | ❌ |
| 130 | `selenium` | Selenium | Selenium | Développement | ❌ |
| 131 | `cypress` | Cypress | Cypress | Développement | ✅ |
| 132 | `storybook` | Storybook | Storybook | Développement | ❌ |
| 133 | `chromatic` | Chromatic | Chromatic | Développement | ✅ |
| 134 | `docusaurus` | Docusaurus | Meta | Développement | ❌ |
| 135 | `mintlify` | Mintlify | Mintlify | Développement | ✅ |
| 136 | `readme` | ReadMe | ReadMe | Développement | ✅ |
| 137 | `paypal` | PayPal | PayPal | Productivité | ✅ |
| 138 | `square` | Square | Square | Productivité | ✅ |
| 139 | `plaid` | Plaid | Plaid | Données | ✅ |
| 140 | `auth0` | Auth0 | Okta (Auth0) | Cloud & Infra | ✅ |
| 141 | `okta` | Okta | Okta | Cloud & Infra | ✅ |
| 142 | `clerk` | Clerk | Clerk | Cloud & Infra | ✅ |
| 143 | `resend` | Resend | Resend | Productivité | ✅ |
| 144 | `novu` | Novu | Novu | Productivité | ✅ |
| 145 | `tinybird` | Tinybird | Tinybird | Données | ✅ |
| 146 | `motherduck` | MotherDuck | MotherDuck | Données | ✅ |

### Catégories

| Catégorie | Emoji | Nombre d'outils |
|-----------|-------|-----------------|
| Recherche | 🔍 | 3 |
| Développement | 💻 | 27 |
| Bases de données | 🗄️ | 20 |
| Cloud & Infra | ☁️ | 25 |
| Productivité | 📋 | 33 |
| IA & ML | 🤖 | 16 |
| Monitoring | 📊 | 8 |
| Données | 📈 | 14 |

## 3. Architecture technique

```
┌─────────────────────────────────────────────────────┐
│                  Dashboard UI                        │
│           /dashboard/mcp-tools                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │
│  │ Catalogue │ │ Filtres  │ │ Toggle activation    │ │
│  │ 146 outils│ │Catégorie │ │ + Modal API Key      │ │
│  └────┬─────┘ └────┬─────┘ └──────────┬───────────┘ │
└───────┼────────────┼──────────────────┼─────────────┘
        │            │                  │
        ▼            ▼                  ▼
┌─────────────────────────────────────────────────────┐
│                API Routes (v1)                       │
│  GET    /api/v1/mcp-tools           → Catalogue      │
│  GET    /api/v1/mcp-tools/:id       → Détail outil   │
│  POST   /api/v1/mcp-tools/:id/activate   → Activer   │
│  POST   /api/v1/mcp-tools/:id/deactivate → Désactiver│
│  GET    /api/v1/mcp-tools/usage     → Statistiques   │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│ requireProPlan│ │McpToolsService│ │handleApiError│
│  (403 gate)  │ │  (business   │ │ (centralized)│
│              │ │   logic)     │ │              │
└──────────────┘ └──────┬──────┘ └──────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│   Catalog    │ │   Prisma    │ │  Firebase    │
│  (146 tools  │ │  McpTool-   │ │  Auth        │
│   in-memory) │ │  Activation │ │  (JWT)       │
└──────────────┘ └─────────────┘ └──────────────┘
```

## 4. Modèles de données

### McpToolActivation

```prisma
model McpToolActivation {
  id          String        @id @default(cuid())
  userId      String
  toolId      String
  status      McpToolStatus @default(ACTIVE)   // ACTIVE | INACTIVE | ERROR
  config      Json          @default("{}")      // API keys chiffrées, paramètres
  activatedAt DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([userId, toolId])
  @@index([userId, status])
}
```

### McpToolUsageLog

```prisma
model McpToolUsageLog {
  id        String   @id @default(cuid())
  userId    String
  toolId    String
  action    String                              // activate, deactivate, execute
  latencyMs Int?
  success   Boolean  @default(true)
  error     String?
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  @@index([userId, createdAt])
  @@index([toolId, createdAt])
}
```

## 5. Contrôle d'accès — Plan Pro Gate

Toute opération d'activation/désactivation/usage passe par `requireProPlan()` :

1. Lecture du `UserProfile.plan` via Prisma
2. Résolution du plan via `resolvePlanId()` (gère les alias)
3. Si `plan === 'free'` → `throw ProPlanRequiredError` (HTTP 403)
4. `handleApiError` convertit en `{ success: false, error: "...", code: "PRO_PLAN_REQUIRED" }`

Le catalogue GET est accessible à tous (free + pro) pour permettre l'upsell.

## 6. Sécurité

- **Auth Firebase JWT** sur toutes les routes via `getAuthUserId()`
- **handleApiError** centralisé (pas de `error.message` en 5xx)
- **Erreurs typées** (`TwinMCPError` subclasses) : `ProPlanRequiredError`, `ToolNotFoundError`, `ToolNotActivatedError`, `ToolConfigError`
- **sanitizeConfig()** : whitelist string/number/boolean, max 100 clés, max 2000 chars, rejet `__proto__`/`constructor`
- **RGPD** : `McpToolActivation` et `McpToolUsageLog` sont supprimés dans le endpoint `/api/account/delete`

## 7. Fichiers créés/modifiés

### Nouveaux fichiers (10)

| Fichier | Rôle |
|---------|------|
| `lib/mcp-tools/catalog.ts` | Catalogue des 146 outils (définitions, catégories, helpers) |
| `lib/mcp-tools/require-pro.ts` | Gate Pro plan (`requireProPlan`, `ProPlanRequiredError`) |
| `lib/mcp-tools/mcp-tools.service.ts` | Service métier (CRUD activations, usage, catalogue) |
| `lib/mcp-tools/index.ts` | Barrel export |
| `prisma/schema/12-mcp-tools.prisma` | Modèles Prisma `McpToolActivation` + `McpToolUsageLog` |
| `app/api/v1/mcp-tools/route.ts` | GET catalogue |
| `app/api/v1/mcp-tools/[toolId]/route.ts` | GET détail outil |
| `app/api/v1/mcp-tools/[toolId]/activate/route.ts` | POST activer (Pro) |
| `app/api/v1/mcp-tools/[toolId]/deactivate/route.ts` | POST désactiver (Pro) |
| `app/api/v1/mcp-tools/usage/route.ts` | GET statistiques (Pro) |
| `app/dashboard/mcp-tools/page.tsx` | Page dashboard Outils MCP |

### Fichiers modifiés (4)

| Fichier | Modification |
|---------|-------------|
| `prisma/schema/03-user.prisma` | Ajout relations `mcpToolActivations`, `mcpToolUsageLogs` |
| `middleware.ts` | Ajout `/api/v1/mcp-tools` à `SELF_AUTH_ROUTES` |
| `app/dashboard/layout.tsx` | Navigation : "MCP Externes" → "Outils MCP" (badge Pro) |
| `lib/services/stripe-billing.service.ts` | Features plan Pro : "Outils MCP (146 intégrations)" |
| `app/api/account/delete/route.ts` | RGPD : suppression `McpToolActivation` + `McpToolUsageLog` |