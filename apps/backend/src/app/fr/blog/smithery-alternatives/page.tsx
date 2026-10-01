import type { Metadata, Route } from "next";
import Link from "next/link";
import { FrPostLayout } from "@/components/blog/fr-post-layout";
import { faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const post = {
  slug: "smithery-alternatives",
  title: "Les meilleures alternatives à Smithery pour héberger un serveur MCP (2026)",
  description:
    "Vous cherchez une alternative à Smithery ? Comparez les runtimes MCP gérés, les registres publics, l'auto-hébergement et le serverless — avec un tableau de décision : code privé, isolation, secrets, accès équipe.",
  publishedAt: "2026-10-01",
  readingTimeMinutes: 10,
  tags: ["mcp", "smithery", "alternatives", "hébergement", "comparaison"],
};

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: "/fr/blog/smithery-alternatives",
    languages: {
      en: "/blog/smithery-alternatives",
      fr: "/fr/blog/smithery-alternatives",
      "x-default": "/blog/smithery-alternatives",
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/fr/blog/smithery-alternatives`,
    publishedTime: post.publishedAt,
    locale: "fr_FR",
  },
};

const faq = [
  {
    q: "Quelle est la meilleure alternative à Smithery pour des serveurs MCP privés ?",
    a: "Un runtime MCP géré comme TwinMCP, ou l'auto-hébergement. La force de Smithery, c'est son catalogue public open-source ; il n'est pas conçu pour héberger votre propre code privé avec une isolation des secrets par serveur. Un runtime géré vous donne un bac à sable isolé par serveur plus un catalogue en un clic, tandis que l'auto-hébergement offre le contrôle total au prix de l'exploitation.",
  },
  {
    q: "Existe-t-il une alternative gratuite à Smithery ?",
    a: "Oui. TwinMCP propose une offre gratuite avec un serveur isolé et l'accès complet au catalogue, sans carte bancaire. L'auto-hébergement est gratuit côté logiciel mais coûte du temps réel d'exploitation (TLS, secrets, logs, supervision). D'autres registres publics ont aussi des offres gratuites de catalogue, avec des compromis proches de ceux de Smithery.",
  },
  {
    q: "Puis-je migrer facilement hors de Smithery ?",
    a: "Oui — le code d'un serveur MCP est portable. Le verrouillage se situe dans la configuration de déploiement, pas dans le serveur lui-même. Pour passer à un runtime géré ou à votre propre hébergement, installez le même paquet amont (npm/pip/Git), collez la commande de démarrage et recopiez vos secrets.",
  },
];

export default function Post() {
  return (
    <FrPostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>En bref.</strong> Smithery est un excellent choix quand tous les MCP dont vous avez
        besoin sont publics et open-source, et que l&apos;infrastructure partagée ne vous dérange
        pas. Dès que vous avez besoin de <em>code privé</em>, d&apos;une vraie <em>isolation</em>,
        de <em>secrets</em> par serveur ou de <em>contrôles d&apos;accès équipe</em>, il vous faut
        un autre outil. Ce guide couvre les quatre familles d&apos;alternative à Smithery &mdash;
        runtimes gérés, autres registres publics, auto-hébergement et serverless &mdash; et comment
        choisir.
      </p>

      <h2 id="why-alternative">Pourquoi chercher une alternative à Smithery</h2>
      <p>
        La proposition de valeur de Smithery, c&apos;est un catalogue hébergé de MCP publics
        open-source : l&apos;équipe cure un large registre, fait tourner les serveurs populaires sur
        une infrastructure partagée, et vous donne un seul token pour vous connecter depuis Cursor
        ou Claude Desktop. C&apos;est réellement utile &mdash; mais cela définit le plafond que les
        gens finissent par atteindre :
      </p>
      <ul>
        <li>
          <strong>Code privé.</strong> Un catalogue public héberge des serveurs publics. Le wrapper
          d&apos;API interne que vous avez écrit, votre serveur RAG sur mesure, un outil spécifique
          à votre entreprise &mdash; tout cela n&apos;a pas sa place dans un registre partagé.
        </li>
        <li>
          <strong>Rayon d&apos;impact des identifiants.</strong> Un serveur sur infrastructure
          partagée qui détient un token GitHub en écriture ou une chaîne de connexion à une base
          n&apos;est isolé que dans la mesure où la plateforme le permet. Pour tout ce qui a un
          accès en écriture réel, vous voulez généralement un bac à sable qui est le vôtre.
        </li>
        <li>
          <strong>Contrôles d&apos;équipe.</strong> Clés par utilisateur, journaux d&apos;audit et
          rotation des clés deviennent des besoins de premier plan dès que plus d&apos;une personne
          est impliquée.
        </li>
      </ul>
      <p>
        Si rien de tout cela ne vous concerne, Smithery convient probablement. Si l&apos;un de ces
        points vous bloque, voici les alternatives.
      </p>

      <h2 id="criteria">Quels critères regarder</h2>
      <p>Jugez chaque option sur les six critères qui changent vraiment la décision :</p>
      <ul>
        <li>
          <strong>MCP privés</strong> &mdash; pouvez-vous faire tourner du code hors catalogue
          public ?
        </li>
        <li>
          <strong>Isolation</strong> &mdash; chaque serveur a-t-il son propre bac à sable, ou est-ce
          partagé ?
        </li>
        <li>
          <strong>Gestion des secrets</strong> &mdash; chiffrés au repos, par serveur, jamais
          exposés aux autres locataires ?
        </li>
        <li>
          <strong>Compatibilité clients</strong> &mdash; une seule URL + clé fonctionne-t-elle pour
          Cursor, Claude, Windsurf et Cline ?
        </li>
        <li>
          <strong>Modèle tarifaire</strong> &mdash; offre gratuite, forfait fixe, ou à l&apos;usage
          ?
        </li>
        <li>
          <strong>Verrouillage</strong> &mdash; est-ce difficile de partir ?
        </li>
      </ul>

      <h2 id="managed">1. Les runtimes MCP gérés &mdash; l&apos;alternative la plus proche</h2>
      <p>
        Un runtime géré est la suite naturelle du catalogue : au lieu de vous connecter à un serveur
        public partagé, vous <em>provisionnez le vôtre</em> &mdash; public ou privé &mdash; et la
        plateforme le fait tourner pour vous. <Link href={"/fr" as Route}>TwinMCP</Link> est bâti
        exactement là-dessus. Chaque serveur que vous créez obtient son propre bac à sable isolé
        (une micro-VM Upstash Box). Le catalogue des MCP open-source populaires s&apos;installe en
        un clic, et vous pouvez publier vos propres MCP privés depuis un paquet ou un dépôt Git à
        côté. Les secrets sont chiffrés par serveur (AES-256-GCM) et jamais partagés entre
        locataires, et une seule URL proxy + clé fonctionne pour Cursor, Claude Code, Windsurf et
        Cline.
      </p>
      <p>
        Il garde ce qui rend Smithery agréable &mdash; aucun déploiement, un seul token, un
        catalogue installable &mdash; et retire le plafond : code privé, isolation par serveur,
        journaux d&apos;audit et rotation des clés en fonctionnalités de premier plan. L&apos;
        <Link href={"/plans" as Route}>offre gratuite</Link> vous donne un serveur et le catalogue
        complet sans carte bancaire, donc le changement ne coûte rien à essayer.
      </p>

      <h2 id="registries">2. Les autres registres et annuaires publics</h2>
      <p>
        Si vous voulez seulement un catalogue public <em>différent</em> &mdash; pas une nouvelle
        capacité &mdash; d&apos;autres registres et annuaires MCP existent dans l&apos;écosystème
        (par exemple Glama, PulseMCP et mcp.run). Ils partagent globalement la forme de Smithery :
        un index navigable de serveurs publics open-source, avec la commodité et les limites qui
        vont avec. Vérifiez toujours la documentation actuelle d&apos;un registre pour
        l&apos;hébergement privé et l&apos;isolation, car cela évolue vite.
      </p>
      <p>
        Le résumé honnête : passer d&apos;un registre public à un autre change le catalogue et
        l&apos;expérience, pas le compromis de fond. Si votre blocage était « j&apos;ai besoin de
        faire tourner du code privé avec une vraie isolation », un autre registre atteindra le même
        plafond &mdash; il vous faut un runtime géré ou l&apos;auto-hébergement.
      </p>

      <h2 id="selfhost">3. L&apos;auto-hébergement (Docker ou Kubernetes)</h2>
      <p>
        L&apos;auto-hébergement, c&apos;est l&apos;alternative au contrôle maximal : Docker sur un
        VPS, ou Kubernetes si vous l&apos;exploitez déjà. Vous obtenez le code privé,
        l&apos;isolation que vous concevez, et votre propre VPC &mdash; ce qui compte si vous avez
        une contrainte de conformité stricte. Le coût, c&apos;est que vous assumez
        l&apos;exploitation : bac à sable, TLS, rotation des secrets, capture des logs, supervision,
        et plusieurs versions en parallèle.
      </p>
      <p>
        C&apos;est le bon choix quand vous exploitez déjà assez d&apos;infrastructure pour que MCP
        soit négligeable, ou quand une politique impose le serveur dans votre propre réseau. En
        dehors de ces cas, bien faire tout cela pour un ou deux MCP demande généralement plus de
        travail que ça n&apos;en économise &mdash; le calcul complet est dans{" "}
        <Link href={"/fr/blog/managed-vs-self-hosted-mcp" as Route}>
          serveur MCP géré vs auto-hébergé
        </Link>
        .
      </p>

      <h2 id="serverless">4. Le serverless (Cloudflare Workers, Upstash Box)</h2>
      <p>
        Si vous hébergez un ou deux serveurs vous-même et voulez éviter la gestion de VM, les
        plateformes serverless peuvent faire tourner des serveurs MCP directement. La nuance : le
        transport en streaming de MCP (SSE à longue durée de vie) et les démarrages à froid se
        comportent différemment selon les fournisseurs. Un runtime géré masque tout cela ; le faire
        vous-même donne plus de contrôle et plus à exploiter.
      </p>

      <h2 id="choose">Comment choisir, en un tableau</h2>
      <table>
        <thead>
          <tr>
            <th>Besoin</th>
            <th>Meilleur choix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Uniquement des MCP publics open-source, zéro exploitation</td>
            <td>Smithery (ou un autre registre public)</td>
          </tr>
          <tr>
            <td>Code privé + isolation, toujours sans exploitation</td>
            <td>Runtime géré (TwinMCP)</td>
          </tr>
          <tr>
            <td>Conformité stricte / VPC à soi</td>
            <td>Auto-hébergement</td>
          </tr>
          <tr>
            <td>Un ou deux serveurs, sans gestion de VM</td>
            <td>Serverless</td>
          </tr>
          <tr>
            <td>Clés d&apos;équipe, journaux d&apos;audit, rotation</td>
            <td>Runtime géré ou auto-hébergement</td>
          </tr>
        </tbody>
      </table>

      <h2 id="next">Pour aller plus loin</h2>
      <p>
        Pour la matrice d&apos;hébergement complète, lisez{" "}
        <Link href={"/fr/blog/mcp-server-hosting" as Route}>
          Hébergement de serveurs MCP en 2026
        </Link>
        , et pour le détail du compromis géré/auto-hébergé,{" "}
        <Link href={"/fr/blog/managed-vs-self-hosted-mcp" as Route}>
          serveur MCP géré vs auto-hébergé
        </Link>
        . Et pour essayer la voie gérée sans vous engager, le{" "}
        <Link href={"/servers" as Route}>catalogue MCP</Link> et l&apos;
        <Link href={"/plans" as Route}>offre gratuite</Link> vous donnent un serveur isolé et tous
        les MCP populaires en quelques minutes.
      </p>
    </FrPostLayout>
  );
}
