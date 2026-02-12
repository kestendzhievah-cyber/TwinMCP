# Arborescence du projet

```
twinmcp/
├── packages/
│   ├── mcp-server/              # Package NPM @twinmcp/mcp
│   │   ├── src/
│   │   │   ├── index.ts         # Point d'entrée
│   │   │   ├── tools/
│   │   │   │   ├── resolve-library.ts
│   │   │   │   └── query-docs.ts
│   │   │   ├── client/
│   │   │   │   ├── stdio.ts     # Client stdio
│   │   │   │   └── http.ts      # Client HTTP
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── backend/                 # API Backend
│       ├── src/
│       │   ├── server.ts        # Point d'entrée Fastify
│       │   ├── routes/
│       │   │   ├── mcp.ts       # /mcp endpoints
│       │   │   ├── auth.ts      # /auth endpoints
│       │   │   └── dashboard.ts
│       │   ├── services/
│       │   │   ├── auth/
│       │   │   │   ├── api-key.service.ts
│       │   │   │   └── oauth.service.ts
│       │   │   ├── library/
│       │   │   │   ├── resolver.service.ts
│       │   │   │   └── repository.ts
│       │   │   ├── docs/
│       │   │   │   ├── query.service.ts
│       │   │   │   └── embedding.service.ts
│       │   │   ├── crawling/
│       │   │   │   ├── github.crawler.ts
│       │   │   │   └── scheduler.ts
│       │   │   └── parsing/
│       │   │       ├── markdown.parser.ts
│       │   │       └── chunker.ts
│       │   ├── models/           # Prisma models
│       │   │   └── schema.prisma
│       │   ├── utils/
│       │   │   ├── logger.ts
│       │   │   ├── cache.ts
│       │   │   └── rate-limiter.ts
│       │   ├── config/
│       │   │   └── index.ts
│       │   └── types/
│       │       └── index.ts
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       ├── __tests__/
│       │   ├── unit/
│       │   ├── integration/
│       │   └── e2e/
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   └── dashboard/               # Next.js Dashboard
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx
│       │   │   ├── dashboard/
│       │   │   │   ├── page.tsx
│       │   │   │   ├── api-keys/
│       │   │   │   ├── libraries/
│       │   │   │   └── usage/
│       │   │   └── api/
│       │   ├── components/
│       │   │   ├── ui/          # shadcn components
│       │   │   └── dashboard/
│       │   └── lib/
│       │       └── api-client.ts
│       ├── public/
│       ├── package.json
│       └── next.config.js
│
├── infrastructure/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.worker
│   │   └── docker-compose.yml
│   ├── k8s/
│   │   ├── namespace.yaml
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── hpa.yaml
│   └── terraform/              # (optionnel)
│       ├── main.tf
│       └── variables.tf
│
├── scripts/
│   ├── seed-libraries.ts       # Seed initial des bibliothèques
│   ├── migrate-db.sh
│   └── deploy.sh
│
├── docs/
│   ├── architecture/           # Ce dossier
│   ├── api-reference.md
│   └── user-guide.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── package.json                # Root workspace
├── turbo.json                  # Turborepo config (optionnel)
├── .eslintrc.js
├── .prettierrc
├── .gitignore
└── README.md
```
