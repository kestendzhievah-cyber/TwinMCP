import type { Metadata, Route } from "next";
import Link from "next/link";
import { FrPostLayout } from "@/components/blog/fr-post-layout";
import { faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const post = {
  slug: "what-is-mcp",
  title: "Qu'est-ce que Model Context Protocol ? Le guide complet 2026",
  description:
    "MCP expliqué depuis zéro — ce que c'est, pourquoi Anthropic l'a construit, comment clients et serveurs communiquent, et ce que vous pouvez en faire aujourd'hui.",
  publishedAt: "2026-05-10",
  readingTimeMinutes: 14,
  tags: ["mcp", "anthropic", "agents-ia", "fondamentaux"],
};

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: "/fr/blog/what-is-mcp",
    languages: {
      en: "/blog/what-is-mcp",
      fr: "/fr/blog/what-is-mcp",
      "x-default": "/blog/what-is-mcp",
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/fr/blog/what-is-mcp`,
    publishedTime: post.publishedAt,
    locale: "fr_FR",
  },
};

const faq = [
  {
    q: "Model Context Protocol est-il open source ?",
    a: "Oui. La spécification MCP, les SDKs officiels (TypeScript, Python, C#, Java, Kotlin, Ruby, Swift) et le débogueur Inspector sont tous publiés sous licence open source sur GitHub. Le protocole est conçu pour être neutre vis-à-vis des fournisseurs — Claude est un client parmi d'autres, et des SDKs communautaires existent pour Go, Rust et d'autres langages.",
  },
  {
    q: "Faut-il une clé API Anthropic pour utiliser MCP ?",
    a: "Non. MCP est un protocole de transport entre un client IA et un serveur. Le client peut être Claude Desktop, Cursor, Claude Code, Windsurf, Cline, ou n'importe quelle intégration personnalisée. Aucun de ces clients ne nécessite d'appeler l'API Anthropic directement pour parler à un serveur MCP.",
  },
  {
    q: "En quoi MCP diffère-t-il du function calling d'OpenAI ?",
    a: "Le function calling est un mécanisme par requête où vous décrivez les outils en ligne dans le prompt envoyé au modèle. MCP externalise ça : le serveur tourne comme un processus propre, expose une liste stable d'outils, ressources et prompts, et le client IA les découvre dynamiquement. Le même serveur fonctionne dans Claude, Cursor, Windsurf, Cline, et tout ce qui parle MCP — vous construisez l'intégration une seule fois.",
  },
  {
    q: "Que peut réellement faire un serveur MCP ?",
    a: "Trois primitives : tools (fonctions que l'IA peut appeler), resources (données en lecture seule que l'IA peut récupérer), et prompts (templates réutilisables que l'utilisateur peut déclencher). Tout ce qui peut être enveloppé dans du JSON-RPC sur stdio ou HTTP est éligible — systèmes de fichiers, bases de données, GitHub, Slack, APIs internes, scrapers, n'importe quoi.",
  },
  {
    q: "Faut-il héberger les serveurs MCP soi-même ?",
    a: "Non. Vous pouvez les exécuter localement via stdio (idéal pour outils personnels), les auto-héberger sur un VPS, les déployer sur un runtime serverless, ou utiliser un runtime géré comme TwinMCP qui gère l'isolation, les secrets et le câblage IDE pour vous.",
  },
];

const related = [
  {
    slug: "mcp-server-hosting",
    title: "Hébergement de serveurs MCP en 2026 : auto-hébergé vs géré",
    description:
      "Où devraient réellement tourner vos serveurs MCP ? Comparaison des 5 options avec chiffres réels.",
    readingTimeMinutes: 16,
  },
  {
    slug: "build-mcp-server",
    title: "Comment construire un serveur MCP (étape par étape)",
    description:
      "Tutoriel complet : construisez un serveur MCP en TypeScript et connectez-le à Cursor et Claude Code.",
    readingTimeMinutes: 18,
  },
];

export default function Post() {
  return (
    <FrPostLayout post={post} related={related} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Model Context Protocol (MCP) est un standard ouvert publié par
        Anthropic le 25 novembre 2024, qui permet aux assistants IA de parler à des outils et
        données externes via une seule interface uniforme. Au lieu d&apos;écrire des intégrations
        personnalisées pour chaque modèle et chaque IDE, vous construisez un serveur MCP et chaque
        client compatible MCP &mdash; Claude Desktop, Cursor, Claude Code, Windsurf, Cline &mdash;
        peut l&apos;utiliser. Ce guide explique ce qu&apos;est MCP, pourquoi il existe, comment le
        protocole fonctionne réellement, ce que vous pouvez construire avec aujourd&apos;hui, et où
        se dirige l&apos;écosystème en 2026.
      </p>

      <h2 id="why">Pourquoi MCP existe : le bordel d&apos;intégration de 2023&ndash;2024</h2>
      <p>
        Pendant la majeure partie de 2023, &laquo; donner à un agent IA accès à un outil &raquo;
        signifiait inliner un schéma JSON dans un prompt et parser la réponse du modèle pour la
        transformer en appel de fonction. Chaque fournisseur de modèle avait sa propre convention.
        OpenAI a introduit le function calling. Anthropic avait tool use. Google avait autre chose.
        Les frameworks au-dessus (LangChain, LlamaIndex, orchestrateurs custom) cachaient les
        différences, mais le résultat était le même : chaque intégration était sur-mesure, fragile,
        et réécrite pour chaque nouveau client.
      </p>
      <p>
        Le problème s&apos;est aggravé rapidement. Cursor voulait lire les issues GitHub d&apos;un
        développeur. Claude Desktop voulait lire les fichiers locaux. Windsurf voulait accéder à une
        base Postgres. Chaque IDE livrait son propre système de plugins, avec son propre modèle
        d&apos;auth, son propre schéma d&apos;outil, et sa propre façon de streamer les résultats au
        modèle. Une petite équipe voulant exposer &laquo; rechercher dans nos docs internes &raquo;
        à quatre clients IA finissait par écrire quatre intégrations parallèles et maintenir quatre
        cadences de release.
      </p>
      <p>
        Anthropic a publié MCP le 25 novembre 2024 comme réponse : un protocole, défini une fois,
        avec des SDKs de référence dans plusieurs langages et un modèle de gouvernance ouvert. Le
        client IA parle MCP. Le fournisseur d&apos;outil parle MCP. Le protocole gère la découverte,
        les schémas, le transport, les erreurs, le streaming et l&apos;authentification.
        L&apos;intégration devient un contrat, pas un adapter sur-mesure.
      </p>

      <h2 id="what-is-it">Ce qu&apos;est MCP, en un paragraphe</h2>
      <p>
        MCP est un protocole JSON-RPC 2.0 qui tourne sur l&apos;un de deux transports &mdash;
        entrée/sortie standard (stdio) pour les processus locaux, ou HTTP avec Server-Sent Events
        (SSE) pour les distants. Deux parties se parlent : un <strong>client MCP</strong> embarqué
        dans une application IA, et un <strong>serveur MCP</strong> qui expose des capacités. Le
        serveur annonce une liste d&apos;outils, ressources et prompts. Le client se connecte, lit
        le catalogue, et présente les éléments pertinents au modèle IA et à l&apos;utilisateur.
        Quand le modèle décide d&apos;appeler un outil, le client envoie la requête au serveur, le
        serveur exécute, et la réponse revient par le même canal. C&apos;est tout le protocole
        &mdash; le reste est convention.
      </p>

      <h2 id="architecture">Les trois acteurs : host, client, serveur</h2>
      <p>
        La spec MCP définit trois rôles distincts. Bien les comprendre est important parce
        qu&apos;ils vivent souvent dans des processus différents.
      </p>
      <h3>L&apos;host</h3>
      <p>
        L&apos;host est l&apos;application visible par l&apos;utilisateur &mdash; Cursor, Claude
        Desktop, Claude Code, Windsurf, Cline. Il possède l&apos;UI, la conversation avec le modèle,
        et la session de l&apos;utilisateur. L&apos;host décide à quels serveurs se connecter et
        comment présenter leurs capacités au modèle. Il ne parle pas MCP directement ; il délègue ça
        à un client.
      </p>
      <h3>Le client</h3>
      <p>
        Chaque host fait tourner un client par serveur auquel il veut parler. Le client gère la
        mécanique du protocole &mdash; cycle de connexion, sérialisation des messages, négociation
        des capacités. Du point de vue de l&apos;host, le client expose une API locale propre pour
        &laquo; lister les outils &raquo;, &laquo; appeler cet outil &raquo;, &laquo; lire cette
        ressource &raquo;. Un host qui se connecte à cinq serveurs MCP fait tourner cinq instances
        de client.
      </p>
      <h3>Le serveur</h3>
      <p>
        Le serveur, c&apos;est ce que vous construisez. Il expose une ou plusieurs capacités et
        attend que le client les appelle. Il peut tourner comme processus enfant de l&apos;host
        (transport stdio) ou comme service HTTP indépendant. Le serveur a ses propres permissions,
        ses propres variables d&apos;environnement, son propre accès réseau. L&apos;utilisateur
        autorise la connexion une fois ; après ça, les appels circulent.
      </p>

      <h2 id="primitives">Les trois primitives : tools, resources, prompts</h2>
      <p>
        Chaque serveur MCP expose une combinaison de trois types de primitives. Comprendre la
        différence est la chose la plus importante pour utiliser MCP correctement.
      </p>
      <h3>Tools (outils)</h3>
      <p>
        Les tools sont les fonctions que le modèle IA peut appeler. Chaque tool a un nom, une
        description, et un JSON Schema pour ses paramètres. Le serveur retourne une sortie
        structurée. Les tools sont le pain quotidien &mdash; &laquo; lister les pull requests
        ouvertes &raquo;, &laquo; exécuter ce SQL &raquo;, &laquo; envoyer un message Slack &raquo;.
        Un appel d&apos;outil est initié par le modèle : le modèle décide, en plein dans une
        conversation, qu&apos;un outil serait utile, et le client route l&apos;appel. Les tools sont
        aussi la seule primitive qui peut avoir des effets de bord, ce qui explique pourquoi chaque
        host MCP affiche par défaut une confirmation avant d&apos;en exécuter un.
      </p>
      <h3>Resources (ressources)</h3>
      <p>
        Les ressources sont des données en lecture seule que l&apos;IA peut récupérer. Vous pouvez
        les voir comme des URLs que le modèle peut demander au client de déréférencer : un chemin de
        fichier, une ligne de base de données, une page wiki, un calendrier. Les ressources sont
        plus souvent initiées par l&apos;utilisateur que les tools &mdash; l&apos;utilisateur les
        attache à la conversation, ou le client les expose comme @-mentions. Le serveur retourne le
        contenu, avec éventuellement des métadonnées. Les ressources n&apos;ont pas d&apos;effets de
        bord.
      </p>
      <h3>Prompts</h3>
      <p>
        Les prompts sont des templates réutilisables que l&apos;utilisateur (pas le modèle)
        déclenche. Ils apparaissent dans l&apos;UI de l&apos;host comme slash commands ou entrées
        d&apos;autocomplétion. Un prompt accepte des arguments, les substitue dans un template, et
        retourne une conversation préparée que l&apos;host envoie au modèle. Les prompts sont la
        façon d&apos;encoder des workflows : &laquo; résumer cette PR &raquo;, &laquo; rédiger un
        postmortem pour l&apos;incident X &raquo;, &laquo; refactorer cette fonction pour utiliser
        le nouveau logger &raquo;.
      </p>

      <h2 id="transport">Transport : stdio et HTTP</h2>
      <p>MCP définit deux transports, et le choix a des conséquences opérationnelles sérieuses.</p>
      <h3>Transport stdio</h3>
      <p>
        L&apos;host démarre le serveur comme un processus enfant et lui parle via stdin et stdout.
        Des messages JSON-RPC séparés par des sauts de ligne circulent dans les deux sens. Aucun
        port à ouvrir, aucune auth à configurer, aucune exposition réseau. C&apos;est ainsi que
        Claude Desktop et Cursor chargent la plupart de leurs MCPs par défaut. C&apos;est aussi le
        défaut pour les outils personnels que vous ne voulez pas héberger ailleurs.
      </p>
      <p>
        Le coût de stdio est que le serveur ne vit que tant que le processus host. Redémarrer Cursor
        redémarre le serveur. Trois IDE ouverts sur votre ordi signifient trois copies du même
        serveur. L&apos;état est par processus. Le travail en arrière-plan est plus difficile. Et si
        l&apos;host crashe, le serveur meurt avec lui.
      </p>
      <h3>Transport HTTP</h3>
      <p>
        Le transport plus récent fait tourner le serveur comme un service HTTP de longue durée. Les
        clients envoient des requêtes JSON-RPC en POST ; les réponses peuvent streamer via
        Server-Sent Events. C&apos;est ce que vous voulez quand le serveur a un état qui mérite
        d&apos;être conservé (un pool de connexions DB, un cache), quand plusieurs hosts doivent
        partager une instance, ou quand le serveur doit vivre dans un domaine de sécurité différent
        de l&apos;host (secrets côté serveur, accès réseau interne).
      </p>
      <p>
        Le coût du HTTP est qu&apos;il faut l&apos;héberger, le sécuriser, et donner au client une
        URL et un token d&apos;auth. C&apos;est exactement le problème que les runtimes gérés comme{" "}
        <Link href={"/fr" as Route}>TwinMCP</Link> ont été construits pour résoudre &mdash; vous
        écrivez le serveur, la plateforme gère l&apos;isolation, le transport, les secrets et le
        câblage IDE.
      </p>

      <h2 id="examples">Ce que les gens construisent réellement avec MCP</h2>
      <p>
        Trois catégories dominent l&apos;écosystème en 2026, et il est utile de les connaître avant
        de démarrer votre propre serveur.
      </p>
      <h3>Connecteurs vers des systèmes existants</h3>
      <p>
        La plus grosse catégorie. GitHub, Linear, Notion, Slack, Jira, Postgres, MySQL, BigQuery,
        Snowflake, Stripe, HubSpot, Salesforce, Google Drive, Google Calendar, Figma, Sentry,
        Datadog. Chacun est un mince wrapper autour d&apos;une API REST ou GraphQL existante,
        reconditionnée en outils et ressources MCP. Ce sont les MCPs &laquo; officiels &raquo; du
        marketplace &mdash; ils existent parce que l&apos;intégration avait déjà de la valeur, MCP
        l&apos;a juste rendue portable entre clients.
      </p>
      <h3>Accès au système local</h3>
      <p>
        Filesystem, shell, navigateur, capture d&apos;écran, OCR, audio. Ceux-là tournent
        principalement comme serveurs stdio parce qu&apos;ils ont besoin d&apos;accéder à votre
        machine. Anthropic livre un serveur filesystem avec Claude Desktop ; des alternatives
        communautaires exposent Bash, Playwright, AppleScript. Attention avec ceux-là &mdash; un MCP
        shell sans contrainte donne au modèle accès en écriture à toute votre station de travail.
      </p>
      <h3>Connaissance spécifique au domaine</h3>
      <p>
        Docs internes, indices RAG custom, retrieval sur un wiki d&apos;entreprise, retrieval sur
        une codebase. Ceux-là sont en général privés et construits sur mesure. Ils exposent
        généralement deux outils (&laquo; search &raquo; et &laquo; fetch &raquo;) plus quelques
        ressources. C&apos;est aussi la catégorie où vous avez le plus clairement besoin d&apos;un
        runtime géré : le serveur a un vector store, une clé API secrète et un budget pour les
        embeddings &mdash; vous ne voulez pas que ça tourne dans le processus de chaque ordinateur
        portable de développeur.
      </p>

      <h2 id="security">Sécurité : la partie que la plupart des posts oublient</h2>
      <p>
        MCP fait des trous dans votre périmètre de sécurité par conception. Le modèle, guidé par du
        texte dans votre conversation, peut appeler des fonctions qui touchent votre système de
        fichiers, exécutent du SQL, ou contactent des APIs externes. Trois choses comptent et
        presque rien d&apos;autre.
      </p>
      <h3>Confirmations</h3>
      <p>
        Les hosts demandent par défaut avant d&apos;exécuter un outil, mais l&apos;option &laquo;
        toujours autoriser &raquo; est à un clic. Traitez-la comme sudo : ne cochez cette case que
        pour les serveurs que vous avez réellement lus.
      </p>
      <h3>Isolation des secrets</h3>
      <p>
        Un serveur stdio tourne avec les variables d&apos;environnement de votre shell. Si votre IDE
        a votre token GitHub dans <code>GITHUB_TOKEN</code>, chaque serveur MCP sur votre ordinateur
        peut le lire. Utilisez le scoping de secrets par serveur (les runtimes gérés vous donnent ça
        ; pas stdio).
      </p>
      <h3>Prompt injection</h3>
      <p>
        Un serveur MCP récupère des données depuis quelque part. Ces données finissent dans la
        fenêtre de contexte du modèle. Du texte adverse dans une issue GitHub peut instruire le
        modèle d&apos;appeler un autre outil avec des paramètres qui font fuiter des données. La
        mitigation est la même que pour tout système RAG : traitez le contenu récupéré comme non
        fiable, et concevez les outils pour que le pire résultat d&apos;un appel confus soit
        récupérable.
      </p>

      <h2 id="getting-started">Comment commencer</h2>
      <p>Deux chemins, selon ce que vous voulez.</p>
      <p>
        <strong>Si vous voulez utiliser MCP</strong>, installez Claude Desktop, Cursor, Claude Code,
        ou Windsurf, parcourez leur catalogue intégré, et ajoutez un serveur MCP en deux clics. La
        plupart des serveurs par défaut utiles (filesystem, GitHub, fetch) sont inclus.
      </p>
      <p>
        <strong>Si vous voulez construire un serveur MCP</strong>, lisez notre tutoriel dédié :{" "}
        <Link href={"/fr/blog/build-mcp-server" as Route}>
          comment construire un serveur Model Context Protocol (étape par étape)
        </Link>
        . Il couvre TypeScript, les deux transports, et comment déployer ce que vous avez construit.
      </p>
      <p>
        <strong>Si vous voulez faire tourner un serveur MCP en production</strong>, sans gérer
        l&apos;infrastructure sous-jacente, inscrivez-vous pour un compte TwinMCP gratuit &mdash;
        vous obtenez un serveur isolé et le catalogue dès l&apos;offre gratuite.
      </p>
    </FrPostLayout>
  );
}
