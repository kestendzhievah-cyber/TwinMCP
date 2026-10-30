// Segment pages ("solutions"): one public page per MCP pack of lib/mcp-bundles.ts,
// aimed at one SME profile. EN at /solutions/<slug>, FR at /fr/solutions/<slug>
// (translated slugs; registered in lib/i18n/locales.ts so the language
// switcher and hreflang pairs reach them).
//
// Facts policy — every claim maps to code, and src/__tests__/solutions.test.ts
// pins it:
//   - the MCPs of a pack are read from MCP_BUNDLES, never re-listed here;
//   - each MCP's English name and description are copied VERBATIM from the
//     seed catalogue (lib/servers/seed-catalog.ts, written to the database by
//     scripts/seed-mcps.ts); the French one translates it, nothing more;
//   - `configKeys` are exactly the `required: true` config fields of the seed
//     entry, so "what you bring" never drifts from what the install form asks;
//   - every example prompt names the MCPs it relies on, and those must be in
//     the pack: a prompt never needs a tool the pack does not have.
// No customers, numbers, testimonials, SLA, region or certification claims.
//
// Pure and client-safe (types-only import from the i18n module).

import { getBundle } from "@/lib/mcp-bundles";
import type { Locale } from "@/lib/i18n/locales";

type Localized<T> = Record<Locale, T>;

/** One catalogue MCP as the solution pages describe it. */
export interface SolutionMcp {
  slug: string;
  name: string;
  /** EN = the seed description verbatim; FR = its translation. */
  description: Localized<string>;
  /** Required config fields of the seed entry (empty = installs with no input). */
  configKeys: readonly string[];
  /** What the customer must provide, in plain words; null when nothing. */
  needs: Localized<string> | null;
}

export const SOLUTION_MCPS: Record<string, SolutionMcp> = {
  fetch: {
    slug: "fetch",
    name: "Fetch",
    description: {
      en: "Fetch a URL and return its content as markdown (official MCP fetch server).",
      fr: "Récupère une URL et renvoie son contenu en Markdown (serveur fetch officiel MCP).",
    },
    configKeys: [],
    needs: null,
  },
  time: {
    slug: "time",
    name: "Time",
    description: {
      en: "Current time and timezone conversion. Ask for the time anywhere or convert between IANA timezones.",
      fr: "Heure actuelle et conversion de fuseaux horaires. Demandez l’heure n’importe où ou convertissez entre fuseaux IANA.",
    },
    configKeys: [],
    needs: null,
  },
  "sequential-thinking": {
    slug: "sequential-thinking",
    name: "Sequential Thinking",
    description: {
      en: "Structured step-by-step reasoning tool for breaking down complex problems.",
      fr: "Outil de raisonnement structuré, étape par étape, pour décomposer les problèmes complexes.",
    },
    configKeys: [],
    needs: null,
  },
  memory: {
    slug: "memory",
    name: "Memory",
    description: {
      en: "Persistent knowledge-graph memory the model can read and write across turns.",
      fr: "Mémoire persistante en graphe de connaissances, que le modèle lit et écrit d’un échange à l’autre.",
    },
    configKeys: [],
    needs: null,
  },
  git: {
    slug: "git",
    name: "Git",
    description: {
      en: "Inspect a Git repository inside your box — status, log, diff, show, branches. Point it at a repo you've cloned in.",
      fr: "Inspecte un dépôt Git présent dans votre box : status, log, diff, show, branches. Indiquez-lui un dépôt que vous y avez cloné.",
    },
    configKeys: ["GIT_REPOSITORY"],
    needs: {
      en: "The path of a Git repository inside your box (GIT_REPOSITORY), e.g. /workspace/home/myrepo.",
      fr: "Le chemin d’un dépôt Git présent dans votre box (GIT_REPOSITORY), par exemple /workspace/home/myrepo.",
    },
  },
  filesystem: {
    slug: "filesystem",
    name: "Filesystem",
    description: {
      en: "Read/write access to a sandboxed directory inside the box.",
      fr: "Accès en lecture et en écriture à un dossier cloisonné à l’intérieur de la box.",
    },
    configKeys: ["FILESYSTEM_PATH"],
    needs: {
      en: "The directory to expose (FILESYSTEM_PATH), e.g. /workspace/home.",
      fr: "Le dossier à exposer (FILESYSTEM_PATH), par exemple /workspace/home.",
    },
  },
  sqlite: {
    slug: "sqlite",
    name: "SQLite",
    description: {
      en: "Query and manage a SQLite database inside your box — run SQL, create tables, read and write rows. A database file is created automatically; no setup required.",
      fr: "Interroge et gère une base SQLite dans votre box : exécuter du SQL, créer des tables, lire et écrire des lignes. Le fichier de base est créé automatiquement ; aucune configuration requise.",
    },
    configKeys: [],
    needs: null,
  },
  duckduckgo: {
    slug: "duckduckgo",
    name: "DuckDuckGo Search",
    description: {
      en: "Search the web via DuckDuckGo and fetch page content as clean text. No API key — works out of the box.",
      fr: "Recherche sur le web via DuckDuckGo et récupère le contenu des pages en texte propre. Sans clé API : fonctionne tout de suite.",
    },
    configKeys: [],
    needs: null,
  },
  wikipedia: {
    slug: "wikipedia",
    name: "Wikipedia",
    description: {
      en: "Search Wikipedia and pull article summaries, sections, and links for grounded facts. No API key required.",
      fr: "Recherche dans Wikipédia et extrait résumés d’articles, sections et liens pour des faits sourcés. Sans clé API.",
    },
    configKeys: [],
    needs: null,
  },
  arxiv: {
    slug: "arxiv",
    name: "arXiv",
    description: {
      en: "Search and read arXiv research papers — full-text search with filters, fetch abstracts, and download papers as Markdown for the model to read. No API key.",
      fr: "Recherche et lit les articles scientifiques d’arXiv : recherche plein texte avec filtres, résumés, et téléchargement des articles en Markdown pour que le modèle les lise. Sans clé API.",
    },
    configKeys: [],
    needs: null,
  },
  duckdb: {
    slug: "duckdb",
    name: "DuckDB",
    description: {
      en: "Run analytical SQL over a fast in-box DuckDB database — query CSV/Parquet/JSON files directly, aggregate, and analyze. A database file is created automatically.",
      fr: "Exécute du SQL analytique sur une base DuckDB rapide, dans votre box : interroger directement des fichiers CSV, Parquet ou JSON, agréger, analyser. Le fichier de base est créé automatiquement.",
    },
    configKeys: [],
    needs: null,
  },
  postgres: {
    slug: "postgres",
    name: "PostgreSQL",
    description: {
      en: "Query and inspect a PostgreSQL database — run SQL, explore schema, and analyze indexes/health. Runs in restricted mode by default. Requires a connection string.",
      fr: "Interroge et inspecte une base PostgreSQL : exécuter du SQL, explorer le schéma, analyser les index et la santé de la base. Fonctionne en mode restreint par défaut. Nécessite une chaîne de connexion.",
    },
    configKeys: ["DATABASE_URI"],
    needs: {
      en: "A Postgres connection string (DATABASE_URI), stored as an encrypted secret.",
      fr: "Une chaîne de connexion Postgres (DATABASE_URI), stockée comme secret chiffré.",
    },
  },
  "yahoo-finance": {
    slug: "yahoo-finance",
    name: "Yahoo Finance",
    description: {
      en: "Look up stock prices, historical data, and company information via Yahoo Finance — market data the model can reason over. No API key required.",
      fr: "Consulte cours de bourse, historiques et informations sur les sociétés via Yahoo Finance : des données de marché sur lesquelles le modèle peut raisonner. Sans clé API.",
    },
    configKeys: [],
    needs: null,
  },
  coingecko: {
    slug: "coingecko",
    name: "CoinGecko",
    description: {
      en: "Live cryptocurrency prices and market data via CoinGecko — coins, exchanges, historical charts and trending. No API key required (public API).",
      fr: "Cours des cryptomonnaies en direct et données de marché via CoinGecko : cryptomonnaies, plateformes d’échange, historiques et tendances. Sans clé API (API publique).",
    },
    configKeys: [],
    needs: null,
  },
  calculator: {
    slug: "calculator",
    name: "Calculator",
    description: {
      en: "Evaluate precise mathematical expressions — arithmetic the model can rely on instead of guessing.",
      fr: "Évalue des expressions mathématiques avec précision : des calculs sur lesquels le modèle peut s’appuyer au lieu de deviner.",
    },
    configKeys: [],
    needs: null,
  },
};

/** An example request an assistant can carry out with the pack's tools. */
export interface SolutionPrompt {
  text: string;
  /** Slugs of the MCPs the request relies on (all in the pack). */
  uses: readonly string[];
  /**
   * The request only works once a repository or files are already inside the
   * box (the dashboard has no upload or clone step). Shown on the page next to
   * the prompt; solutions.test.ts requires it on every prompt that names a
   * /workspace path or relies on the Git MCP.
   */
  needsFiles?: boolean;
}

export interface SolutionFaqItem {
  q: string;
  a: string;
}

/** The copy of one solution page in one language. */
export interface SolutionCopy {
  /** URL segment under /solutions (EN) or /fr/solutions (FR). */
  slug: string;
  /** Short name, used in cards and breadcrumbs. */
  name: string;
  eyebrow: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  lead: string;
  /** Who the page is for. */
  audience: string;
  /** The problem the pack solves, one paragraph per entry. */
  problem: readonly string[];
  /** Pack-specific caveats shown under "what you bring". */
  notes: readonly string[];
  prompts: readonly SolutionPrompt[];
  faq: readonly SolutionFaqItem[];
}

export interface Solution {
  /** MCP_BUNDLES id; also the `?bundle=` value of the guided-setup link. */
  bundleId: string;
  en: SolutionCopy;
  fr: SolutionCopy;
}

export const SOLUTIONS: readonly Solution[] = [
  {
    bundleId: "essentiel",
    en: {
      slug: "essentials",
      name: "Essentials",
      eyebrow: "For every team",
      title: "The essential MCP stack for your AI assistant",
      metaTitle: "Essential MCP stack: web pages, time, memory, reasoning",
      metaDescription:
        "Four hosted MCP servers that make any AI assistant more useful on day one: read a web page, know the time in any timezone, keep a memory, reason step by step. No API key to bring.",
      lead: "Four MCP servers that close the everyday gaps of an AI assistant: it reads the page you point it at, knows what time it is in any timezone, keeps notes in a memory and works through a problem step by step. Nothing to configure.",
      audience:
        "Small teams starting with an AI assistant in Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline or Zed, who want useful tools before connecting any business system.",
      problem: [
        "Out of the box, an assistant answers from what it learned in training. It cannot open the page you mention, it guesses the time in another city, and what you told it does not stay in a structured place it can read back.",
        "This pack gives it four small tools for exactly that. None of them touches your company data or needs a key, which makes it a safe first step.",
      ],
      notes: [],
      prompts: [
        {
          text: "Fetch https://example.com/pricing and summarise the plans in five bullet points.",
          uses: ["fetch"],
        },
        {
          text: "What time is it in Tokyo right now? And what time is 3 pm in Paris for a colleague in New York?",
          uses: ["time"],
        },
        {
          text: "Remember that our fiscal year starts on 1 April and that the board meets on the first Monday of each quarter.",
          uses: ["memory"],
        },
        {
          text: "Think it through step by step: what do we need to decide, in which order, to move our newsletter to a new provider?",
          uses: ["sequential-thinking"],
        },
      ],
      faq: [
        {
          q: "Do I need an API key for any of these?",
          a: "No. Fetch, Time, Memory and Sequential Thinking install without any input. You only need your TwinMCP API key so your AI client can reach your server.",
        },
        {
          q: "Can Fetch read pages behind a login?",
          a: "No. Fetch requests the URL from your box like an anonymous visitor would, so it reads public pages. It does not use your browser session or cookies.",
        },
        {
          q: "Where does the Memory MCP keep what it stores?",
          a: "Inside your own server's isolated box, as a knowledge graph the model reads and writes through the Memory tools. Other TwinMCP accounts cannot reach it.",
        },
      ],
    },
    fr: {
      slug: "essentiel",
      name: "Essentiel",
      eyebrow: "Pour toutes les équipes",
      title: "La stack MCP essentielle pour votre assistant IA",
      metaTitle: "Stack MCP essentielle : pages web, heure, mémoire, raisonnement",
      metaDescription:
        "Quatre serveurs MCP hébergés qui rendent un assistant IA plus utile dès le premier jour : lire une page web, connaître l’heure dans n’importe quel fuseau, garder une mémoire, raisonner étape par étape. Aucune clé API à fournir.",
      lead: "Quatre serveurs MCP qui comblent les manques quotidiens d’un assistant IA : il lit la page que vous lui indiquez, connaît l’heure dans n’importe quel fuseau, garde des notes dans une mémoire et déroule un problème étape par étape. Rien à configurer.",
      audience:
        "Les petites équipes qui débutent avec un assistant IA dans Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline ou Zed, et veulent des outils utiles avant de brancher le moindre système métier.",
      problem: [
        "Tel quel, un assistant répond avec ce qu’il a appris pendant son entraînement. Il ne peut pas ouvrir la page que vous citez, il devine l’heure dans une autre ville, et ce que vous lui dites ne reste pas dans un endroit structuré qu’il peut relire.",
        "Ce pack lui donne quatre petits outils pour cela. Aucun ne touche aux données de votre entreprise ni ne demande de clé : c’est un premier pas sans risque.",
      ],
      notes: [],
      prompts: [
        {
          text: "Récupère https://example.com/tarifs et résume les offres en cinq points.",
          uses: ["fetch"],
        },
        {
          text: "Quelle heure est-il à Tokyo en ce moment ? Et à quelle heure tombe 15 h à Paris pour un collègue à New York ?",
          uses: ["time"],
        },
        {
          text: "Retiens que notre exercice comptable commence le 1er avril et que le conseil se réunit le premier lundi de chaque trimestre.",
          uses: ["memory"],
        },
        {
          text: "Réfléchis étape par étape : que devons-nous décider, et dans quel ordre, pour passer notre newsletter chez un nouveau prestataire ?",
          uses: ["sequential-thinking"],
        },
      ],
      faq: [
        {
          q: "Faut-il une clé API pour l’un de ces MCP ?",
          a: "Non. Fetch, Time, Memory et Sequential Thinking s’installent sans aucune saisie. Il vous faut seulement votre clé API TwinMCP pour que votre client IA atteigne votre serveur.",
        },
        {
          q: "Fetch peut-il lire des pages derrière une connexion ?",
          a: "Non. Fetch demande l’URL depuis votre box, comme le ferait un visiteur anonyme : il lit des pages publiques. Il n’utilise ni la session ni les cookies de votre navigateur.",
        },
        {
          q: "Où le MCP Memory garde-t-il ce qu’il enregistre ?",
          a: "Dans la box isolée de votre propre serveur, sous forme de graphe de connaissances que le modèle lit et écrit avec les outils de Memory. Les autres comptes TwinMCP n’y ont pas accès.",
        },
      ],
    },
  },
  {
    bundleId: "dev",
    en: {
      slug: "developers",
      name: "Developers",
      eyebrow: "For developers",
      title: "An MCP stack for developers: Git, files and SQLite",
      metaTitle: "MCP stack for developers: hosted Git, Filesystem and SQLite MCPs",
      metaDescription:
        "Hosted Git, Filesystem and SQLite MCP servers in an isolated box: let your AI assistant inspect a repository, read and write files and keep a working database, without running anything on your laptop.",
      lead: "Three MCP servers that give your assistant a workspace of its own: inspect a Git repository, read and write files in one directory, and keep a SQLite database. They run in your server's isolated box, not on your machine.",
      audience:
        "Developers, small agencies and technical teams who want an assistant that works on a repository and on files in a sandbox, reachable from every MCP client with the same URL.",
      problem: [
        "Running MCP servers as local processes means setting them up again on every laptop and in every client, and giving a model access to your own disk.",
        "Here the three servers run in a box that belongs to your TwinMCP server. The Filesystem MCP only sees the directory you choose, and the Git MCP only the repository you point it at.",
      ],
      notes: [
        "The Git MCP inspects a repository that is already inside your box: it does not fetch one from GitHub or GitLab, and the dashboard has no upload or clone step yet. Examples marked as needing a repository only work once one is there.",
        "Git and Filesystem each ask for a path when you install them; SQLite creates its database file on its own.",
      ],
      prompts: [
        {
          text: "Show the last ten commits of the repository and explain what changed in the most recent one.",
          uses: ["git"],
          needsFiles: true,
        },
        {
          text: "What is in the working tree diff right now? Explain each change in one sentence.",
          uses: ["git"],
          needsFiles: true,
        },
        {
          text: "Create a notes folder with a todo.md file listing these three tasks, then show me what is in the folder.",
          uses: ["filesystem"],
        },
        {
          text: "Draft release notes from the last twenty commits and save them as release-notes.md.",
          uses: ["git", "filesystem"],
          needsFiles: true,
        },
        {
          text: "Create a table bugs with id, title and status, add these three bugs, then list the open ones.",
          uses: ["sqlite"],
        },
      ],
      faq: [
        {
          q: "Can the Git MCP pull my GitHub repository?",
          a: "Not by itself. It inspects a repository that is already inside your box (status, log, diff, show, branches). It needs the repository's path in the box when you install it.",
        },
        {
          q: "Can the Filesystem MCP read my laptop?",
          a: "No. It runs in your server's box in the cloud and only sees the directory inside that box that you set as FILESYSTEM_PATH.",
        },
        {
          q: "Is the SQLite database shared with anyone?",
          a: "No. The database file lives in your server's isolated box. Other accounts, and your other servers, do not see it.",
        },
      ],
    },
    fr: {
      slug: "developpeurs",
      name: "Développeurs",
      eyebrow: "Pour les développeurs",
      title: "Une stack MCP pour développeurs : Git, fichiers et SQLite",
      metaTitle: "Stack MCP pour développeurs : MCP Git, Filesystem et SQLite hébergés",
      metaDescription:
        "Des serveurs MCP Git, Filesystem et SQLite hébergés dans une box isolée : votre assistant IA inspecte un dépôt, lit et écrit des fichiers et tient une base de travail, sans rien faire tourner sur votre poste.",
      lead: "Trois serveurs MCP qui donnent à votre assistant un espace de travail à lui : inspecter un dépôt Git, lire et écrire des fichiers dans un dossier, tenir une base SQLite. Ils tournent dans la box isolée de votre serveur, pas sur votre machine.",
      audience:
        "Les développeurs, petites agences et équipes techniques qui veulent un assistant capable de travailler sur un dépôt et sur des fichiers dans un bac à sable, joignable depuis chaque client MCP avec la même URL.",
      problem: [
        "Faire tourner des serveurs MCP en processus locaux, c’est les réinstaller sur chaque poste et dans chaque client, et donner à un modèle l’accès à votre propre disque.",
        "Ici, les trois serveurs tournent dans une box qui appartient à votre serveur TwinMCP. Le MCP Filesystem ne voit que le dossier que vous choisissez, et le MCP Git que le dépôt que vous lui indiquez.",
      ],
      notes: [
        "Le MCP Git inspecte un dépôt déjà présent dans votre box : il ne le récupère pas depuis GitHub ou GitLab, et le tableau de bord n’a pas encore d’étape d’envoi ou de clonage. Les exemples signalés comme nécessitant un dépôt ne fonctionnent qu’une fois celui-ci en place.",
        "Git et Filesystem demandent chacun un chemin à l’installation ; SQLite crée son fichier de base tout seul.",
      ],
      prompts: [
        {
          text: "Montre les dix derniers commits du dépôt et explique ce qui a changé dans le plus récent.",
          uses: ["git"],
          needsFiles: true,
        },
        {
          text: "Que contient le diff de l’arbre de travail en ce moment ? Explique chaque modification en une phrase.",
          uses: ["git"],
          needsFiles: true,
        },
        {
          text: "Crée un dossier notes avec un fichier todo.md qui liste ces trois tâches, puis montre-moi ce que contient le dossier.",
          uses: ["filesystem"],
        },
        {
          text: "Rédige des notes de version à partir des vingt derniers commits et enregistre-les dans notes-de-version.md.",
          uses: ["git", "filesystem"],
          needsFiles: true,
        },
        {
          text: "Crée une table bugs avec id, titre et statut, ajoute ces trois bugs, puis liste ceux qui sont ouverts.",
          uses: ["sqlite"],
        },
      ],
      faq: [
        {
          q: "Le MCP Git peut-il récupérer mon dépôt GitHub ?",
          a: "Pas seul. Il inspecte un dépôt déjà présent dans votre box (status, log, diff, show, branches). Il lui faut le chemin du dépôt dans la box au moment de l’installation.",
        },
        {
          q: "Le MCP Filesystem peut-il lire mon ordinateur ?",
          a: "Non. Il tourne dans la box de votre serveur, dans le cloud, et ne voit que le dossier de cette box que vous indiquez dans FILESYSTEM_PATH.",
        },
        {
          q: "La base SQLite est-elle partagée ?",
          a: "Non. Le fichier de base vit dans la box isolée de votre serveur. Les autres comptes, et vos autres serveurs, ne le voient pas.",
        },
      ],
    },
  },
  {
    bundleId: "recherche",
    en: {
      slug: "research",
      name: "Research",
      eyebrow: "For research",
      title: "An MCP stack for research: web, Wikipedia and arXiv",
      metaTitle: "MCP stack for research: DuckDuckGo, Wikipedia and arXiv MCPs",
      metaDescription:
        "Hosted DuckDuckGo, Wikipedia and arXiv MCP servers: your AI assistant searches the web, pulls encyclopedia summaries and reads research papers, with sources it can cite. No API key to bring.",
      lead: "Three MCP servers that let your assistant look things up instead of recalling them: search the web, pull Wikipedia articles, and search and read arXiv papers. No API key to bring.",
      audience:
        "Consultants, analysts, R&D and content teams who brief, compare and summarise sources every week and want the assistant to work from documents it actually retrieved.",
      problem: [
        "An assistant that answers from memory cannot tell you where a claim comes from, and it knows nothing published after its training.",
        "With these three tools it searches first and answers from what it found: web pages through DuckDuckGo, encyclopedia articles from Wikipedia, and research papers from arXiv, which it can download as Markdown and read in full.",
      ],
      notes: [
        "Results come from DuckDuckGo, Wikipedia and arXiv at the time of the call. Check the sources the assistant cites before you rely on them.",
      ],
      prompts: [
        {
          text: "Search the web for articles on the EU AI Act timeline and give me the five most relevant links, each with a one-line summary.",
          uses: ["duckduckgo"],
        },
        {
          text: "Give me the Wikipedia summary of 'Retrieval-augmented generation' and list the article's sections.",
          uses: ["wikipedia"],
        },
        {
          text: "Find recent arXiv papers on evaluating retrieval-augmented generation, list five with their abstracts, then download the first one and summarise its method.",
          uses: ["arxiv"],
        },
        {
          text: "Compare how Wikipedia defines knowledge graphs with how two arXiv papers on the topic use the term.",
          uses: ["wikipedia", "arxiv"],
        },
      ],
      faq: [
        {
          q: "Do I need a search API key?",
          a: "No. DuckDuckGo, Wikipedia and arXiv all install without any input. You only need your TwinMCP API key so your AI client can reach your server.",
        },
        {
          q: "Where do downloaded papers go?",
          a: "Into your server's box, under /workspace/home/arxiv by default. You can set another path in the arXiv MCP's optional ARXIV_STORAGE_PATH field.",
        },
        {
          q: "Can it read paywalled journals?",
          a: "No. These tools reach public sources: web pages DuckDuckGo returns, Wikipedia, and papers published on arXiv.",
        },
      ],
    },
    fr: {
      slug: "recherche",
      name: "Recherche",
      eyebrow: "Pour la recherche",
      title: "Une stack MCP pour la recherche : web, Wikipédia et arXiv",
      metaTitle: "Stack MCP pour la recherche : MCP DuckDuckGo, Wikipédia et arXiv",
      metaDescription:
        "Des serveurs MCP DuckDuckGo, Wikipédia et arXiv hébergés : votre assistant IA cherche sur le web, extrait des articles encyclopédiques et lit des publications scientifiques, avec des sources qu’il peut citer. Aucune clé API à fournir.",
      lead: "Trois serveurs MCP qui permettent à votre assistant de chercher au lieu de se souvenir : recherche web, articles Wikipédia, recherche et lecture d’articles arXiv. Aucune clé API à fournir.",
      audience:
        "Les consultants, analystes, équipes R&D et équipes de contenu qui préparent des notes, comparent et résument des sources chaque semaine, et veulent que l’assistant travaille sur des documents qu’il a réellement récupérés.",
      problem: [
        "Un assistant qui répond de mémoire ne peut pas dire d’où vient une affirmation, et il ignore tout ce qui a été publié après son entraînement.",
        "Avec ces trois outils, il cherche d’abord et répond à partir de ce qu’il a trouvé : des pages web via DuckDuckGo, des articles de Wikipédia et des publications d’arXiv, qu’il peut télécharger en Markdown et lire en entier.",
      ],
      notes: [
        "Les résultats viennent de DuckDuckGo, de Wikipédia et d’arXiv au moment de l’appel. Vérifiez les sources citées par l’assistant avant de vous y fier.",
      ],
      prompts: [
        {
          text: "Cherche sur le web des articles sur le calendrier de l’AI Act européen et donne-moi les cinq liens les plus pertinents, chacun avec un résumé d’une ligne.",
          uses: ["duckduckgo"],
        },
        {
          text: "Donne-moi le résumé Wikipédia de « Génération augmentée par récupération » et liste les sections de l’article.",
          uses: ["wikipedia"],
        },
        {
          text: "Trouve des articles arXiv récents sur l’évaluation de la génération augmentée par récupération, liste-en cinq avec leur résumé, puis télécharge le premier et résume sa méthode.",
          uses: ["arxiv"],
        },
        {
          text: "Compare la définition des graphes de connaissances sur Wikipédia avec l’usage du terme dans deux articles arXiv sur le sujet.",
          uses: ["wikipedia", "arxiv"],
        },
      ],
      faq: [
        {
          q: "Faut-il une clé d’API de recherche ?",
          a: "Non. DuckDuckGo, Wikipédia et arXiv s’installent sans aucune saisie. Il vous faut seulement votre clé API TwinMCP pour que votre client IA atteigne votre serveur.",
        },
        {
          q: "Où vont les articles téléchargés ?",
          a: "Dans la box de votre serveur, sous /workspace/home/arxiv par défaut. Vous pouvez indiquer un autre chemin dans le champ facultatif ARXIV_STORAGE_PATH du MCP arXiv.",
        },
        {
          q: "Peut-il lire des revues payantes ?",
          a: "Non. Ces outils atteignent des sources publiques : les pages web renvoyées par DuckDuckGo, Wikipédia et les articles publiés sur arXiv.",
        },
      ],
    },
  },
  {
    bundleId: "data",
    en: {
      slug: "data",
      name: "Data",
      eyebrow: "For data teams",
      title: "An MCP stack for data: DuckDB and PostgreSQL",
      metaTitle: "MCP stack for data teams: hosted DuckDB and PostgreSQL MCPs",
      metaDescription:
        "Hosted DuckDB and PostgreSQL MCP servers: your AI assistant runs analytical SQL over CSV, Parquet and JSON files and queries your Postgres database in restricted mode. Bring one connection string.",
      lead: "Two MCP servers that let your assistant answer questions with SQL instead of estimates: DuckDB for files and quick analysis, PostgreSQL for your production or reporting database, in restricted mode by default.",
      audience:
        "Operations, finance and data people in SMEs who have a Postgres database and CSV exports, and want answers without writing every query themselves.",
      problem: [
        "Most data questions in a small company wait for the one person who knows SQL and the schema.",
        "With these two servers the assistant explores the schema, writes the query, runs it and explains the result. DuckDB reads CSV, Parquet and JSON files directly; the PostgreSQL MCP connects to your database with the connection string you provide, and runs in restricted mode by default.",
      ],
      notes: [
        "Your Postgres database must accept connections from the internet: the MCP runs in a cloud box, not on your network. Use a dedicated read-only database user.",
        "DuckDB reads files inside your box or at a public HTTPS link. This pack has no way to upload a file into the box, so share an export as a link.",
      ],
      prompts: [
        {
          text: "Which tables are in the public schema, and what are the columns of the orders table?",
          uses: ["postgres"],
        },
        {
          text: "How many orders were placed each week over the last three months? Show the query you ran.",
          uses: ["postgres"],
        },
        {
          text: "Check the indexes and health of this database and tell me what you would change, without changing anything.",
          uses: ["postgres"],
        },
        {
          text: "Read the CSV at the public HTTPS link I paste with read_csv_auto, then give me revenue per month and the ten largest customers.",
          uses: ["duckdb"],
        },
      ],
      faq: [
        {
          q: "Can the assistant modify my Postgres data?",
          a: "The PostgreSQL MCP runs in restricted mode by default. Connect it with a database user that only has read permissions, and the database itself enforces that it cannot write.",
        },
        {
          q: "Where is my connection string stored?",
          a: "In the MCP's config, as a secret encrypted at rest with AES-256-GCM. It is only used by that MCP on your server.",
        },
        {
          q: "My database is only reachable from our office network. Will it work?",
          a: "Not as is. The MCP runs in a TwinMCP box in the cloud, so the database must accept connections from the internet, ideally with TLS and a dedicated user.",
        },
      ],
    },
    fr: {
      slug: "data",
      name: "Data",
      eyebrow: "Pour les équipes data",
      title: "Une stack MCP pour la data : DuckDB et PostgreSQL",
      metaTitle: "Stack MCP pour les équipes data : MCP DuckDB et PostgreSQL hébergés",
      metaDescription:
        "Des serveurs MCP DuckDB et PostgreSQL hébergés : votre assistant IA exécute du SQL analytique sur des fichiers CSV, Parquet et JSON et interroge votre base Postgres en mode restreint. Une chaîne de connexion à fournir.",
      lead: "Deux serveurs MCP qui permettent à votre assistant de répondre avec du SQL plutôt qu’avec des estimations : DuckDB pour les fichiers et l’analyse rapide, PostgreSQL pour votre base de production ou de reporting, en mode restreint par défaut.",
      audience:
        "Les équipes opérations, finance et data des PME qui ont une base Postgres et des exports CSV, et veulent des réponses sans écrire chaque requête elles-mêmes.",
      problem: [
        "Dans une petite entreprise, la plupart des questions sur les données attendent la seule personne qui connaît le SQL et le schéma.",
        "Avec ces deux serveurs, l’assistant explore le schéma, écrit la requête, l’exécute et explique le résultat. DuckDB lit directement les fichiers CSV, Parquet et JSON ; le MCP PostgreSQL se connecte à votre base avec la chaîne de connexion que vous fournissez, en mode restreint par défaut.",
      ],
      notes: [
        "Votre base Postgres doit accepter des connexions depuis internet : le MCP tourne dans une box dans le cloud, pas sur votre réseau. Utilisez un utilisateur de base dédié, en lecture seule.",
        "DuckDB lit des fichiers présents dans votre box ou accessibles par un lien HTTPS public. Ce pack ne permet pas d’envoyer un fichier dans la box : partagez l’export sous forme de lien.",
      ],
      prompts: [
        {
          text: "Quelles tables y a-t-il dans le schéma public, et quelles sont les colonnes de la table orders ?",
          uses: ["postgres"],
        },
        {
          text: "Combien de commandes ont été passées chaque semaine sur les trois derniers mois ? Montre la requête exécutée.",
          uses: ["postgres"],
        },
        {
          text: "Vérifie les index et la santé de cette base et dis-moi ce que tu changerais, sans rien modifier.",
          uses: ["postgres"],
        },
        {
          text: "Lis avec read_csv_auto le CSV du lien HTTPS public que je colle, puis donne-moi le chiffre d’affaires par mois et les dix plus gros clients.",
          uses: ["duckdb"],
        },
      ],
      faq: [
        {
          q: "L’assistant peut-il modifier mes données Postgres ?",
          a: "Le MCP PostgreSQL fonctionne en mode restreint par défaut. Connectez-le avec un utilisateur qui n’a que des droits de lecture : c’est alors la base elle-même qui l’empêche d’écrire.",
        },
        {
          q: "Où est stockée ma chaîne de connexion ?",
          a: "Dans la configuration du MCP, comme secret chiffré au repos en AES-256-GCM. Elle n’est utilisée que par ce MCP, sur votre serveur.",
        },
        {
          q: "Ma base n’est joignable que depuis le réseau du bureau. Est-ce que ça marche ?",
          a: "Pas en l’état. Le MCP tourne dans une box TwinMCP dans le cloud : la base doit accepter des connexions depuis internet, idéalement en TLS et avec un utilisateur dédié.",
        },
      ],
    },
  },
  {
    bundleId: "finance",
    en: {
      slug: "finance",
      name: "Finance",
      eyebrow: "For finance teams",
      title: "An MCP stack for finance teams: market data and exact math",
      metaTitle: "MCP stack for finance teams: Yahoo Finance, CoinGecko and Calculator MCPs",
      metaDescription:
        "Hosted Yahoo Finance, CoinGecko and Calculator MCP servers: your AI assistant looks up stock and crypto prices, history and company information, and does the arithmetic exactly. No API key to bring.",
      lead: "Three MCP servers for questions about markets and numbers: stock prices, history and company information from Yahoo Finance, crypto market data from CoinGecko, and a calculator so the arithmetic is computed, not guessed.",
      audience:
        "Finance and accounting teams, treasurers and founders who follow listed companies or crypto assets and want quick, sourced figures in their AI assistant.",
      problem: [
        "Ask an assistant for a share price and it may answer with a figure from its training data. Ask it for a percentage change and it may get the arithmetic wrong.",
        "This pack lets it look the figures up at the time you ask, from Yahoo Finance and CoinGecko, and compute with a calculator tool.",
      ],
      notes: [
        "Prices are what Yahoo Finance and CoinGecko return at the time of the call. Check them before you act on them; nothing here is investment advice.",
      ],
      prompts: [
        {
          text: "Give me the daily closing prices of ASML over the last 30 days, with the high, the low and the change in percent.",
          uses: ["yahoo-finance", "calculator"],
        },
        {
          text: "Show me the company information Yahoo Finance has for AI.PA: sector, industry and business summary.",
          uses: ["yahoo-finance"],
        },
        {
          text: "What are the current prices of Bitcoin and Ether in euros, and which coins are trending on CoinGecko today?",
          uses: ["coingecko"],
        },
        {
          text: "I bought 120 shares at 41.30 and the price is now 47.85. What is my gain, in euros and in percent?",
          uses: ["calculator"],
        },
      ],
      faq: [
        {
          q: "Do I need a market data subscription?",
          a: "No. Yahoo Finance and CoinGecko install without any input and use public data; the Calculator needs nothing either. You only need your TwinMCP API key so your AI client can reach your server.",
        },
        {
          q: "Can it connect to our bank or accounting software?",
          a: "Not with this pack. It covers public market data and arithmetic. Other catalogue MCPs, or your own npm or PyPI MCP once your account is funded, can be added to the same server; ask about it in a guided setup.",
        },
        {
          q: "Is this investment advice?",
          a: "No. The tools return data from public sources; what you do with it is your decision.",
        },
      ],
    },
    fr: {
      slug: "finance",
      name: "Finance",
      eyebrow: "Pour les équipes finance",
      title: "Une stack MCP pour les équipes finance : données de marché et calcul exact",
      metaTitle: "Stack MCP pour les équipes finance : MCP Yahoo Finance, CoinGecko et Calculator",
      metaDescription:
        "Des serveurs MCP Yahoo Finance, CoinGecko et Calculator hébergés : votre assistant IA consulte cours, historiques et informations sur les sociétés et les cryptomonnaies, et fait les calculs exactement. Aucune clé API à fournir.",
      lead: "Trois serveurs MCP pour les questions de marchés et de chiffres : cours, historiques et informations sur les sociétés via Yahoo Finance, données de marché crypto via CoinGecko, et une calculatrice pour que les calculs soient faits, pas devinés.",
      audience:
        "Les équipes finance et comptabilité, les trésoriers et les dirigeants qui suivent des sociétés cotées ou des cryptoactifs et veulent des chiffres rapides et sourcés dans leur assistant IA.",
      problem: [
        "Demandez un cours de bourse à un assistant : il peut répondre avec un chiffre tiré de son entraînement. Demandez-lui une variation en pourcentage : il peut se tromper dans le calcul.",
        "Ce pack lui permet de chercher les chiffres au moment où vous posez la question, via Yahoo Finance et CoinGecko, et de calculer avec un outil de calcul.",
      ],
      notes: [
        "Les cours sont ceux que Yahoo Finance et CoinGecko renvoient au moment de l’appel. Vérifiez-les avant d’agir ; rien ici n’est un conseil en investissement.",
      ],
      prompts: [
        {
          text: "Donne-moi les cours de clôture quotidiens d’ASML sur les 30 derniers jours, avec le plus haut, le plus bas et la variation en pourcentage.",
          uses: ["yahoo-finance", "calculator"],
        },
        {
          text: "Montre-moi les informations que Yahoo Finance a sur AI.PA : secteur, industrie et description de l’activité.",
          uses: ["yahoo-finance"],
        },
        {
          text: "Quels sont les cours actuels du Bitcoin et de l’Ether en euros, et quelles cryptomonnaies sont en tendance sur CoinGecko aujourd’hui ?",
          uses: ["coingecko"],
        },
        {
          text: "J’ai acheté 120 actions à 41,30 et le cours est maintenant de 47,85. Quel est mon gain, en euros et en pourcentage ?",
          uses: ["calculator"],
        },
      ],
      faq: [
        {
          q: "Faut-il un abonnement à des données de marché ?",
          a: "Non. Yahoo Finance et CoinGecko s’installent sans aucune saisie et utilisent des données publiques ; Calculator non plus ne demande rien. Il vous faut seulement votre clé API TwinMCP pour que votre client IA atteigne votre serveur.",
        },
        {
          q: "Peut-il se connecter à notre banque ou à notre logiciel comptable ?",
          a: "Pas avec ce pack. Il couvre les données de marché publiques et le calcul. D’autres MCP du catalogue, ou votre propre MCP npm ou PyPI une fois votre compte alimenté, peuvent être ajoutés au même serveur ; parlez-en lors d’une installation accompagnée.",
        },
        {
          q: "Est-ce un conseil en investissement ?",
          a: "Non. Les outils renvoient des données de sources publiques ; ce que vous en faites relève de votre décision.",
        },
      ],
    },
  },
];

// ─── Paths & helpers ─────────────────────────────────────────────────────────

export const SOLUTIONS_INDEX_PATHS: Localized<string> = {
  en: "/solutions",
  fr: "/fr/solutions",
};

const DEMO_BASE: Localized<string> = { en: "/demo", fr: "/fr/demo" };
const SIGN_UP_BASE: Localized<string> = { en: "/sign-up", fr: "/fr/inscription" };

/** The page path of a solution in `locale`, e.g. "/fr/solutions/developpeurs". */
export function solutionPath(solution: Solution, locale: Locale): string {
  return `${SOLUTIONS_INDEX_PATHS[locale]}/${solution[locale].slug}`;
}

/** The solution whose `locale` slug is `slug`, or undefined. */
export function getSolutionBySlug(slug: string, locale: Locale): Solution | undefined {
  return SOLUTIONS.find((s) => s[locale].slug === slug);
}

/** The solution built on MCP_BUNDLES id `bundleId` (the `?bundle=` of /demo), or undefined. */
export function solutionForBundle(bundleId: string | undefined): Solution | undefined {
  return bundleId ? SOLUTIONS.find((s) => s.bundleId === bundleId) : undefined;
}

/** What the guided-setup form shows for a pack: its name and its MCPs, in `locale`. */
export function demoPackSummary(
  bundleId: string | undefined,
  locale: Locale
): { id: string; name: string; mcps: string[] } | undefined {
  const solution = solutionForBundle(bundleId);
  if (!solution) return undefined;
  return {
    id: solution.bundleId,
    name: solution[locale].name,
    mcps: solutionMcps(solution).map((m) => m.name),
  };
}

/** Every page slug in `locale`, for generateStaticParams. */
export function solutionSlugs(locale: Locale): string[] {
  return SOLUTIONS.map((s) => s[locale].slug);
}

/** The pack's MCPs, in MCP_BUNDLES order. Throws on an unknown bundle or MCP. */
export function solutionMcps(solution: Solution): SolutionMcp[] {
  const bundle = getBundle(solution.bundleId);
  if (!bundle) throw new Error(`Unknown MCP bundle: ${solution.bundleId}`);
  return bundle.slugs.map((slug) => {
    const mcp = SOLUTION_MCPS[slug];
    if (!mcp) throw new Error(`No solution copy for MCP: ${slug}`);
    return mcp;
  });
}

/** The pack's MCPs that need something from the customer. */
export function mcpsNeedingInput(solution: Solution): SolutionMcp[] {
  return solutionMcps(solution).filter((m) => m.configKeys.length > 0);
}

/** The guided-setup link, pre-tagged with the pack (?bundle=<MCP_BUNDLES id>). */
export function guidedSetupHref(solution: Solution, locale: Locale): string {
  return `${DEMO_BASE[locale]}?bundle=${encodeURIComponent(solution.bundleId)}`;
}

/**
 * Sign-up link for the self-serve path. Since the prepaid wallet replaced the
 * subscription (2026-10-29) there is no plan to pick at sign-up: every account
 * starts on the sign-up credit, so the plan intent is accepted and ignored
 * (?plan=pro used to resume a Pro checkout after sign-up).
 */
export function signUpHref(locale: Locale, _plan?: "free" | "pro"): string {
  return SIGN_UP_BASE[locale];
}

/** Canonical + hreflang alternates (symmetric pairs, x-default = English). */
export function solutionAlternates(
  solution: Solution | null,
  locale: Locale
): { canonical: string; languages: Record<"en" | "fr" | "x-default", string> } {
  const en = solution ? solutionPath(solution, "en") : SOLUTIONS_INDEX_PATHS.en;
  const fr = solution ? solutionPath(solution, "fr") : SOLUTIONS_INDEX_PATHS.fr;
  return {
    canonical: locale === "fr" ? fr : en,
    languages: { en, fr, "x-default": en },
  };
}
