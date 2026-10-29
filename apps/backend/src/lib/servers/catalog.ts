// Public MCP server catalogue: the /servers pages, the sitemap, llms.txt and the
// "related MCP servers" blocks of blog posts and use-case pages.
//
// It is READ FROM THE SEED (lib/servers/seed-catalog.ts, the data
// `pnpm seed:mcps` writes to the database), so the public site lists exactly
// the MCPs a user can install, with the same names, descriptions and config
// fields as the marketplace. Retired slugs (RETIRED_SLUGS) and the
// auto-installed TwinMCP Docs MCP get no page. Nothing here may add a fact the
// seed does not hold: this file only adds French translations of the seed's
// own wording, category labels and internal links to blog posts.

import { CATEGORY, OFFICIAL_MCPS, RETIRED_SLUGS, type SeedEntry } from "./seed-catalog";

/** Seed entries that are not a page: auto-installed on every box server. */
export const INTERNAL_SLUGS: readonly string[] = ["twinmcp-docs"];

export type CategoryKey =
  | "web"
  | "data"
  | "dev"
  | "productivity"
  | "ai"
  | "creative"
  | "utility"
  | "docs"
  | "other";

/** Display order of the categories on the catalogue index. */
export const CATEGORY_ORDER: readonly CategoryKey[] = [
  "web",
  "data",
  "dev",
  "productivity",
  "ai",
  "creative",
  "utility",
  "docs",
  "other",
];

const CATEGORY_LABELS: Record<CategoryKey, { en: string; fr: string }> = {
  web: { en: "Web & search", fr: "Web et recherche" },
  data: { en: "Data & databases", fr: "Données et bases de données" },
  dev: { en: "Developer tools", fr: "Outils de développement" },
  productivity: { en: "Productivity", fr: "Productivité" },
  ai: { en: "AI", fr: "IA" },
  creative: { en: "Design & media", fr: "Design et médias" },
  utility: { en: "Utilities", fr: "Utilitaires" },
  docs: { en: "Documentation", fr: "Documentation" },
  other: { en: "Other", fr: "Autres" },
};

export function categoryLabel(key: CategoryKey, locale: "en" | "fr" = "en"): string {
  return CATEGORY_LABELS[key][locale];
}

function toCategoryKey(raw: string | undefined): CategoryKey {
  return raw && raw in CATEGORY_LABELS ? (raw as CategoryKey) : "other";
}

// Internal links from a server page to the blog posts that discuss it (and,
// inverted by getRelatedServers, from those posts back to the server page).
const RELATED_BLOG_SLUGS: Record<string, string[]> = {
  filesystem: ["cursor-mcp-setup", "claude-desktop-mcp", "production-mcp-servers"],
  memory: ["production-mcp-servers", "build-mcp-server"],
  fetch: ["production-mcp-servers", "secure-mcp-server"],
  time: ["production-mcp-servers"],
  "sequential-thinking": ["production-mcp-servers"],
  linear: ["production-mcp-servers", "build-mcp-server"],
  notion: ["notion-mcp-server-tutorial", "production-mcp-servers"],
  postgres: ["production-mcp-servers", "secure-mcp-server", "mcp-server-hosting"],
  slack: ["production-mcp-servers", "secure-mcp-server"],
  "brave-search": ["production-mcp-servers"],
  sentry: ["mcp-server-monitoring", "secure-mcp-server"],
};

// One-line summaries that must differ from the seed description, only to keep a
// word the site-wide truth guards ban about TwinMCP itself (llms.test.ts bans
// "refund" in llms.txt) out of the summary. A truthful subset of the seed text;
// the page itself still shows the full description.
const TAGLINE_OVERRIDES: Record<string, string> = {
  stripe:
    "Manage Stripe from the model — customers, payments, invoices, products and prices. Use a restricted API key. Requires a Stripe secret/restricted key.",
};

export interface ServerEntry {
  slug: string;
  /** Display name, as in the marketplace (e.g. "Brave Search"). */
  name: string;
  /** The seed description (see TAGLINE_OVERRIDES), used as the one-line summary. */
  tagline: string;
  categoryKey: CategoryKey;
  /** English category label. */
  category: string;
  /** "box": runs in an isolated Upstash Box. "local": on the user's machine via `ctx7 connect`. */
  hostMode: "box" | "local";
  relatedBlogSlugs: string[];
  /** The raw seed entry (launch command, config schema, repo URL). */
  seed: SeedEntry;
}

function toEntry(seed: SeedEntry): ServerEntry {
  const categoryKey = toCategoryKey(seed.category ?? CATEGORY[seed.slug]);
  return {
    slug: seed.slug,
    name: seed.name,
    tagline: TAGLINE_OVERRIDES[seed.slug] ?? seed.description,
    categoryKey,
    category: categoryLabel(categoryKey, "en"),
    hostMode: seed.hostMode ?? "box",
    relatedBlogSlugs: RELATED_BLOG_SLUGS[seed.slug] ?? [],
    seed,
  };
}

/** Every MCP with a public page, in seed order. */
export const SERVERS: ServerEntry[] = OFFICIAL_MCPS.filter(
  (m) => !RETIRED_SLUGS.includes(m.slug) && !INTERNAL_SLUGS.includes(m.slug)
).map(toEntry);

const BY_SLUG = new Map(SERVERS.map((s) => [s.slug, s]));

export function getServerBySlug(slug: string): ServerEntry | undefined {
  return BY_SLUG.get(slug);
}

// Inverse of `relatedBlogSlugs`: the catalog servers that reference a given blog
// post. Powers the "Related MCP servers" block on blog posts so editorial pages
// pass link equity to the programmatic /servers pages (internal linking).
export function getRelatedServers(
  blogSlug: string,
  limit = 4
): Array<Pick<ServerEntry, "slug" | "name" | "tagline">> {
  return SERVERS.filter((s) => s.relatedBlogSlugs.includes(blogSlug))
    .slice(0, limit)
    .map((s) => ({ slug: s.slug, name: s.name, tagline: s.tagline }));
}

// Look up catalog servers by an explicit, ordered list of slugs (skips unknowns).
// Powers the "Related MCP servers" block on use-case pages.
export function getServersBySlugs(
  slugs: string[]
): Array<Pick<ServerEntry, "slug" | "name" | "tagline">> {
  return slugs
    .map((slug) => BY_SLUG.get(slug))
    .filter((s): s is ServerEntry => Boolean(s))
    .map((s) => ({ slug: s.slug, name: s.name, tagline: s.tagline }));
}

/** Servers grouped by category key, in CATEGORY_ORDER, empty groups dropped. */
export function getServersByCategory(): Array<{ key: CategoryKey; servers: ServerEntry[] }> {
  return CATEGORY_ORDER.map((key) => ({
    key,
    servers: SERVERS.filter((s) => s.categoryKey === key),
  })).filter((g) => g.servers.length > 0);
}

// ─── French ─────────────────────────────────────────────────────────────────
// Translations of the seed's own wording (descriptions and config-field hints).
// Product, menu and key names stay as the vendor spells them. A guard test
// requires one entry per public MCP and per config field.

export const FR_DESCRIPTIONS: Record<string, string> = {
  filesystem: "Accès en lecture et en écriture à un répertoire isolé à l’intérieur de la box.",
  memory:
    "Mémoire persistante sous forme de graphe de connaissances, que le modèle peut lire et enrichir d’un échange à l’autre.",
  "sequential-thinking":
    "Outil de raisonnement structuré, étape par étape, pour décomposer les problèmes complexes.",
  everything:
    "Serveur MCP de référence qui exerce tout le protocole : echo, addition, progression des tâches longues, variables d’environnement, images. Idéal pour tester une connexion de bout en bout.",
  fetch: "Récupère une URL et renvoie son contenu en Markdown (serveur MCP fetch officiel).",
  time: "Heure actuelle et conversion de fuseaux horaires. Demandez l’heure n’importe où ou convertissez entre fuseaux IANA.",
  git: "Inspecte un dépôt Git dans votre box : status, log, diff, show, branches. Pointez-le vers un dépôt que vous y avez cloné.",
  sqlite:
    "Interroge et gère une base SQLite dans votre box : exécuter du SQL, créer des tables, lire et écrire des lignes. Le fichier de base est créé automatiquement, sans configuration.",
  duckduckgo:
    "Recherche sur le web via DuckDuckGo et récupère le contenu des pages en texte propre. Sans clé API, fonctionne immédiatement.",
  wikipedia:
    "Recherche dans Wikipédia et récupère résumés d’articles, sections et liens pour des faits sourcés. Sans clé API.",
  calculator:
    "Évalue des expressions mathématiques avec précision : un calcul sur lequel le modèle peut s’appuyer au lieu de deviner.",
  markitdown:
    "Convertit une URL, un PDF, un document Office ou une data URI en Markdown propre (Microsoft MarkItDown). Pratique pour donner des documents à lire au modèle.",
  shell:
    "Exécute des commandes et des scripts shell dans votre propre box isolée : le modèle peut lancer du code, inspecter des fichiers et utiliser la ligne de commande. Uniquement dans votre environnement isolé, nulle part ailleurs.",
  duckdb:
    "Exécute du SQL analytique sur une base DuckDB rapide dans votre box : interrogez directement des fichiers CSV, Parquet ou JSON, agrégez et analysez. Le fichier de base est créé automatiquement.",
  arxiv:
    "Recherche et lit des articles arXiv : recherche plein texte avec filtres, résumés, et téléchargement des articles en Markdown pour le modèle. Sans clé API.",
  youtube:
    "Récupère la transcription ou les sous-titres de n’importe quelle vidéo YouTube à partir de son URL, pour résumer une vidéo ou y chercher un passage. Sans clé API.",
  chart:
    "Génère plus de 25 types de graphiques (courbes, barres, secteurs, aires, nuages de points, cartes…) à partir de vos données et renvoie l’URL de l’image rendue : la visualisation de données pour le modèle (AntV).",
  context7:
    "Injecte dans le contexte du modèle une documentation à jour, propre à chaque version, et des exemples de code pour n’importe quelle bibliothèque. Sans clé API, fonctionne immédiatement.",
  "brave-search":
    "Recherche sur le web et parmi les commerces locaux via l’API Brave Search : des résultats rapides et respectueux de la vie privée. Nécessite une clé API Brave Search gratuite.",
  "google-maps":
    "Géocode des adresses, recherche des lieux, calcule itinéraires et distances et consulte le détail d’un lieu via l’API Google Maps. Nécessite une clé API Google Maps.",
  slack:
    "Lit et publie sur Slack : lister les canaux, lire l’historique, envoyer messages et réponses, ajouter des réactions et rechercher des utilisateurs. Nécessite un jeton de bot Slack.",
  gitlab:
    "Travaillez avec GitLab depuis le modèle : rechercher et lire des projets, parcourir des fichiers, créer des issues et des merge requests, pousser des modifications. Nécessite un jeton d’accès GitLab.",
  sentry:
    "Amène le détail des issues et des erreurs Sentry dans le contexte du modèle : stack trace et métadonnées à partir de l’ID ou de l’URL d’une issue, pour déboguer plus vite. Nécessite un jeton d’authentification Sentry.",
  notion:
    "Recherche, lit, crée et met à jour des pages et des bases de données Notion depuis le modèle. Nécessite un jeton d’intégration Notion (partagez d’abord les pages avec votre intégration).",
  airtable:
    "Lit et écrit dans Airtable : lister bases et tables, interroger, créer et mettre à jour des enregistrements, inspecter le schéma. Nécessite un jeton d’accès personnel Airtable.",
  todoist:
    "Gère vos tâches Todoist depuis le modèle : créer, lister, modifier et terminer tâches et projets en langage naturel. Nécessite un jeton API Todoist.",
  exa: "Recherche web optimisée pour l’IA et récupération de contenu via Exa : recherche sémantique, pages similaires et contenu de page propre pour le modèle. Nécessite une clé API Exa.",
  tavily:
    "Recherche web et extraction de contenu optimisées pour les LLM via Tavily : rechercher, obtenir des réponses directes et récupérer le contenu propre des pages. Nécessite une clé API Tavily.",
  firecrawl:
    "Scrape, explore et cartographie des sites web en Markdown propre ou en données structurées via Firecrawl : n’importe quel site devient un contenu exploitable par le modèle. Nécessite une clé API Firecrawl.",
  linear:
    "Travaillez avec Linear depuis le modèle : rechercher, créer et mettre à jour issues, projets, commentaires et cycles. Nécessite un jeton API Linear.",
  stripe:
    "Gère Stripe depuis le modèle : clients, paiements, factures, produits, prix et remboursements. Utilisez une clé API restreinte. Nécessite une clé secrète ou restreinte Stripe.",
  postgres:
    "Interroge et inspecte une base PostgreSQL : exécuter du SQL, explorer le schéma, analyser les index et la santé de la base. Fonctionne en mode restreint par défaut. Nécessite une chaîne de connexion.",
  mongodb:
    "Interroge et gère MongoDB : rechercher et agréger des documents, inspecter collections et schéma, lancer des opérations d’administration. Nécessite une chaîne de connexion.",
  excel:
    "Lit et écrit des classeurs Excel (.xlsx) dans votre box : lire des plages, écrire cellules et formules, créer des feuilles. Sans clé API ; travaille sur les fichiers de votre box.",
  perplexity:
    "Interrogez Perplexity depuis le modèle : des réponses sourcées et ancrées dans le web pour les questions d’actualité. Nécessite une clé API Perplexity.",
  figma:
    "Donnez vos maquettes Figma au modèle : mise en page, composants, styles et contenu d’un fichier, pour générer un code d’interface fidèle. Nécessite un jeton API Figma.",
  apify:
    "Lance des Actors Apify depuis le modèle : scraper des sites, explorer des pages et extraire des données structurées à grande échelle. Nécessite un jeton API Apify.",
  elasticsearch:
    "Interroge et inspecte Elasticsearch depuis le modèle : rechercher dans les index, lancer des agrégations, lire les mappings. Nécessite l’URL du cluster et une clé API.",
  redis:
    "Lit et écrit dans une instance Redis depuis le modèle : lire et écrire des clés, gérer listes, hashes et sets, inspecter la base. Nécessite une URL de connexion Redis.",
  airbnb:
    "Recherche des logements Airbnb et leurs détails depuis le modèle : filtrer par lieu, dates et voyageurs, lire les caractéristiques d’une annonce. Sans clé API.",
  e2b: "Laissez le modèle exécuter du code dans un bac à sable distant sécurisé via E2B : lancer du Python ou du JavaScript, installer des paquets, lire le résultat. Nécessite une clé API E2B.",
  hackernews:
    "Recherche et lit Hacker News depuis le modèle : stories les plus populaires et les plus récentes, commentaires d’une story, profils d’utilisateurs. Sans clé API.",
  supabase:
    "Travaillez sur votre projet Supabase depuis le modèle : parcourir les tables, exécuter du SQL, lire les logs et gérer le schéma (lecture seule par défaut). Nécessite un jeton d’accès Supabase.",
  neon: "Gère Neon, le Postgres serverless, depuis le modèle : créer projets et branches, exécuter du SQL, inspecter les bases. Nécessite une clé API Neon.",
  dbhub:
    "Connecteur de bases de données universel : interrogez et inspectez Postgres, MySQL, SQL Server, MariaDB ou SQLite via un seul serveur et une chaîne de connexion (DSN).",
  browserbase:
    "Pilote un navigateur cloud depuis le modèle : naviguer, cliquer, remplir des formulaires, extraire du contenu et faire des captures d’écran, dans les navigateurs gérés par Browserbase. Nécessite une clé API et un ID de projet Browserbase.",
  "youtube-data":
    "Recherche sur YouTube et lit les métadonnées, statistiques et sous-titres des vidéos et des chaînes via la YouTube Data API. Nécessite une clé YouTube Data API.",
  qdrant:
    "Stocke du texte et le recherche par le sens dans une base vectorielle Qdrant : une mémoire longue durée interrogeable pour le modèle. Nécessite une URL Qdrant et un nom de collection.",
  chroma:
    "Indexe des documents et les recherche par le sens dans une base vectorielle Chroma à l’intérieur de votre box : ajouter des documents, interroger par le sens. Base éphémère, sans clé API.",
  "yahoo-finance":
    "Cours de bourse, historiques et informations sur les entreprises via Yahoo Finance : des données de marché sur lesquelles le modèle peut raisonner. Sans clé API.",
  elevenlabs:
    "Synthèse vocale, clonage de voix et transcription audio via ElevenLabs : une voix et des outils audio pour le modèle. Nécessite une clé API ElevenLabs.",
  replicate:
    "Lance sur Replicate des modèles d’image, de vidéo, d’audio et d’autres modèles de ML depuis le modèle : générer des médias et suivre les prédictions jusqu’au résultat. Nécessite un jeton API Replicate.",
  clickhouse:
    "Exécute du SQL analytique rapide sur un cluster ClickHouse depuis le modèle : explorer bases et tables, interroger des milliards de lignes. Nécessite l’hôte et des identifiants.",
  trello:
    "Gère Trello depuis le modèle : lire tableaux et listes, créer et déplacer des cartes, ajouter commentaires et checklists. Nécessite une clé API et un jeton Trello.",
  "shopify-dev":
    "Recherche dans la documentation développeur de Shopify et explore le schéma GraphQL Admin depuis le modèle, pour créer des apps Shopify plus vite. Sans clé API.",
  kubernetes:
    "Pilote un cluster Kubernetes depuis le modèle : lister et décrire des ressources, lire des logs, appliquer des manifestes. Utilise un kubeconfig présent dans votre box.",
  reddit:
    "Parcourt Reddit depuis le modèle : posts populaires d’un subreddit, détail d’un post et son arbre de commentaires. Sans clé API.",
  hubspot:
    "Travaillez avec votre CRM HubSpot depuis le modèle : lire et mettre à jour contacts, entreprises, transactions, tickets et engagements. Nécessite un jeton d’accès d’app privée HubSpot.",
  clickup:
    "Gère ClickUp depuis le modèle : créer et modifier des tâches, parcourir listes et dossiers, gérer des docs. Nécessite une clé API et un ID d’équipe ClickUp.",
  discord:
    "Lit et publie sur Discord depuis le modèle : lister les canaux, lire et envoyer des messages, ajouter des réactions. Nécessite un jeton de bot Discord.",
  prometheus:
    "Interroge Prometheus depuis le modèle : requêtes PromQL instantanées et sur intervalle, liste des métriques, inspection des cibles. Nécessite l’URL de votre serveur Prometheus.",
  kagi: "Recherche sur le web via Kagi et réponses FastGPT depuis le modèle : des résultats de qualité, sans publicité. Nécessite une clé API Kagi.",
  coingecko:
    "Cours et données de marché des cryptomonnaies en direct via CoinGecko : coins, plateformes d’échange, historiques et tendances. Sans clé API (API publique).",
  nasa: "Accède aux API ouvertes de la NASA depuis le modèle : image astronomique du jour, photos des rovers martiens, astéroïdes géocroiseurs et imagerie de la Terre. Nécessite une clé API NASA gratuite.",
  pinecone:
    "Stocke des vecteurs dans Pinecone et les recherche par le sens depuis le modèle : insérer des enregistrements, interroger par le sens, gérer des index pour une mémoire longue ou du RAG. Nécessite une clé API Pinecone.",
  neo4j:
    "Interroge et met à jour une base de graphes Neo4j depuis le modèle : requêtes Cypher en lecture et en écriture, inspection du schéma. Nécessite une URL Bolt et des identifiants.",
  milvus:
    "Recherche dans une base vectorielle Milvus et la gère depuis le modèle : recherche sémantique et plein texte, gestion des collections, insertions. Nécessite une URI Milvus.",
  netlify:
    "Gère Netlify depuis le modèle : lister sites et déploiements, lire les logs de build, gérer les variables d’environnement. Nécessite un jeton d’accès personnel Netlify.",
  digitalocean:
    "Gère DigitalOcean depuis le modèle : droplets, apps App Platform, bases de données managées et ressources du compte. Nécessite un jeton API DigitalOcean.",
  searxng:
    "Métarecherche privée via une instance SearXNG : des résultats agrégés depuis de nombreux moteurs, sans pistage. Sans clé API ; nécessite l’URL d’une instance SearXNG.",
  blender:
    "Pilotez Blender depuis votre LLM : créer et modifier scènes 3D, objets et matériaux, exécuter du Python dans Blender. S’exécute en local via l’agent TwinMCP ; nécessite l’add-on BlenderMCP installé et actif dans Blender.",
  revit:
    "Interrogez votre maquette BIM Revit depuis votre LLM : requêtes sur les éléments, quantitatifs et métrés, contrôles de résistance au feu et d’accessibilité. S’exécute en local via l’agent TwinMCP : votre maquette ne quitte pas votre machine. Livré avec une maquette de démonstration intégrée ; définissez REVIT_MCP_MODE=live pour connecter un vrai Revit via l’écouteur pyRevit.",
};

/** French config-field hints, keyed `<slug>.<FIELD>`. */
export const FR_FIELD_DESCRIPTIONS: Record<string, string> = {
  "filesystem.FILESYSTEM_PATH":
    "Chemin absolu à exposer, par ex. /workspace/home (le répertoire personnel de la box, accessible en écriture).",
  "git.GIT_REPOSITORY": "Chemin absolu d’un dépôt Git dans la box, par ex. /workspace/home/myrepo",
  "sqlite.SQLITE_DB_PATH":
    "Facultatif. Chemin absolu du fichier SQLite dans votre box. Par défaut : /workspace/home/twinmcp.db.",
  "duckdb.DUCKDB_DB_PATH":
    "Facultatif. Chemin absolu du fichier DuckDB dans votre box. Par défaut : /workspace/home/twin.duckdb.",
  "arxiv.ARXIV_STORAGE_PATH":
    "Facultatif. Chemin absolu où les articles téléchargés sont stockés dans votre box. Par défaut : /workspace/home/arxiv.",
  "brave-search.BRAVE_API_KEY":
    "Votre clé API Brave Search (offre gratuite sur brave.com/search/api).",
  "google-maps.GOOGLE_MAPS_API_KEY":
    "Clé API Google Maps Platform (avec Places et Directions activés).",
  "slack.SLACK_BOT_TOKEN": "Jeton de bot Slack (xoxb-…) avec les scopes channels/chat.",
  "slack.SLACK_TEAM_ID": "L’ID de votre espace de travail (team) Slack, qui commence par T…",
  "gitlab.GITLAB_PERSONAL_ACCESS_TOKEN": "Jeton d’accès personnel GitLab avec le scope api.",
  "gitlab.GITLAB_API_URL":
    "Facultatif. URL de l’API d’un GitLab auto-hébergé. Par défaut : https://gitlab.com/api/v4.",
  "sentry.SENTRY_AUTH_TOKEN":
    "Jeton d’authentification Sentry (Settings → Account → API → Auth Tokens).",
  "notion.OPENAPI_MCP_HEADERS":
    'En-têtes JSON, par ex. {"Authorization":"Bearer ntn_your_token","Notion-Version":"2022-06-28"}',
  "airtable.AIRTABLE_API_KEY":
    "Jeton d’accès personnel Airtable (pat…) avec les scopes nécessaires.",
  "todoist.TODOIST_API_TOKEN": "Jeton API Todoist (Todoist → Settings → Integrations → Developer).",
  "exa.EXA_API_KEY": "Votre clé API Exa (dashboard.exa.ai).",
  "tavily.TAVILY_API_KEY": "Votre clé API Tavily (app.tavily.com).",
  "firecrawl.FIRECRAWL_API_KEY": "Votre clé API Firecrawl (firecrawl.dev).",
  "linear.LINEAR_API_TOKEN": "Jeton API Linear (Linear → Settings → API → Personal API keys).",
  "stripe.STRIPE_SECRET_KEY":
    "Clé secrète ou restreinte Stripe (rk_… recommandée, pour le moindre privilège).",
  "postgres.DATABASE_URI":
    "Chaîne de connexion Postgres, par ex. postgresql://user:pass@host:5432/dbname",
  "mongodb.MDB_MCP_CONNECTION_STRING":
    "Chaîne de connexion MongoDB, par ex. mongodb+srv://user:pass@cluster/db",
  "perplexity.PERPLEXITY_API_KEY": "Votre clé API Perplexity (perplexity.ai → Settings → API).",
  "figma.FIGMA_API_KEY":
    "Jeton d’accès personnel Figma (Figma → Settings → Account → Personal access tokens).",
  "apify.APIFY_TOKEN": "Votre jeton API Apify (console.apify.com → Settings → Integrations).",
  "elasticsearch.ES_URL": "Point d’accès Elasticsearch, par ex. https://my-cluster.es.io:9243",
  "elasticsearch.ES_API_KEY": "Clé API Elasticsearch (base64) avec accès en lecture.",
  "redis.REDIS_URL": "URL de connexion Redis, par ex. redis://user:pass@host:6379",
  "e2b.E2B_API_KEY": "Votre clé API E2B (e2b.dev → Dashboard → API Keys).",
  "supabase.SUPABASE_ACCESS_TOKEN":
    "Jeton d’accès personnel Supabase (supabase.com → Account → Access Tokens).",
  "neon.NEON_API_KEY": "Votre clé API Neon (console.neon.tech → Account settings → API keys).",
  "dbhub.DSN": "Chaîne de connexion à la base, par ex. postgres://user:pass@host:5432/db",
  "browserbase.BROWSERBASE_API_KEY": "Votre clé API Browserbase (browserbase.com → Settings).",
  "browserbase.BROWSERBASE_PROJECT_ID": "L’ID de votre projet Browserbase.",
  "youtube-data.YOUTUBE_API_KEY": "Clé YouTube Data API v3 (console Google Cloud).",
  "qdrant.QDRANT_URL": "Point d’accès Qdrant, par ex. https://xyz.cloud.qdrant.io:6333",
  "qdrant.QDRANT_API_KEY": "Facultatif. Clé API Qdrant (pour Qdrant Cloud).",
  "qdrant.COLLECTION_NAME": "Collection à lire et à écrire, par ex. twinmcp-memory.",
  "elevenlabs.ELEVENLABS_API_KEY": "Votre clé API ElevenLabs (elevenlabs.io → Profile → API key).",
  "replicate.REPLICATE_API_TOKEN":
    "Votre jeton API Replicate (replicate.com → Account → API tokens).",
  "clickhouse.CLICKHOUSE_HOST": "Hôte ClickHouse, par ex. my-cluster.clickhouse.cloud",
  "clickhouse.CLICKHOUSE_USER": "Nom d’utilisateur ClickHouse, par ex. default",
  "clickhouse.CLICKHOUSE_PASSWORD": "Mot de passe ClickHouse.",
  "trello.TRELLO_API_KEY": "Clé API Trello (trello.com/power-ups/admin → votre clé).",
  "trello.TRELLO_TOKEN": "Jeton Trello (généré à partir de votre clé API).",
  "kubernetes.KUBECONFIG": "Facultatif. Chemin d’un fichier kubeconfig dans votre box.",
  "hubspot.HUBSPOT_ACCESS_TOKEN":
    "Jeton d’accès d’app privée HubSpot (pat-…) avec les scopes CRM nécessaires.",
  "clickup.CLICKUP_API_KEY": "Clé API ClickUp (ClickUp → Settings → Apps).",
  "clickup.CLICKUP_TEAM_ID": "L’ID de votre équipe (espace de travail) ClickUp.",
  "discord.DISCORD_TOKEN": "Jeton de bot Discord (Discord Developer Portal → votre app → Bot).",
  "prometheus.PROMETHEUS_URL":
    "URL de base de Prometheus, par ex. https://prometheus.mycompany.com",
  "kagi.KAGI_API_KEY": "Votre clé API Kagi (kagi.com → Settings → API).",
  "nasa.NASA_API_KEY": "Votre clé API NASA (gratuite sur api.nasa.gov).",
  "pinecone.PINECONE_API_KEY": "Votre clé API Pinecone (app.pinecone.io → API Keys).",
  "neo4j.NEO4J_URI": "URL Bolt Neo4j, par ex. neo4j+s://xxxx.databases.neo4j.io",
  "neo4j.NEO4J_USERNAME": "Nom d’utilisateur Neo4j, par ex. neo4j",
  "neo4j.NEO4J_PASSWORD": "Mot de passe Neo4j.",
  "milvus.MILVUS_URI":
    "Point d’accès Milvus, par ex. http://localhost:19530 ou une URI Zilliz Cloud.",
  "milvus.MILVUS_TOKEN": "Facultatif. Jeton d’authentification Milvus/Zilliz.",
  "netlify.NETLIFY_AUTH_TOKEN":
    "Jeton d’accès personnel Netlify (app.netlify.com → User settings → Applications).",
  "digitalocean.DIGITALOCEAN_API_TOKEN":
    "Jeton API DigitalOcean (cloud.digitalocean.com → API → Tokens).",
  "searxng.SEARXNG_URL": "L’URL de votre instance SearXNG, par ex. https://searx.example.com",
  "revit.REVIT_MCP_MODE":
    '"demo" (maquette d’exemple intégrée, par défaut) ou "live" (un vrai Revit via l’écouteur pyRevit).',
  "revit.REVIT_HOST": "Hôte de l’écouteur Revit en mode live (par défaut 127.0.0.1).",
  "revit.REVIT_PORT": "Port de l’écouteur Revit en mode live (par défaut 8765).",
};

/** The server's description in a locale (French falls back to the seed's English). */
export function localizedDescription(entry: ServerEntry, locale: "en" | "fr"): string {
  return (locale === "fr" && FR_DESCRIPTIONS[entry.slug]) || entry.seed.description;
}

/** A config field's hint in a locale (French falls back to the seed's English). */
export function localizedFieldDescription(
  entry: ServerEntry,
  field: string,
  locale: "en" | "fr"
): string {
  const en = entry.seed.configSchema.properties[field]?.description ?? "";
  return (locale === "fr" && FR_FIELD_DESCRIPTIONS[`${entry.slug}.${field}`]) || en;
}
