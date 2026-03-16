# UCP Commerce ⚡

> Outil fullstack d'optimisation du référencement e-commerce sur les LLMs via le protocole UCP (Unified Context Protocol).

## 🎯 Vision

Les moteurs de réponse IA (ChatGPT, Claude, Gemini, Perplexity) deviennent les nouveaux moteurs de recherche. **UCP Commerce** aide les e-commerçants à optimiser leurs fiches produit pour être mieux compris et recommandés par les LLMs.

## 🚀 Fonctionnalités

- **Analyseur LLM** — Score de visibilité détaillé (titre, description, attributs, catégorie)
- **Générateur UCP** — Contextes structurés au format Unified Context Protocol
- **Optimiseur IA** — Suggestions automatiques pour améliorer vos fiches produit
- **Dashboard Analytics** — Suivi des mentions sur les principaux LLMs
- **Multi-boutique** — Connexion Shopify, WooCommerce, PrestaShop, Magento
- **Export JSON/API** — Intégration facile dans vos workflows

## 🛠️ Stack technique

- **Frontend** — Next.js 14, React 18, Tailwind CSS, Radix UI
- **Backend** — Next.js API Routes, Prisma ORM
- **Base de données** — PostgreSQL
- **Langage** — TypeScript strict
- **UI** — shadcn/ui, Lucide Icons, class-variance-authority

## 📦 Installation

```bash
# Cloner le projet
git clone https://github.com/your-org/ucp-commerce.git
cd ucp-commerce

# Installer les dépendances
npm install

# Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos variables

# Initialiser la base de données
npx prisma generate
npx prisma db push

# Lancer en développement
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000).

## 📁 Structure du projet

```
ucp-commerce/
├── app/                    # Pages Next.js (App Router)
│   ├── page.tsx            # Landing page
│   └── dashboard/          # Dashboard e-commerçant
│       ├── page.tsx        # Vue d'ensemble
│       ├── products/       # Gestion des produits
│       ├── analyzer/       # Analyseur LLM
│       ├── optimizer/      # Optimiseur IA
│       ├── ucp-contexts/   # Contextes UCP
│       ├── analytics/      # Analytics LLM
│       ├── stores/         # Boutiques connectées
│       └── settings/       # Paramètres
├── components/ui/          # Composants UI réutilisables
├── lib/
│   ├── ucp/                # Core UCP
│   │   ├── generator.ts    # Génération de contextes UCP
│   │   ├── analyzer.ts     # Analyse de visibilité LLM
│   │   └── optimizer.ts    # Optimisation automatique
│   ├── prisma.ts           # Client Prisma singleton
│   ├── types.ts            # Types TypeScript
│   └── utils.ts            # Fonctions utilitaires
├── prisma/
│   └── schema.prisma       # Schéma de base de données
└── public/                 # Assets statiques
```

## 🔑 Variables d'environnement

| Variable | Description | Requis |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | ✅ |
| `NEXTAUTH_SECRET` | Secret pour l'auth | ✅ |
| `NEXTAUTH_URL` | URL de l'app | ✅ |
| `OPENAI_API_KEY` | Clé OpenAI (optimisation IA) | ❌ |

## 📄 Licence

MIT © UCP Commerce
