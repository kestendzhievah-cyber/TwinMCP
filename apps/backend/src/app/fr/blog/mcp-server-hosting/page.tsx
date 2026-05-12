import type { Metadata, Route } from "next";
import Link from "next/link";
import { FrPostLayout } from "@/components/blog/fr-post-layout";
import { faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

const post = {
  slug: "mcp-server-hosting",
  title: "Hébergement de serveurs MCP en 2026 : auto-hébergé vs géré, comparaison",
  description:
    "Où devraient réellement tourner vos serveurs Model Context Protocol ? Comparaison entre stdio local, Docker sur VPS, Cloudflare Workers, Smithery, et runtimes gérés comme TwinMCP — avec chiffres réels.",
  publishedAt: "2026-05-10",
  readingTimeMinutes: 16,
  tags: ["mcp", "hébergement", "déploiement", "comparaison"],
};

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: "/fr/blog/mcp-server-hosting",
    languages: {
      en: "/blog/mcp-server-hosting",
      fr: "/fr/blog/mcp-server-hosting",
      "x-default": "/blog/mcp-server-hosting",
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/fr/blog/mcp-server-hosting`,
    publishedTime: post.publishedAt,
    locale: "fr_FR",
  },
};

const faq = [
  {
    q: "Quel est le moyen le moins cher d'héberger un serveur MCP ?",
    a: "stdio local est gratuit — le serveur tourne comme processus enfant de votre IDE sur votre machine. La moins chère des options hébergées en 2026 est une fonction serverless sur Cloudflare Workers (l'offre gratuite couvre la plupart des usages personnels). Un petit VPS Docker chez Hetzner coûte environ 5 $ par mois. Les runtimes MCP gérés démarrent à 0 $ (offre gratuite TwinMCP) et scalent avec l'usage.",
  },
  {
    q: "Puis-je faire tourner des serveurs MCP en production sans les exposer à Internet ?",
    a: "Oui. Docker auto-hébergé sur un VPC privé, Cloudflare Tunnel, ou un runtime géré avec allowlist IP gardent tous le serveur hors de l'internet public. Le client se connecte via votre host IA (Cursor, Claude Code), et seul l'host a besoin d'accès réseau au serveur — pas vos utilisateurs finaux.",
  },
  {
    q: "Les serveurs MCP coûtent-ils quelque chose quand personne ne les appelle ?",
    a: "Ça dépend du modèle d'hébergement. Un VPS ou runtime géré always-on accumule du coût 24h/24 même à zéro trafic. Les fonctions serverless et les tiers gérés par appel coûtent effectivement zéro à vide. Les serveurs stdio locaux ne coûtent que la RAM qu'ils consomment pendant que votre IDE tourne.",
  },
  {
    q: "Plusieurs développeurs peuvent-ils partager une même instance de serveur MCP ?",
    a: "Seuls les serveurs en transport HTTP peuvent être partagés. Les serveurs stdio tournent comme enfants d'un seul processus host, donc chaque développeur lançant son IDE démarre sa propre copie. Partager un serveur MCP HTTP entre une équipe est l'une des raisons principales de quitter stdio — état central, logs centraux, un seul endroit pour faire tourner les secrets.",
  },
  {
    q: "Que se passe-t-il si mon serveur MCP tombe ?",
    a: "Le client remonte une erreur de connexion à l'host, qui affiche généralement un point rouge à côté du nom du serveur et retire ses outils du catalogue du modèle. La conversation continue — le modèle perd juste l'accès aux outils de ce serveur. Pas de perte de données, pas de cascade d'erreurs.",
  },
];

const related = [
  {
    slug: "what-is-mcp",
    title: "Qu'est-ce que Model Context Protocol ? Le guide complet 2026",
    description:
      "MCP expliqué depuis zéro — ce que c'est, pourquoi Anthropic l'a construit, et comment l'utiliser aujourd'hui.",
    readingTimeMinutes: 14,
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
        <strong>TL;DR.</strong> Cinq endroits ont du sens pour faire tourner un serveur Model
        Context Protocol en 2026 : stdio local, un conteneur Docker sur votre propre VPS, une
        fonction serverless (Cloudflare Workers / Vercel / Lambda), un catalogue agrégateur comme
        Smithery, ou un runtime MCP géré. Le bon choix dépend de votre besoin de persistance, du
        fait que le serveur tienne des secrets, du partage entre plusieurs développeurs, et du temps
        opérationnel que vous voulez dépenser. Ce guide les compare côte à côte, avec chiffres réels
        et critères de décision concrets.
      </p>

      <h2 id="why-hosting-matters">
        Pourquoi le choix d&apos;hébergement compte plus que la spec ne le laisse penser
      </h2>
      <p>
        La plupart des introductions à MCP le décrivent comme &laquo; juste du JSON-RPC sur stdio
        &raquo;. C&apos;est techniquement vrai et opérationnellement trompeur. Où tourne le serveur
        décide s&apos;il peut tenir un pool de connexions DB, s&apos;il peut garder les secrets hors
        de votre ordinateur portable, s&apos;il survit à un redémarrage d&apos;IDE, et si
        quelqu&apos;un d&apos;autre dans votre équipe peut l&apos;utiliser sans le réinstaller.
        Aucune de ces questions n&apos;est répondue par la spec ; toutes le sont par l&apos;endroit
        où vous déployez.
      </p>
      <p>
        Le protocole vous donne deux transports &mdash; stdio et HTTP &mdash; et ce seul bit cascade
        dans toutes les autres décisions opérationnelles. Choisir stdio signifie éphémère, par
        utilisateur, par machine, zéro réseau. Choisir HTTP signifie longue durée, partagé, en
        réseau, et vous possédez maintenant le problème de déploiement. Une fois engagé sur HTTP, la
        seule question restante est <em>quel</em> type d&apos;host always-on.
      </p>

      <h2 id="five-options">Les cinq vraies options</h2>

      <h3>Option 1 &mdash; stdio local (le défaut)</h3>
      <p>
        Le serveur tourne comme processus enfant de votre host IA. Cursor, Claude Desktop, Claude
        Code et Windsurf le supportent nativement. Vous ajoutez une entrée dans un fichier de
        configuration avec une commande (typiquement <code>npx some-mcp-server</code>) et
        l&apos;host démarre le binaire au lancement.
      </p>
      <p>
        Coût zéro. Temps de setup deux minutes. Le compromis est que le serveur est éphémère, par
        utilisateur, par machine. L&apos;état vit en mémoire et meurt avec l&apos;host. Partager le
        serveur avec un collègue signifie le convaincre de l&apos;installer. Les secrets viennent de
        l&apos;environnement de l&apos;host, donc le token GitHub dans votre shell est lisible par
        chaque serveur stdio que votre IDE a chargé.
      </p>
      <p>
        Utilisez stdio quand le serveur est vraiment personnel (accès filesystem, shell, scratchpad
        local), quand le travail fait n&apos;a aucun état partagé, et quand vous faites assez
        confiance au code pour lui donner votre ordinateur portable.
      </p>

      <h3>Option 2 &mdash; Docker auto-hébergé sur un VPS</h3>
      <p>
        Vous packagez le serveur MCP comme un conteneur, le poussez sur un VPS (Hetzner, OVH,
        Digital Ocean, AWS Lightsail), exposez le port 443 derrière un reverse proxy avec TLS, et
        pointez votre client IA sur l&apos;URL avec un bearer token. Le transport HTTP gère le
        reste.
      </p>
      <p>
        Le coût est prévisible : un Hetzner CX22 2 vCPU / 4 Go est autour de 5 $ par mois et fait
        tourner une douzaine de serveurs MCP confortablement. Temps de setup une demi-journée la
        première fois, une heure pour chaque serveur suivant. Vous possédez tout &mdash; isolation
        entre serveurs, renouvellement TLS, log shipping, rotation des secrets, patches OS, gestion
        des certificats, backups, monitoring, alerting.
      </p>
      <p>
        Utilisez l&apos;auto-hébergement quand vous avez des contraintes de conformité dures qui
        forcent le serveur dans votre propre VPC, quand l&apos;intégration est si spécifique à une
        entreprise qu&apos;aucune offre managée ne la vendra jamais, ou quand faire tourner de
        l&apos;infra fait partie de ce que votre équipe fait.
      </p>

      <h3>Option 3 &mdash; Serverless (Cloudflare Workers, Vercel, AWS Lambda)</h3>
      <p>
        Déployez le serveur comme fonction serverless. Le point d&apos;entrée HTTP mappe vers un
        handler JSON-RPC. La fonction démarre à la demande, gère la requête, et termine. Cloudflare
        Workers en particulier a une offre gratuite généreuse et des cold starts edge mondiaux en
        millisecondes à un chiffre.
      </p>
      <p>
        Le coût à faible volume est effectivement zéro. Le compromis est que serverless et MCP
        longue durée ne se mélangent pas proprement. La partie Server-Sent Events du transport veut
        une connexion qui reste ouverte pendant que le modèle réfléchit ; les fonctions sans état
        soit la tuent au timeout de la plateforme, soit facturent les secondes wall-clock.
        L&apos;état local (pool DB, cache en mémoire, workflows en cours) est impossible par
        conception.
      </p>
      <p>
        Utilisez serverless quand chaque appel d&apos;outil est court, sans état et idempotent
        &mdash; un wrapper autour d&apos;une API externe, une recherche one-shot, une traduction.
        Évitez quand le serveur a sa propre base, tient des sessions longues, ou exécute du travail
        en arrière-plan entre requêtes.
      </p>

      <h3>Option 4 &mdash; Catalogues agrégateurs (Smithery, MCPHub)</h3>
      <p>
        Une poignée de services hébergent les serveurs MCP open source les plus populaires sur
        infrastructure partagée. Le catalogue est curé, les serveurs sont open source, et la
        plateforme gère toutes les opérations. Vous connectez Cursor ou Claude Desktop au catalogue
        avec un seul token et choisissez quels serveurs activer.
      </p>
      <p>
        Le coût est gratuit pour la plupart des usages &mdash; les opérateurs de catalogue
        monétisent via des frais d&apos;affiliation, des placements sponsorisés, ou des tiers
        payants pour les serveurs populaires. Setup en un clic. Le compromis est que vous ne pouvez
        pas déployer votre propre code privé &mdash; seuls les serveurs publiés, souvent maintenus
        par la communauté, sont disponibles. Les secrets que vous configurez sur la plateforme sont
        visibles de qui la fait tourner.
      </p>
      <p>
        Utilisez les catalogues quand vous voulez installer en un tap GitHub, Notion, Slack ou
        d&apos;autres MCPs canoniques et que vous ne vous souciez pas que le serveur soit
        infrastructure partagée.
      </p>

      <h3>
        Option 5 &mdash; Runtimes MCP gérés (<Link href={"/fr" as Route}>TwinMCP</Link>, similaires)
      </h3>
      <p>
        Les runtimes gérés provisionnent un sandbox isolé par serveur. Vous les pointez vers un
        package (npm, pip, Go module) ou un repo Git, remplissez les commandes d&apos;install et de
        démarrage, et vous obtenez une URL stable avec une clé API par utilisateur. La plateforme
        gère l&apos;isolation entre serveurs, le chiffrement des secrets, la capture de logs, la
        politique d&apos;egress réseau, et les snippets de câblage IDE pour Cursor, Claude Code,
        Windsurf et Cline.
      </p>
      <p>
        Le coût chez TwinMCP démarre à 0 $ pour un serveur sur l&apos;offre gratuite et scale
        jusqu&apos;à 20 $ par mois fixe pour Pro (25 serveurs). Setup deux minutes &mdash;
        choisissez un runtime, collez une commande d&apos;install, c&apos;est parti. Le compromis
        est le verrouillage plateforme : la configuration de déploiement est spécifique à la
        plateforme, et migrer demande de reconstruire le conteneur vous-même. (Le code du serveur
        MCP lui-même est portable ; seule la glue de provisioning ne l&apos;est pas.)
      </p>
      <p>
        Utilisez un runtime géré quand le serveur tient des secrets, quand plusieurs développeurs
        doivent le partager, quand vous voulez logs et métriques centralisés, ou quand vous
        n&apos;avez pas d&apos;équipe plateforme qui veut faire tourner votre infrastructure MCP
        pour vous.
      </p>

      <h2 id="decision-tree">Un arbre de décision qui tient sur l&apos;écran</h2>
      <p>Commencez en haut, suivez la première branche qui correspond :</p>
      <ol>
        <li>
          Le serveur est-il purement personnel, sans secrets que vous ne pouvez déjà pas confier à
          votre ordinateur portable ? <strong>stdio local.</strong> Arrêtez là.
        </li>
        <li>
          Avez-vous une équipe ops et une raison de conformité dure de faire tourner dans votre
          propre VPC ? <strong>Docker auto-hébergé.</strong> Arrêtez là.
        </li>
        <li>
          Le serveur est-il un mince wrapper autour d&apos;une API externe sans état, sans streaming
          et sans sessions longues ? <strong>Serverless.</strong> Arrêtez là.
        </li>
        <li>
          Voulez-vous juste utiliser un MCP open source existant sans réfléchir à l&apos;hébergement
          ? <strong>Catalogue.</strong> Arrêtez là.
        </li>
        <li>
          Tout le reste &mdash; usage partagé d&apos;équipe, code privé, secrets, persistance, ou
          vous voulez juste que ça marche en deux minutes ? <strong>Runtime géré.</strong>
        </li>
      </ol>

      <h2 id="conclusion">La recommandation pragmatique</h2>
      <p>
        Si vous lisez ce post, vous pesez probablement deux options : auto-hébergé parce que ça
        semble responsable, ou un runtime géré parce que ça semble facile. La réponse honnête est
        que la plupart des équipes surestiment le travail d&apos;auto-hébergement et sous-estiment
        le coût de bien le faire. Patches, rétention de logs, rotation des secrets, TLS, isolation,
        astreinte quand quelque chose casse &mdash; rien de ça ne scale linéairement avec le nombre
        de serveurs MCP que vous faites tourner.
      </p>
      <p>
        Commencez avec un runtime géré (ou stdio pour les projets personnels). Passez à
        l&apos;auto-hébergement seulement quand vous pouvez nommer la raison spécifique de
        conformité ou de coût qui force le passage. Pour le contexte sur le protocole lui-même, voir
        notre <Link href={"/fr/blog/what-is-mcp" as Route}>guide complet de MCP</Link>. Quand vous
        êtes prêt à construire votre propre serveur, le{" "}
        <Link href={"/fr/blog/build-mcp-server" as Route}>tutoriel étape par étape</Link> parcourt
        tout le chemin depuis un dossier vide jusqu&apos;à un serveur tournant dans Cursor.
      </p>
    </FrPostLayout>
  );
}
