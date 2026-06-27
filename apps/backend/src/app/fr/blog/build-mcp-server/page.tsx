import type { Metadata, Route } from "next";
import Link from "next/link";
import { FrPostLayout } from "@/components/blog/fr-post-layout";
import { faqPageSchema, howToSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const post = {
  slug: "build-mcp-server",
  title: "Comment construire un serveur Model Context Protocol (étape par étape)",
  description:
    "Construisez un serveur MCP fonctionnel depuis zéro en TypeScript : outils, ressources, prompts, transport, déploiement, et connexion à Cursor et Claude Code. Code complet, aucun raccourci.",
  publishedAt: "2026-05-10",
  readingTimeMinutes: 18,
  tags: ["mcp", "tutoriel", "typescript", "sdk"],
};

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: "/fr/blog/build-mcp-server",
    languages: {
      en: "/blog/build-mcp-server",
      fr: "/fr/blog/build-mcp-server",
      "x-default": "/blog/build-mcp-server",
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/fr/blog/build-mcp-server`,
    publishedTime: post.publishedAt,
    locale: "fr_FR",
  },
};

const tutorial = howToSchema({
  name: "Construire un serveur Model Context Protocol en TypeScript",
  description:
    "Tutoriel étape par étape pour construire, tester et déployer un serveur MCP en TypeScript et le connecter à Cursor et Claude Code.",
  totalTime: "PT45M",
  steps: [
    {
      name: "Initialiser un projet TypeScript",
      text: "Créez un nouveau projet npm et ajoutez la dépendance officielle @modelcontextprotocol/sdk avec TypeScript et tsx.",
    },
    {
      name: "Définir le serveur et ses capacités",
      text: "Instanciez le Server MCP, déclarez quelles capacités (tools, resources, prompts) il annonce, et reliez-le à un transport.",
    },
    {
      name: "Ajouter un outil que le modèle peut appeler",
      text: "Enregistrez un tool avec un nom, une description et un schéma Zod pour ses paramètres. Implémentez le handler qui retourne du contenu structuré.",
    },
    {
      name: "Ajouter une ressource que l'IA peut lire",
      text: "Enregistrez un schéma d'URI de ressource et retournez le contenu à la demande. Les ressources sont des données en lecture seule que le modèle peut récupérer dans le contexte.",
    },
    {
      name: "Ajouter un template de prompt",
      text: "Définissez un prompt réutilisable que l'utilisateur peut déclencher depuis l'UI de l'host avec des arguments substitués dans une conversation templatée.",
    },
    {
      name: "Lancer le serveur avec le MCP Inspector",
      text: "Utilisez l'Inspector officiel du projet MCP pour vérifier que votre serveur annonce les capacités correctement et que les tools s'exécutent comme attendu.",
    },
    {
      name: "Connecter le serveur à Cursor et Claude Code",
      text: "Ajoutez le serveur à la config MCP de chaque host (transport stdio pour le dev local), redémarrez, et vérifiez que les tools apparaissent dans le catalogue du modèle.",
    },
    {
      name: "Déployer avec le transport HTTP",
      text: "Basculez le transport de stdio à HTTP, packagez le serveur, et déployez-le sur un runtime géré ou un conteneur auto-hébergé pour que plusieurs développeurs puissent le partager.",
    },
  ],
});

const faq = [
  {
    q: "Quel langage utiliser pour construire un serveur MCP ?",
    a: "Les SDKs MCP officiels couvrent TypeScript, Python, C#, Java, Kotlin, Ruby et Swift ; des SDKs communautaires existent pour Go, Rust, PHP et d'autres. TypeScript et Python ont le plus d'exemples en production et le plus petit écart entre dev local et déploiement. Choisissez le langage de votre backend existant.",
  },
  {
    q: "Faut-il connaître JSON-RPC pour construire un serveur MCP ?",
    a: "Non. Les SDKs cachent JSON-RPC entièrement. Vous déclarez tools, resources et prompts avec des helpers de haut niveau ; le SDK gère le framing des messages, les IDs de requête et l'encodage des erreurs.",
  },
  {
    q: "Combien de temps pour construire un serveur MCP qui marche ?",
    a: "Un serveur minimal avec un seul tool peut fonctionner de bout en bout en moins de 30 minutes. Un serveur production-ready avec auth, retries, logging et tests prend généralement quelques jours, selon ce que le tool enveloppe.",
  },
  {
    q: "Puis-je utiliser mes bibliothèques client API existantes dans un serveur MCP ?",
    a: "Oui. Un serveur MCP n'est qu'un processus Node.js ou Python. Vous pouvez importer n'importe quel SDK, taper n'importe quelle base de données, parler à n'importe quel service interne. La couche MCP n'enveloppe que la surface publique que vous exposez au client IA.",
  },
  {
    q: "Comment tester un serveur MCP sans modèle IA ?",
    a: "Utilisez le MCP Inspector, le débogueur officiel du projet. Il se connecte à votre serveur comme un vrai client, liste les capacités déclarées et vous laisse déclencher les appels d'outils manuellement. Vous validez tout le contrat du serveur sans jamais payer de tokens LLM.",
  },
];

const related = [
  {
    slug: "what-is-mcp",
    title: "Qu'est-ce que Model Context Protocol ? Le guide complet 2026",
    description: "MCP expliqué depuis zéro — fondamentaux, architecture, exemples concrets.",
    readingTimeMinutes: 14,
  },
  {
    slug: "mcp-server-hosting",
    title: "Hébergement de serveurs MCP en 2026 : auto-hébergé vs géré",
    description:
      "Comparaison des 5 options d'hébergement avec chiffres réels et critères de décision.",
    readingTimeMinutes: 16,
  },
];

export default function Post() {
  return (
    <FrPostLayout post={post} related={related} extraSchemas={[tutorial, faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Ce tutoriel parcourt la construction d&apos;un serveur Model Context
        Protocol fonctionnel depuis un dossier vide. Nous utilisons TypeScript et le package
        officiel <code>@modelcontextprotocol/sdk</code>. À la fin vous avez un serveur qui expose un
        tool, une ressource et un prompt ; vous l&apos;avez testé avec l&apos;Inspector ; vous
        l&apos;avez connecté à Cursor et Claude Code via stdio ; et vous l&apos;avez déployé en HTTP
        pour que d&apos;autres puissent l&apos;utiliser. Temps total : environ 45 minutes.
      </p>

      <h2 id="what-youll-build">Ce que vous allez construire</h2>
      <p>
        Un serveur météo. L&apos;exemple est délibérément assez petit pour tenir dans un seul
        fichier et assez concret pour servir de template. Il expose :
      </p>
      <ul>
        <li>
          <strong>Un tool</strong> : <code>get_forecast(latitude, longitude)</code> &mdash; retourne
          une prévision sur 3 jours depuis une API météo publique.
        </li>
        <li>
          <strong>Une ressource</strong> : <code>weather://stations/&lt;id&gt;</code> &mdash;
          retourne les métadonnées d&apos;une station météo spécifique.
        </li>
        <li>
          <strong>Un prompt</strong> : <code>/plan-trip &lt;ville&gt;</code> &mdash; un prompt
          templaté qui demande au modèle de rédiger un plan de voyage informé par la météo.
        </li>
      </ul>
      <p>
        Tout ce que vous écrivez ici se généralise directement : remplacez l&apos;API météo par
        votre propre service, étendez le schéma, et vous avez livré votre premier MCP interne.
      </p>

      <h2 id="prerequisites">Prérequis</h2>
      <ul>
        <li>Node.js 20 ou plus récent.</li>
        <li>Un host IA installé localement &mdash; Cursor, Claude Code ou Claude Desktop.</li>
        <li>Familiarité avec TypeScript et async/await. Aucune expérience MCP requise.</li>
        <li>
          Pour cet exemple, nous utilisons{" "}
          <a href="https://open-meteo.com" rel="noopener noreferrer" target="_blank">
            Open-Meteo
          </a>{" "}
          (qui ne demande pas de clé pour usage non commercial), pour garder l&apos;exemple
          portable.
        </li>
      </ul>

      <h2 id="step-1">Étape 1 &mdash; Initialiser le projet</h2>
      <pre>
        <code>{`mkdir mcp-weather && cd mcp-weather
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node
npx tsc --init`}</code>
      </pre>
      <p>
        Modifiez <code>tsconfig.json</code> pour cibler du Node moderne (target ES2022, module
        Node16, strict). Dans <code>package.json</code>, ajoutez <code>{`"type": "module"`}</code>{" "}
        et quelques scripts :
      </p>
      <pre>
        <code>{`{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}`}</code>
      </pre>

      <h2 id="step-2">Étape 2 &mdash; Définir le serveur</h2>
      <p>
        Créez <code>src/server.ts</code> et instanciez le Server MCP. Le constructeur prend un nom,
        une version et la liste des capacités que le serveur annonce.
      </p>
      <pre>
        <code>{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "weather", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Weather MCP server running on stdio");`}</code>
      </pre>
      <p>
        Deux choses à remarquer. Primo, l&apos;objet <code>capabilities</code> déclare quels types
        de primitives ce serveur supporte &mdash; les clients l&apos;utilisent pour savoir quelles
        listes demander. Deuxièmement, on log sur <code>stderr</code> exprès : stdout porte le
        protocole JSON-RPC, et un <code>console.log</code> errant corromprait le flux.
      </p>

      <h2 id="step-3">Étape 3 &mdash; Enregistrer un tool</h2>
      <p>
        Les tools sont la primitive la plus courante. Chacun a besoin d&apos;un nom, d&apos;une
        description (le modèle la lit pour décider quand l&apos;utiliser), et d&apos;un schéma pour
        ses inputs. Le SDK utilise des schémas Zod, convertis en JSON Schema automatiquement.
      </p>
      <pre>
        <code>{`import { z } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ForecastInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_forecast",
      description:
        "Returns a 3-day weather forecast (temperature, precipitation) for a given coordinate.",
      inputSchema: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_forecast") {
    throw new Error(\`Unknown tool: \${request.params.name}\`);
  }
  const { latitude, longitude } = ForecastInput.parse(request.params.arguments);
  const r = await fetch(
    \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}\` +
    \`&longitude=\${longitude}&daily=temperature_2m_max,precipitation_sum&forecast_days=3\`,
  );
  const data = await r.json();
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
});`}</code>
      </pre>
      <p>
        Le tableau <code>content</code> dans la réponse est la façon dont MCP retourne des données
        structurées. Chaque entrée a un type (<code>text</code>, <code>image</code>,
        <code> resource</code>) ; les clients les rendent en conséquence.
      </p>

      <h2 id="step-6">Étape 6 &mdash; Tester avec le MCP Inspector</h2>
      <p>
        Avant de relier le serveur à un vrai IDE, validez-le avec l&apos;Inspector. Petit UI web qui
        se connecte à n&apos;importe quel serveur MCP, liste ses capacités, et vous laisse
        déclencher les appels d&apos;outils manuellement.
      </p>
      <pre>
        <code>{`npx @modelcontextprotocol/inspector tsx src/server.ts`}</code>
      </pre>
      <p>
        L&apos;Inspector s&apos;ouvre dans votre navigateur. Confirmez que les trois onglets &mdash;
        Tools, Resources, Prompts &mdash; montrent vos déclarations. Appelez{" "}
        <code>get_forecast</code> avec des coordonnées d&apos;exemple et vérifiez la réponse. Si
        quelque chose échoue, corrigez-le maintenant &mdash; la boucle de debug avec un vrai client
        IA est beaucoup plus lente que l&apos;Inspector.
      </p>

      <h2 id="step-7">Étape 7 &mdash; Connecter à Cursor et Claude Code</h2>
      <h3>Cursor</h3>
      <p>
        Ouvrez les settings de Cursor, allez dans{" "}
        <strong>Features &rarr; Model Context Protocol</strong>, ajoutez un serveur :
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/chemin/absolu/vers/dist/server.js"]
    }
  }
}`}</code>
      </pre>
      <p>
        Construisez le projet d&apos;abord (<code>npm run build</code>), puis pointez Cursor vers le
        fichier compilé. Redémarrez Cursor ; le serveur weather apparaît dans le panneau et ses
        tools passent au vert quand le modèle y a accès.
      </p>
      <h3>Claude Code</h3>
      <p>Depuis un terminal :</p>
      <pre>
        <code>{`claude mcp add weather node /chemin/absolu/vers/dist/server.js`}</code>
      </pre>
      <p>
        Claude Code recharge automatiquement. Lancez une nouvelle conversation, demandez la météo
        dans une ville, et regardez le modèle appeler <code>get_forecast</code> en temps réel.
      </p>

      <h2 id="step-8">Étape 8 &mdash; Passer en transport HTTP et déployer</h2>
      <p>
        stdio est génial pour le dev local mais ne permet pas le partage entre machines. Basculez le
        transport en HTTP pour que vos coéquipiers se connectent à une instance partagée. Deux
        chemins ensuite : auto-hébergement Docker sur un VPS (vous gérez TLS, secrets, redémarrages)
        ou runtime géré comme <Link href={"/fr" as Route}>TwinMCP</Link> qui prend un package ou une
        URL Git plus les commandes d&apos;install/start, le fait tourner dans un sandbox isolé, et
        vous donne une URL HTTPS stable plus des clés API par utilisateur.
      </p>
      <p>
        Pour une comparaison plus approfondie de chaque option d&apos;hébergement &mdash; coût,
        charge ops, isolation &mdash; lisez notre guide dédié sur{" "}
        <Link href={"/fr/blog/mcp-server-hosting" as Route}>
          l&apos;hébergement de serveurs MCP
        </Link>
        .
      </p>

      <h2 id="pitfalls">Pièges courants (et comment les éviter)</h2>
      <h3>Logger sur stdout</h3>
      <p>
        Avec le transport stdio, stdout est le canal du protocole. Tout <code>console.log</code>{" "}
        errant casse la connexion silencieusement. Loguez toujours sur stderr (
        <code>console.error</code>) pendant le dev local.
      </p>
      <h3>Oublier de déclarer les capacités</h3>
      <p>
        Si vous implémentez des tools mais oubliez l&apos;entrée <code>tools: {`{}`}</code> dans le
        constructeur du serveur, les clients ne demanderont jamais la liste des tools et le modèle
        ne les verra pas. Pareil pour resources et prompts.
      </p>
      <h3>Retourner des chaînes non structurées</h3>
      <p>
        Les réponses de tools doivent être enveloppées dans le tableau <code>content</code>.
        Retourner une chaîne brute du handler lance une erreur SDK difficile à lire. En cas de
        doute, retournez <code>{`{ content: [{ type: "text", text: "..." }] }`}</code>.
      </p>

      <h2 id="next-steps">Et après ?</h2>
      <p>
        Vous avez maintenant la forme entière d&apos;un serveur MCP en mémoire musculaire. Pour le
        contexte conceptuel que vous avez sauté pour arriver ici, lisez{" "}
        <Link href={"/fr/blog/what-is-mcp" as Route}>
          le guide complet de Model Context Protocol
        </Link>
        . Et quand vous êtes prêt à arrêter de faire tourner ce serveur sur votre ordinateur
        portable, <Link href={"/fr" as Route}>l&apos;offre gratuite TwinMCP</Link> vous emmène de{" "}
        <code>git push</code> à un MCP HTTP fonctionnel en environ deux minutes.
      </p>
    </FrPostLayout>
  );
}
