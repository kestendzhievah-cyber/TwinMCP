import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Separator } from "@/components/ui/separator";

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

// Links in running text: pinstripe navy with a hairline underline (DESIGN.md §5).
const LINK = "text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

// Section eyebrow sitting between two short hairlines (DESIGN.md §4.7).
const EYEBROW_RULES =
  "eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']";

// Numbered steps: the number pressed into a hairline square (DESIGN.md §5).
const STEP =
  "flex gap-4 [counter-increment:step] before:grid before:h-9 before:w-9 before:shrink-0 before:place-items-center before:border before:border-border before:text-sm before:font-medium before:text-foreground before:content-[counter(step)] before:[font-variant-numeric:lining-nums]";

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

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_strong]:font-medium">
        <nav
          aria-label="Fil d'Ariane"
          className="smallcaps tracking-sc mb-10 text-xs text-muted-foreground"
        >
          <ol className="flex items-center gap-2">
            <li>
              <Link href={"/fr" as Route} className="hover:text-foreground">
                Accueil
              </Link>
            </li>
            <li aria-hidden>·</li>
            <li aria-current="page" className="text-foreground">
              Documentation
            </li>
          </ol>
        </nav>

        <header className="mb-14 text-center">
          <p className={EYEBROW_RULES}>Guide de référence</p>
          <h1 className="display letterpress mt-5 text-4xl sm:text-5xl">Documentation TwinMCP</h1>
          <div aria-hidden className="mx-auto mt-6 h-px w-12 bg-foreground/40" />
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
            Créez un serveur MCP dans un environnement isolé, installez des connecteurs depuis le
            catalogue, et branchez Cursor, Claude Code, Windsurf ou Cline en deux minutes.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm italic text-muted-foreground">
            Le tableau de bord est en anglais ; les messages d&apos;erreur sont donc cités tels
            quels, avec l&apos;explication en français.
          </p>
          <Separator variant="double" className="mt-10" />
        </header>

        <div className="divide-y divide-border">
          <section id="demarrage" className="py-12 first:pt-0">
            <h2 className="text-3xl font-medium">Démarrage rapide</h2>
            <ol role="list" className="mt-6 list-none space-y-5 [counter-reset:step]">
              <li className={STEP}>
                <span className="pt-1.5">
                  <Link href="/sign-up" className={LINK}>
                    Créez un compte gratuit
                  </Link>{" "}
                  — sans carte bancaire.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Depuis le tableau de bord, cliquez sur <strong>Create server</strong>, donnez-lui
                  un nom et choisissez une taille. Le démarrage prend environ 10 à 30 secondes.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Ouvrez la <strong>Marketplace</strong> et installez un ou plusieurs connecteurs
                  MCP sur votre serveur (GitHub, Notion, Postgres, Slack…).
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Copiez l&apos;URL du serveur et la clé API (préfixe <code>ctx7sk_</code>), puis
                  collez-les dans la configuration MCP de votre IDE — le panneau{" "}
                  <strong>Connect</strong> du serveur génère le bloc exact pour chaque client
                  (Cursor, Claude Desktop, Claude Code, VS Code, Windsurf, Cline, Zed).
                </span>
              </li>
            </ol>
          </section>

          <section id="concepts" className="py-12">
            <h2 className="text-3xl font-medium">Les concepts en bref</h2>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="text-2xl font-medium">Serveur MCP</h3>
                <p className="mt-2 text-base leading-7">
                  Un environnement d&apos;exécution isolé qui héberge vos connecteurs MCP. Chaque
                  serveur tourne dans sa propre sandbox, avec ses secrets (chiffrés), son système de
                  fichiers et sa politique réseau.
                </p>
              </div>

              <div className="py-5">
                <h3 className="text-2xl font-medium">Connecteurs (MCPs)</h3>
                <p className="mt-2 text-base leading-7">
                  Plus de 70 connecteurs installables en un clic depuis le catalogue, sans écrire de
                  code : GitHub, GitLab, Postgres, MongoDB, Notion, Slack, HubSpot, et bien
                  d&apos;autres.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="text-2xl font-medium">Clés API</h3>
                <p className="mt-2 text-base leading-7">
                  Chaque serveur est accessible via une URL HTTP protégée par votre clé API. Vous
                  pouvez créer une nouvelle clé à tout moment ; l&apos;ancienne continue de
                  fonctionner jusqu&apos;à ce que vous la révoquiez explicitement — pratique pour
                  mettre à jour vos postes sans coupure.
                </p>
              </div>
            </div>
          </section>

          <section id="depannage" className="py-12">
            <h2 className="text-3xl font-medium">Dépannage</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Chaque entrée cite le message exact affiché par le produit (en anglais), pour le
              retrouver par Ctrl+F.
            </p>

            <div className="mt-6 divide-y divide-border">
              <div className="py-6 first:pt-0">
                <h3 className="text-2xl font-medium">Serveur bloqué sur « provisioning »</h3>
                <p className="mt-2 text-base leading-7">
                  Le démarrage prend normalement ~30 secondes. Au-delà de quelques minutes,
                  rechargez la page : la plateforme bascule automatiquement en <code>error</code>{" "}
                  tout serveur bloqué plus de 15 minutes, et le bouton <strong>Start</strong>{" "}
                  réapparaît alors — cliquez-le pour relancer. Si le problème persiste, contactez le
                  support (ci-dessous) avec le slug du serveur.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  « Unauthorized — check your API key. » (HTTP 401)
                </h3>
                <p className="mt-2 text-base leading-7">
                  La clé dans votre configuration est erronée, révoquée, ou c&apos;est encore le
                  placeholder. Ouvrez <strong>Dashboard → API keys</strong>, créez ou copiez une clé
                  (préfixe <code>ctx7sk_</code>), collez-la dans l&apos;en-tête{" "}
                  <code>Authorization: Bearer …</code>, puis redémarrez votre IDE pour qu&apos;il
                  recharge le fichier.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  « Server isn&apos;t running yet — start it and retry in a moment. » (HTTP 503)
                </h3>
                <p className="mt-2 text-base leading-7">
                  Le serveur est arrêté ou en cours de réveil. Ouvrez sa page, cliquez{" "}
                  <strong>Start</strong>, attendez le badge <code>running</code>, puis réessayez.
                  Les serveurs du plan gratuit se mettent en veille après inactivité — la première
                  requête au réveil peut prendre quelques secondes de plus.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  Statut « error » — « The runtime failed to start. »
                </h3>
                <p className="mt-2 text-base leading-7">
                  Ouvrez l&apos;onglet <strong>Logs</strong> du serveur. La cause la plus fréquente
                  : une valeur de configuration invalide sur un connecteur installé (jeton API
                  erroné, chaîne de connexion incorrecte). Corrigez la configuration du connecteur,
                  puis cliquez <strong>Start</strong>.
                </p>
              </div>

              <div className="py-6">
                <h3 className="text-2xl font-medium">
                  Claude Desktop / Zed ne se connecte pas (pont mcp-remote)
                </h3>
                <p className="mt-2 text-base leading-7">
                  Les clients sans support HTTP natif passent par <code>npx -y mcp-remote</code> :
                  il faut Node.js 18+ sur le poste, le premier lancement peut prendre une minute, et
                  le client doit être complètement redémarré après modification de son fichier de
                  configuration. Le bouton <strong>Test connection</strong> du panneau Connect
                  vérifie le serveur lui-même — s&apos;il passe, le problème est côté client.
                </p>
              </div>

              <div className="py-6 last:pb-0">
                <h3 className="text-2xl font-medium">Toujours bloqué ? Contactez le support</h3>
                <p className="mt-2 text-base leading-7">
                  Écrivez à{" "}
                  <a href="mailto:hello@twinmcp.fr" className={LINK}>
                    hello@twinmcp.fr
                  </a>{" "}
                  en précisant : le <strong>slug du serveur</strong> (affiché sur sa page), le{" "}
                  <strong>message d&apos;erreur exact</strong>, le contenu de l&apos;onglet{" "}
                  <strong>Logs</strong>, et l&apos;heure approximative du problème. Avec ces
                  éléments, pas d&apos;allers-retours inutiles.
                </p>
              </div>
            </div>
          </section>

          <section id="ressources" className="py-12 last:pb-0">
            <h2 className="text-3xl font-medium">Ressources</h2>
            <ul role="list" className="mt-6 divide-y divide-border border-y border-border">
              <li className="py-3 leading-7">
                <Link href="/plans" className={LINK}>
                  Offres et quotas
                </Link>{" "}
                <span className="text-muted-foreground">
                  — gratuit, Pro et Team (page en anglais).
                </span>
              </li>
              <li className="py-3 leading-7">
                <Link href={"/docs/api-reference" as Route} className={LINK}>
                  Référence API interactive
                </Link>{" "}
                <span className="text-muted-foreground">
                  — l&apos;API REST complète du plan de contrôle.
                </span>
              </li>
              <li className="py-3 leading-7">
                <Link href={"/fr/entreprises" as Route} className={LINK}>
                  Offre entreprises
                </Link>{" "}
                <span className="text-muted-foreground">
                  — déploiement accompagné pour PME et ETI.
                </span>
              </li>
              <li className="py-3 leading-7">
                <a
                  href="https://modelcontextprotocol.io"
                  rel="noopener noreferrer"
                  target="_blank"
                  className={LINK}
                >
                  Spécification du Model Context Protocol
                </a>
              </li>
            </ul>
          </section>
        </div>
      </article>
    </>
  );
}
