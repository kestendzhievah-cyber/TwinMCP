import type { Metadata, Route } from "next";
import Link from "next/link";
import { FrPostLayout } from "@/components/blog/fr-post-layout";
import { faqPageSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const post = {
  slug: "managed-vs-self-hosted-mcp",
  title: "Serveur MCP géré vs auto-hébergé : les vrais compromis (2026)",
  description:
    "Vos serveurs MCP doivent-ils tourner sur une plateforme gérée ou sur votre propre infrastructure ? Comparaison lucide du coût, de l'exploitation, de l'isolation, de la sécurité et du passage à l'échelle — et le point de bascule où chacun l'emporte.",
  publishedAt: "2026-10-01",
  readingTimeMinutes: 10,
  tags: ["mcp", "hébergement", "auto-hébergé", "géré", "comparaison"],
};

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: "/fr/blog/managed-vs-self-hosted-mcp",
    languages: {
      en: "/blog/managed-vs-self-hosted-mcp",
      fr: "/fr/blog/managed-vs-self-hosted-mcp",
      "x-default": "/blog/managed-vs-self-hosted-mcp",
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/fr/blog/managed-vs-self-hosted-mcp`,
    publishedTime: post.publishedAt,
    locale: "fr_FR",
  },
};

const faq = [
  {
    q: "L'hébergement MCP géré coûte-t-il plus cher que l'auto-hébergement ?",
    a: "À un seul serveur, l'auto-hébergement est un peu moins cher sur le papier. À partir d'environ cinq serveurs, la charge d'exploitation de l'auto-hébergement (TLS, secrets, logs, supervision, rotation des versions) domine et le géré l'emporte généralement sur le coût total. Le point de bascule dépend de si vous exploitez déjà de l'infrastructure : si vous faites tourner Kubernetes aujourd'hui, ajouter MCP est presque gratuit ; sinon, le coût en temps est réel.",
  },
  {
    q: "Puis-je passer du géré à l'auto-hébergé plus tard ?",
    a: "Oui. Le code d'un serveur MCP est portable — le verrouillage est dans la glue de déploiement, pas dans le serveur. Pour auto-héberger un serveur que vous faisiez tourner sur une plateforme gérée, récupérez sa commande d'install/démarrage et faites tourner le même paquet npm/pip/Git dans votre propre conteneur en transport HTTP. L'inverse est tout aussi simple.",
  },
  {
    q: "Faut-il Kubernetes pour auto-héberger des serveurs MCP ?",
    a: "Non. Docker sur un seul VPS suffit pour démarrer. Mais vous assumez toujours la terminaison TLS, le stockage des secrets, la capture des logs, la supervision des processus et les mises à jour. Kubernetes ne devient utile qu'une fois que vous faites tourner de nombreux serveurs ou qu'il vous faut de la haute disponibilité — à ce moment-là, vous exploitez de la vraie infrastructure.",
  },
];

export default function Post() {
  return (
    <FrPostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>En bref.</strong> Auto-héberger un serveur MCP l&apos;emporte quand vous exploitez
        déjà de l&apos;infrastructure ou que vous avez une contrainte de conformité stricte.
        L&apos;hébergement géré l&apos;emporte presque partout ailleurs, et l&apos;écart se creuse à
        chaque serveur supplémentaire. La décision ne porte pas sur le code MCP &mdash; il est
        portable dans les deux cas &mdash; mais sur qui exploite le bac à sable, les secrets, le TLS
        et les logs.
      </p>

      <h2 id="definitions">Ce que chacun signifie vraiment</h2>
      <p>
        <strong>Auto-hébergé</strong> signifie que vous faites tourner le processus serveur
        vous-même : Docker sur un VPS, Kubernetes, ou une fonction serverless que vous déployez.
        Vous assumez la configuration de déploiement et tout ce qui l&apos;entoure &mdash;
        transport, TLS, secrets, supervision, disponibilité.
      </p>
      <p>
        <strong>Géré</strong> signifie qu&apos;une plateforme fait tourner le serveur pour vous.
        Vous le provisionnez (choisir un runtime, installer un MCP ou pointer vers votre paquet), et
        la plateforme gère le bac à sable, le chiffrement des secrets, le point d&apos;accès public
        et les logs. Un runtime géré comme <Link href={"/fr" as Route}>TwinMCP</Link> donne à chaque
        serveur son propre bac à sable isolé et une seule URL proxy + clé qui fonctionne pour
        Cursor, Claude Code, Windsurf et Cline.
      </p>

      <h2 id="cost">La vraie courbe de coût</h2>
      <p>
        C&apos;est là que la plupart des comparaisons se trompent, parce qu&apos;elles ne comptent
        que la facture serveur. La version honnête compte aussi le <em>temps</em>.
      </p>
      <ul>
        <li>
          <strong>À un serveur,</strong> un petit VPS coûte quelques euros par mois et
          l&apos;auto-hébergement paraît moins cher que n&apos;importe quel plan géré. Pour un seul
          serveur perso, c&apos;est souvent le cas.
        </li>
        <li>
          <strong>À cinq serveurs et plus,</strong> la facture par serveur cesse de compter et la
          charge d&apos;exploitation prend le dessus : renouvellement des certificats, rotation des
          secrets, envoi des logs, surveillance de la version qui a silencieusement cassé. Cette
          charge est un travail fixe que vous payez que vous ayez un serveur ou dix &mdash; et
          c&apos;est exactement ce qu&apos;un plan géré absorbe.
        </li>
      </ul>
      <p>
        Le point de bascule n&apos;est pas un nombre fixe de serveurs ; c&apos;est une fonction de
        si vous exploitez déjà de l&apos;infrastructure. Si vous faites tourner un cluster
        aujourd&apos;hui, MCP est négligeable et l&apos;auto-hébergement reste bon marché. Sinon,
        monter l&apos;exploitation ne serait-ce que pour deux serveurs demande plus de travail
        qu&apos;il n&apos;y paraît.
      </p>

      <h2 id="ops">L&apos;exploitation que vous signez réellement</h2>
      <p>
        Faire tourner un serveur MCP <em>correctement</em> &mdash; pas juste obtenir qu&apos;un
        processus réponde une fois &mdash; signifie assumer tout ceci en auto-hébergement :
      </p>
      <ul>
        <li>
          <strong>Bac à sable :</strong> un serveur MCP exécute des appels d&apos;outils qui
          touchent de vrais systèmes ; il lui faut une isolation du reste de ce que vous exploitez.
        </li>
        <li>
          <strong>Secrets :</strong> chiffrés au repos, rotés, jamais fuités dans les logs ou
          l&apos;environnement du shell.
        </li>
        <li>
          <strong>Transport &amp; TLS :</strong> un point d&apos;accès HTTPS stable, et la bonne
          gestion des connexions en streaming (SSE) à longue durée de vie de MCP.
        </li>
        <li>
          <strong>Observabilité :</strong> logs de requêtes, capture d&apos;erreurs et métriques
          &mdash; parce que le client IA vous cache la plupart des échecs.
        </li>
        <li>
          <strong>Cycle de vie :</strong> redémarrages, mises à jour, et plusieurs versions en
          parallèle sans coupure.
        </li>
      </ul>
      <p>
        Un runtime géré fait tout cela en tant que produit. L&apos;auto-hébergement, c&apos;est
        votre checklist.
      </p>

      <h2 id="security">Sécurité et isolation</h2>
      <p>
        Les deux modèles peuvent être sûrs ; ils placent la responsabilité à des endroits
        différents. L&apos;auto-hébergement vous donne le contrôle total de la frontière réseau
        &mdash; le serveur peut vivre entièrement dans votre VPC, ce qui est parfois une contrainte
        stricte. Le revers, c&apos;est que chaque garantie d&apos;isolation et de chiffrement est
        une garantie que <em>vous</em> devez implémenter et maintenir.
      </p>
      <p>
        Un bon runtime géré fait de l&apos;isolation la valeur par défaut : un bac à sable séparé
        par serveur, des secrets chiffrés par serveur, une clé dédiée par serveur, et des journaux
        d&apos;audit prêts à l&apos;emploi. La frontière est celle de la plateforme plutôt que de
        votre réseau &mdash; le bon compromis pour la plupart des équipes, le mauvais pour quelques
        unes aux règles strictes de résidence des données.
      </p>

      <h2 id="scaling">Passage à l&apos;échelle et fiabilité</h2>
      <p>
        L&apos;auto-hébergement passe à l&apos;échelle exactement aussi loin que votre maturité
        d&apos;exploitation. Ajouter le dixième serveur, survivre à la panne d&apos;un nœud, ou
        déployer une mise à jour sans couper les connexions SSE en cours sont tous résolubles
        &mdash; c&apos;est juste du travail que vous assumez. Les plateformes gérées plient cela
        dans le plan : vous provisionnez un serveur de plus et la capacité, l&apos;isolation et le
        routage viennent avec.
      </p>

      <h2 id="when-each">Quand chacun l&apos;emporte</h2>
      <p>
        <strong>Auto-hébergez</strong> quand l&apos;une de ces trois choses est vraie : une règle de
        conformité impose le serveur dans votre propre réseau, vous exploitez déjà assez
        d&apos;infrastructure pour que MCP soit gratuit, ou vous voulez précisément la visibilité au
        niveau du protocole que le faire soi-même procure.
      </p>
      <p>
        <strong>Prenez le géré</strong> quand vous voulez des serveurs MCP qui tournent dès
        aujourd&apos;hui sans assumer le bac à sable, le TLS, les secrets et la supervision &mdash;
        ce qui est le cas de la plupart des équipes, la plupart du temps. C&apos;est aussi la voie
        la plus rapide vers des serveurs privés partagés en équipe : provisionner, installer,
        partager une URL et une clé.
      </p>

      <h2 id="migration">La migration va dans les deux sens</h2>
      <p>
        Le verrouillage tue plus de décisions qu&apos;il ne le devrait, alors disons-le clairement :
        le code d&apos;un serveur MCP est portable sur toutes les options. La configuration de
        déploiement est la seule partie spécifique à la plateforme. Commencez en géré pour aller
        vite, et vous pourrez plus tard soulever un serveur dans votre propre conteneur en faisant
        tourner le même paquet en transport HTTP ; commencez en auto-hébergé et vous pourrez pointer
        un runtime géré vers le même paquet npm/pip ou dépôt Git. Choisissez pour là où vous êtes
        maintenant, pas par peur de là où vous pourriez aller.
      </p>

      <h2 id="next">Pour aller plus loin</h2>
      <p>
        Pour la matrice d&apos;hébergement complète, lisez{" "}
        <Link href={"/fr/blog/mcp-server-hosting" as Route}>
          Hébergement de serveurs MCP en 2026
        </Link>
        , et si vous hésitez entre un catalogue public et faire tourner le vôtre, voyez les{" "}
        <Link href={"/fr/blog/smithery-alternatives" as Route}>alternatives à Smithery</Link>. Pour
        essayer la voie gérée, l&apos;<Link href={"/plans" as Route}>offre gratuite</Link> vous
        donne un serveur isolé et le <Link href={"/servers" as Route}>catalogue MCP</Link> complet
        en quelques minutes.
      </p>
    </FrPostLayout>
  );
}
