import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: "Documentation — TwinMCP",
  description:
    "Documentation TwinMCP en français : créer un serveur MCP, installer des connecteurs depuis le catalogue, brancher Cursor, Claude Code, Windsurf ou Cline, et résoudre les problèmes courants.",
  alternates: {
    canonical: "/fr/docs",
    languages: { en: "/docs", fr: "/fr/docs", "x-default": "/docs" },
  },
  openGraph: {
    title: "Documentation TwinMCP",
    description:
      "Guide de prise en main en français : serveurs MCP hébergés, connexion aux IDE et agents IA, dépannage.",
    url: `${SITE_URL}/fr/docs`,
    locale: "fr_FR",
  },
};

// The dashboard and product UI are English-only (by design), so error messages
// are quoted verbatim in English with the explanation in French — that's what
// users will actually see and Ctrl+F for.
export default function DocsPageFr() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbListSchema([
            { name: "Accueil", url: "/fr" },
            { name: "Documentation", url: "/fr/docs" },
          ]),
          articleSchema({
            headline: "Documentation TwinMCP",
            description:
              "Guide de référence en français : créer des serveurs MCP hébergés sur TwinMCP et les connecter à vos agents IA.",
            url: "/fr/docs",
            datePublished: "2026-10-13",
            inLanguage: "fr",
          }),
        ]}
      />

      <article className="mx-auto max-w-3xl px-6 py-16">
        <nav aria-label="Fil d'Ariane" className="mb-8 text-sm text-muted-foreground">
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li aria-current="page" className="text-foreground">
              Documentation
            </li>
          </ol>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Documentation TwinMCP</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Créez un serveur MCP dans un environnement isolé, installez des connecteurs depuis
            le catalogue, et branchez Cursor, Claude Code, Windsurf ou Cline en deux minutes.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Le tableau de bord est en anglais ; les messages d&apos;erreur sont donc cités tels
            quels, avec l&apos;explication en français.
          </p>
        </header>

        <section id="demarrage" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Démarrage rapide</h2>
          <ol className="mt-4 list-decimal space-y-3 pl-6 text-base leading-relaxed">
            <li>
              <Link href="/sign-up" className="font-medium underline underline-offset-4">
                Créez un compte gratuit
              </Link>{" "}
              — sans carte bancaire.
            </li>
            <li>
              Depuis le tableau de bord, cliquez sur <strong>Create server</strong>, donnez-lui
              un nom et choisissez une taille. Le démarrage prend environ 10 à 30 secondes.
            </li>
            <li>
              Ouvrez la <strong>Marketplace</strong> et installez un ou plusieurs connecteurs
              MCP sur votre serveur (GitHub, Notion, Postgres, Slack…).
            </li>
            <li>
              Copiez l&apos;URL du serveur et la clé API (préfixe <code>ctx7sk_</code>), puis
              collez-les dans la configuration MCP de votre IDE — le panneau{" "}
              <strong>Connect</strong> du serveur génère le bloc exact pour chaque client
              (Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline, Zed).
            </li>
          </ol>
        </section>

        <section id="concepts" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Les concepts en bref</h2>

          <h3 className="mt-6 text-xl font-semibold">Serveur MCP</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Un environnement d&apos;exécution isolé qui héberge vos connecteurs MCP. Chaque
            serveur tourne dans sa propre sandbox, avec ses secrets (chiffrés), son système de
            fichiers et sa politique réseau.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Connecteurs (MCPs)</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Plus de 70 connecteurs installables en un clic depuis le catalogue, sans écrire de
            code : GitHub, GitLab, Postgres, MongoDB, Notion, Slack, HubSpot, et bien
            d&apos;autres.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Clés API</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Chaque serveur est accessible via une URL HTTP protégée par votre clé API. Vous
            pouvez créer une nouvelle clé à tout moment ; l&apos;ancienne continue de
            fonctionner jusqu&apos;à ce que vous la révoquiez explicitement — pratique pour
            mettre à jour vos postes sans coupure.
          </p>
        </section>

        <section id="depannage" className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight">Dépannage</h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Chaque entrée cite le message exact affiché par le produit (en anglais), pour le
            retrouver par Ctrl+F.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Serveur bloqué sur « provisioning »</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Le démarrage prend normalement ~30 secondes. Au-delà de quelques minutes,
            rechargez la page : la plateforme bascule automatiquement en <code>error</code>{" "}
            tout serveur bloqué plus de 15 minutes, et le bouton <strong>Start</strong>{" "}
            réapparaît alors — cliquez-le pour relancer. Si le problème persiste, contactez le
            support (ci-dessous) avec le slug du serveur.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            « Unauthorized — check your API key. » (HTTP 401)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            La clé dans votre configuration est erronée, révoquée, ou c&apos;est encore le
            placeholder. Ouvrez <strong>Dashboard → API keys</strong>, créez ou copiez une clé
            (préfixe <code>ctx7sk_</code>), collez-la dans l&apos;en-tête{" "}
            <code>Authorization: Bearer …</code>, puis redémarrez votre IDE pour qu&apos;il
            recharge le fichier.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            « Server isn&apos;t running yet — start it and retry in a moment. » (HTTP 503)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Le serveur est arrêté ou en cours de réveil. Ouvrez sa page, cliquez{" "}
            <strong>Start</strong>, attendez le badge <code>running</code>, puis réessayez.
            Les serveurs du plan gratuit se mettent en veille après inactivité — la première
            requête au réveil peut prendre quelques secondes de plus.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            Statut « error » — « The runtime failed to start. »
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Ouvrez l&apos;onglet <strong>Logs</strong> du serveur. La cause la plus fréquente :
            une valeur de configuration invalide sur un connecteur installé (jeton API erroné,
            chaîne de connexion incorrecte). Corrigez la configuration du connecteur, puis
            cliquez <strong>Start</strong>.
          </p>

          <h3 className="mt-6 text-xl font-semibold">
            Claude Desktop / Zed ne se connecte pas (pont mcp-remote)
          </h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Les clients sans support HTTP natif passent par <code>npx -y mcp-remote</code> :
            il faut Node.js 18+ sur le poste, le premier lancement peut prendre une minute, et
            le client doit être complètement redémarré après modification de son fichier de
            configuration. Le bouton <strong>Test connection</strong> du panneau Connect
            vérifie le serveur lui-même — s&apos;il passe, le problème est côté client.
          </p>

          <h3 className="mt-6 text-xl font-semibold">Toujours bloqué ? Contactez le support</h3>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Écrivez à{" "}
            <a href="mailto:hello@twinmcp.fr" className="underline underline-offset-4">
              hello@twinmcp.fr
            </a>{" "}
            en précisant : le <strong>slug du serveur</strong> (affiché sur sa page), le{" "}
            <strong>message d&apos;erreur exact</strong>, le contenu de l&apos;onglet{" "}
            <strong>Logs</strong>, et l&apos;heure approximative du problème. Avec ces
            éléments, pas d&apos;allers-retours inutiles.
          </p>
        </section>

        <section id="ressources">
          <h2 className="text-2xl font-semibold tracking-tight">Ressources</h2>
          <ul className="mt-4 list-disc space-y-2 pl-6">
            <li>
              <Link href="/plans" className="underline underline-offset-4">
                Offres et quotas
              </Link>{" "}
              — gratuit, Pro et Team (page en anglais).
            </li>
            <li>
              <Link href={"/docs/api-reference" as Route} className="underline underline-offset-4">
                Référence API interactive
              </Link>{" "}
              — l&apos;API REST complète du plan de contrôle.
            </li>
            <li>
              <Link href={"/fr/entreprises" as Route} className="underline underline-offset-4">
                Offre entreprises
              </Link>{" "}
              — déploiement accompagné pour PME et ETI.
            </li>
            <li>
              <a
                href="https://modelcontextprotocol.io"
                rel="noopener noreferrer"
                target="_blank"
                className="underline underline-offset-4"
              >
                Spécification du Model Context Protocol
              </a>
            </li>
          </ul>
        </section>
      </article>
    </>
  );
}
