// Interface strings of the MCP catalogue pages (EN /servers, FR /fr/serveurs).
// The per-MCP content itself comes from lib/seo/server-pages.ts.

import type { Locale } from "@/lib/i18n/locales";
import { LOCAL_AGENT } from "@/lib/seo/server-pages";
import { walletFacts } from "@/components/pricing/wallet-copy";

const EN = walletFacts("en");
const FR = walletFacts("fr");

export const COPY = {
  en: {
    home: "Home",
    homeHref: "/",
    catalogue: "MCP servers",
    // Index
    indexEyebrow: "Model Context Protocol",
    indexTitle: "MCP server catalogue",
    indexLead:
      "Every MCP server you can install on TwinMCP, with the keys each one needs, where to get them, and a copy-paste config for every client.",
    indexMetaTitle: "MCP server catalogue: host any MCP · TwinMCP",
    indexMetaDescription: (n: number) =>
      `${n} MCP servers you can host on TwinMCP: what each one does, the keys it needs, and copy-paste config for Cursor, Claude, VS Code, Windsurf, Cline and Zed.`,
    countLine: (n: number, cats: number, clients: number) =>
      `${n} MCP servers · ${cats} categories · ${clients} clients`,
    serverCount: (n: number) => `${n} server${n === 1 ? "" : "s"}`,
    noKey: "No API key",
    needsKey: "API key",
    needsSetting: "Setting required",
    local: "Runs locally",
    guide: "Hosting guide →",
    indexCtaTitle: "Host any of these MCP servers",
    jumpTo: "Jump to a category",
    unlocks: "Unlocks with first top-up",
    unlocksText:
      "This MCP runs shell commands, code or a headless browser, so it unlocks with your first top-up. Everything else in the catalogue runs on the free credit.",
    ownTitle: "Not in the catalogue?",
    ownText:
      "Once your account is funded (after a first top-up), you can publish your own MCP server from an npm or PyPI package and host it the same way.",
    // Server page
    whatItDoes: "What it does",
    packageLabel: "Package",
    commandLabel: "TwinMCP starts it with",
    upstream: "upstream repository ↗",
    pinnedNote: (v: string) =>
      `Pinned to ${v}: a new upstream release is not picked up until the catalogue is updated.`,
    latestNote: "No pin: the launcher resolves the latest published release.",
    keysTitle: "Keys and settings",
    keysLead: "Entered once, when you install it. Secret values are stored encrypted.",
    noKeysText: "Nothing to configure: no API key, no setting. Install it and connect your client.",
    colField: "Name",
    colStatus: "Status",
    colWhere: "What it is and where to get it",
    required: "Required",
    optional: "Optional",
    secret: "Secret",
    localTitle: "Runs on your machine",
    localText: (name: string) =>
      `${name} is a local tool: it runs on your own computer, not in a TwinMCP box. Create a Local (agent) server and keep ${LOCAL_AGENT.en} running; TwinMCP relays your client's requests to it.`,
    stepsTitle: "Set it up on TwinMCP in 3 steps",
    connectTitle: "Connect snippets",
    connectLead: (url: string) =>
      `Replace my-server with your server's slug and the placeholder with your API key. Per-MCP URL: ${url}`,
    tabsLabel: "MCP client",
    clientGuide: (client: string) => `Full ${client} guide →`,
    serverUrlNote: (url: string) =>
      `Several MCPs on one server? Connect them all at once with the server URL ${url}: tools are prefixed with the MCP slug, and ?mode=router lists three meta-tools instead of every tool.`,
    faqTitle: "FAQ",
    relatedTitle: "Related MCP servers",
    readingTitle: "Related reading",
    clientsTitle: (name: string) => `${name} in your client`,
    ctaEyebrow: "Managed MCP hosting",
    ctaTitle: (name: string) => `Host ${name} on TwinMCP`,
    ctaText: `${EN.signupCredit} of free credit at sign-up, no credit card. Then pay only for what you use.`,
    ctaPrimary: `Start with ${EN.signupCredit} free`,
    ctaSecondary: "See pricing",
    // Client page
    setupGuide: "Setup guide",
    configTitle: (client: string) => `The ${client} config`,
    commandTitle: (client: string) => `The ${client} command`,
    aboutClientTitle: (client: string, name: string) => `${name} in ${client}: what to know`,
    clientStepsTitle: "Step by step",
    troubleshootingTitle: "Troubleshooting",
    troubleshootingMore: "All errors and fixes in the docs →",
    otherClients: (name: string) => `${name} in other clients`,
    sameClient: (client: string) => `Other MCP servers in ${client}`,
    fullGuide: (name: string) => `${name}: hosting guide`,
  },
  fr: {
    home: "Accueil",
    homeHref: "/fr",
    catalogue: "Serveurs MCP",
    indexEyebrow: "Model Context Protocol",
    indexTitle: "Catalogue de serveurs MCP",
    indexLead:
      "Tous les serveurs MCP que vous pouvez installer sur TwinMCP, avec les clés que chacun demande, où les obtenir, et une configuration à copier pour chaque client.",
    indexMetaTitle: "Catalogue de serveurs MCP à héberger · TwinMCP",
    indexMetaDescription: (n: number) =>
      `${n} serveurs MCP à héberger sur TwinMCP : ce que fait chacun, les clés à fournir et la configuration pour Cursor, Claude, VS Code, Windsurf, Cline et Zed.`,
    countLine: (n: number, cats: number, clients: number) =>
      `${n} serveurs MCP · ${cats} catégories · ${clients} clients`,
    serverCount: (n: number) => `${n} serveur${n > 1 ? "s" : ""}`,
    noKey: "Sans clé API",
    needsKey: "Clé API",
    needsSetting: "Réglage requis",
    local: "En local",
    guide: "Guide d’hébergement →",
    indexCtaTitle: "Hébergez n’importe lequel de ces serveurs MCP",
    jumpTo: "Aller à une catégorie",
    unlocks: "Débloqué à la première recharge",
    unlocksText:
      "Ce MCP exécute des commandes shell, du code ou un navigateur headless : il se débloque à la première recharge. Tout le reste du catalogue fonctionne avec le crédit offert.",
    ownTitle: "Absent du catalogue ?",
    ownText:
      "Une fois votre compte alimenté (après une première recharge), vous pouvez publier votre propre serveur MCP à partir d’un paquet npm ou PyPI et l’héberger de la même façon.",
    whatItDoes: "Ce qu’il fait",
    packageLabel: "Paquet",
    commandLabel: "TwinMCP le lance avec",
    upstream: "dépôt source ↗",
    pinnedNote: (v: string) =>
      `Version ${v} épinglée : une nouvelle version publiée en amont n’est prise qu’après mise à jour du catalogue.`,
    latestNote: "Sans épinglage : le lanceur résout la dernière version publiée.",
    keysTitle: "Clés et réglages",
    keysLead: "À saisir une fois, à l’installation. Les valeurs secrètes sont stockées chiffrées.",
    noKeysText:
      "Rien à configurer : ni clé API, ni réglage. Installez-le et connectez votre client.",
    colField: "Nom",
    colStatus: "Statut",
    colWhere: "Ce que c’est et où l’obtenir",
    required: "Requis",
    optional: "Facultatif",
    secret: "Secret",
    localTitle: "S’exécute sur votre machine",
    localText: (name: string) =>
      `${name} est un outil local : il tourne sur votre propre ordinateur, pas dans une box TwinMCP. Créez un serveur Local (agent) et laissez tourner ${LOCAL_AGENT.fr} ; TwinMCP lui relaie les requêtes de votre client.`,
    stepsTitle: "Le mettre en place sur TwinMCP en 3 étapes",
    connectTitle: "Blocs de connexion",
    connectLead: (url: string) =>
      `Remplacez mon-serveur par le slug de votre serveur et le modèle par votre clé API. URL du MCP : ${url}`,
    tabsLabel: "Client MCP",
    clientGuide: (client: string) => `Guide complet ${client} →`,
    serverUrlNote: (url: string) =>
      `Plusieurs MCP sur un même serveur ? Connectez-les tous d’un coup avec l’URL du serveur ${url} : les outils sont préfixés par le slug du MCP, et ?mode=router n’expose que trois méta-outils au lieu de tous les outils.`,
    faqTitle: "Questions fréquentes",
    relatedTitle: "Serveurs MCP proches",
    readingTitle: "À lire aussi",
    clientsTitle: (name: string) => `${name} dans votre client`,
    ctaEyebrow: "Hébergement MCP géré",
    ctaTitle: (name: string) => `Hébergez ${name} sur TwinMCP`,
    ctaText: `${FR.signupCredit} de crédit offert à l’inscription, sans carte bancaire. Ensuite, vous ne payez que ce que vous utilisez.`,
    ctaPrimary: `Démarrer avec ${FR.signupCredit} offerts`,
    ctaSecondary: "Voir les tarifs",
    setupGuide: "Guide d’installation",
    configTitle: (client: string) => `La configuration ${client}`,
    commandTitle: (client: string) => `La commande ${client}`,
    aboutClientTitle: (client: string, name: string) => `${name} dans ${client} : l’essentiel`,
    clientStepsTitle: "Pas à pas",
    troubleshootingTitle: "Dépannage",
    troubleshootingMore: "Toutes les erreurs et leurs solutions dans la doc →",
    otherClients: (name: string) => `${name} dans les autres clients`,
    sameClient: (client: string) => `Autres serveurs MCP dans ${client}`,
    fullGuide: (name: string) => `${name} : guide d’hébergement`,
  },
} as const;

export type Copy = (typeof COPY)[Locale];
