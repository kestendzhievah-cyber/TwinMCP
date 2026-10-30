import type { Metadata, Route } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbListSchema, articleSchema } from "@/lib/seo/schema";
import { Separator } from "@/components/ui/separator";
import { ClientSetupList } from "@/components/docs/client-setup-list";
import { DocsCodeBlock } from "@/components/docs/docs-code-block";
import { docsExampleUrl } from "@/components/docs/client-setup";
import {
  MANAGEMENT_SCOPE_MESSAGE,
  REQUEST_ID_HEADER,
  RPC_CODES,
  SERVER_SCOPE_MESSAGE,
  TROUBLESHOOTING_ANCHOR,
  docsPlanFacts,
  formatCount,
  rotationOverlapHours,
} from "@/components/docs/docs-facts";
import { API_KEY_PLACEHOLDER, IDE_LABELS, MATRIX_CLIENTS } from "@/lib/mcp/client-config";
import { TOOL_POLICY_DENIED_CODE } from "@/lib/mcp/aggregate";
import { CREDIT_RPC_CODE, CreditDocsSection } from "@/components/pricing/credit-docs-section";
import { walletFacts } from "@/components/pricing/wallet-copy";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

const CLIENT_NAMES = MATRIX_CLIENTS.map((k) => IDE_LABELS[k]);

export const metadata: Metadata = {
  title: "Documentation — TwinMCP",
  description: `Documentation TwinMCP en français : créer un serveur MCP, installer des connecteurs depuis le catalogue, brancher ${CLIENT_NAMES.join(", ")}, et résoudre les problèmes courants.`,
  alternates: {
    canonical: "/fr/docs",
    languages: { en: "/docs", fr: "/fr/docs", "x-default": "/docs" },
  },
  openGraph: {
    title: "Documentation TwinMCP",
    description:
      "Guide de prise en main en français : serveurs MCP hébergés, connexion aux IDE et agents IA, clés API, dépannage.",
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

// Account facts from lib/plan-features.ts, prices from lib/wallet/pricing.ts
// (via wallet-copy.ts); key rules from lib/auth/key-scope.ts. Never hand-typed.
const FACTS = docsPlanFacts();
const WALLET = walletFacts("fr");
const n = (v: number) => formatCount(v, "fr");
const OVERLAP_HOURS = rotationOverlapHours();

// The JSON-RPC error shape the MCP proxy returns (contract K2). The proxy's
// docsUrl points at the English page; this page carries the same anchor.
const ERROR_EXAMPLE = JSON.stringify(
  {
    jsonrpc: "2.0",
    id: 1,
    error: {
      code: RPC_CODES.wrongServer,
      message: SERVER_SCOPE_MESSAGE,
      data: {
        requestId: "<uuid>",
        docsUrl: `https://twinmcp.fr/docs#${TROUBLESHOOTING_ANCHOR}`,
      },
    },
  },
  null,
  2
);

const REQUEST_ID_CURL = [
  `curl -si -X POST ${docsExampleUrl("fr")} \\`,
  `  -H "Authorization: Bearer ${API_KEY_PLACEHOLDER}" \\`,
  '  -H "Content-Type: application/json" \\',
  '  -H "Accept: application/json, text/event-stream" \\',
  `  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}' | grep -i ${REQUEST_ID_HEADER}`,
].join("\n");

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
            catalogue, et branchez Cursor, Claude Code, VS Code ou tout autre client MCP en deux
            minutes.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-sm italic text-muted-foreground">
            Le tableau de bord est en anglais ; les noms de boutons et les messages d&apos;erreur
            sont donc cités tels quels, avec l&apos;explication en français.
          </p>
          <Separator variant="double" className="mt-10" />
        </header>

        <div className="divide-y divide-border">
          <section id="demarrage" className="py-12 first:pt-0">
            <h2 className="text-3xl font-medium">Démarrage rapide</h2>
            <ol role="list" className="mt-6 list-none space-y-5 [counter-reset:step]">
              <li className={STEP}>
                <span className="pt-1.5">
                  <Link href={"/fr/inscription?plan=free" as Route} className={LINK}>
                    Créez un compte gratuit
                  </Link>{" "}
                  — sans carte bancaire.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Depuis le tableau de bord, cliquez sur <strong>New server</strong>, donnez-lui un
                  nom et choisissez une taille. Le démarrage prend environ 10 à 30 secondes.
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Ouvrez la <strong>Marketplace</strong> et installez un ou plusieurs connecteurs
                  MCP sur votre serveur (GitLab, Notion, Postgres, Slack…).
                </span>
              </li>
              <li className={STEP}>
                <span className="pt-1.5">
                  Copiez l&apos;URL du connecteur et une clé API (préfixe <code>ctx7sk_</code>)
                  depuis le panneau <strong>Connect</strong> du serveur, puis collez-les dans la
                  configuration MCP de votre client —{" "}
                  <a href="#connecter-ide" className={LINK}>
                    tous les clients pris en charge
                  </a>{" "}
                  sont détaillés plus bas.
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
                  serveur tourne dans sa propre sandbox, avec ses secrets (chiffrés) et son système
                  de fichiers.
                </p>
              </div>

              <div className="py-5">
                <h3 className="text-2xl font-medium">Connecteurs (MCPs)</h3>
                <p className="mt-2 text-base leading-7">
                  Plus de 70 connecteurs installables en un clic depuis le catalogue, sans écrire de
                  code : GitLab, Postgres, MongoDB, Notion, Slack, HubSpot, Stripe, et bien
                  d&apos;autres. Chaque connecteur installé a sa propre URL,{" "}
                  <code>{docsExampleUrl("fr")}</code>, servie en Streamable HTTP.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="text-2xl font-medium">Votre propre MCP</h3>
                <p className="mt-2 text-base leading-7">
                  Une fois votre compte alimenté (après une première recharge), la page{" "}
                  <strong>Publish an MCP</strong> empaquette n&apos;importe quel serveur MCP stdio —
                  un paquet npm lancé avec <code>npx</code> ou un paquet PyPI lancé avec{" "}
                  <code>uvx</code> — pour l&apos;installer sur vos serveurs comme un connecteur du
                  catalogue. Il est joignable par la même URL Streamable HTTP que les autres.
                </p>
              </div>
            </div>
          </section>

          <section id="connecter-ide" className="py-12">
            <h2 className="text-3xl font-medium">Connecter votre IDE</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              TwinMCP expose un point d&apos;accès Streamable HTTP standard par connecteur. Voici le
              bloc exact pour chaque client pris en charge, avec une URL d&apos;exemple et la clé
              fictive <code>{API_KEY_PLACEHOLDER}</code>. Le panneau <strong>Connect</strong> du
              serveur génère le même bloc avec votre vraie URL et votre vraie clé.
            </p>
            <ClientSetupList locale="fr" />
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Un autre client ? Tout client MCP compatible Streamable HTTP fonctionne : donnez-lui
              l&apos;URL et l&apos;en-tête <code>Authorization: Bearer ctx7sk_…</code>. Un client
              limité au stdio peut passer par <code>npx -y mcp-remote</code>, comme dans le bloc
              Claude Desktop.
            </p>
          </section>

          <section id="cles-api" className="py-12">
            <h2 className="text-3xl font-medium">Clés API</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Chaque requête MCP porte une clé TwinMCP (préfixe <code>ctx7sk_</code>) dans
              l&apos;en-tête <code>Authorization: Bearer</code>. Les clés se créent dans{" "}
              <strong>Dashboard → API keys</strong> : {n(FACTS.freeKeys)} clés avant votre première
              recharge, {n(FACTS.proKeys)} ensuite.
            </p>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="text-2xl font-medium">Clés à accès complet</h3>
                <p className="mt-2 text-base leading-7">
                  Elles ouvrent l&apos;API REST (serveurs, clés, facturation) et tous les
                  connecteurs de tous vos serveurs. Réservez-les aux scripts qui gèrent votre
                  compte, jamais à un fichier de configuration partagé.
                </p>
              </div>

              <div className="py-5">
                <h3 className="text-2xl font-medium">Clés proxy MCP</h3>
                <p className="mt-2 text-base leading-7">
                  Elles n&apos;appellent que les points d&apos;accès MCP et peuvent être liées à un
                  seul serveur. C&apos;est la clé à coller dans la configuration d&apos;un IDE, où
                  elle reste en clair : si elle fuit, elle ne peut pas gérer votre compte, et une
                  clé liée n&apos;atteint pas vos autres serveurs. L&apos;API REST refuse une telle
                  clé avec une erreur HTTP 403 (« {MANAGEMENT_SCOPE_MESSAGE} »), et une clé liée
                  utilisée sur un autre serveur reçoit une erreur HTTP 403, code JSON-RPC{" "}
                  <code>{RPC_CODES.wrongServer}</code>.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="text-2xl font-medium">Rotation, expiration et révocation</h3>
                <p className="mt-2 text-base leading-7">
                  <strong>Rotate</strong> crée une clé de remplacement avec le même nom, la même
                  portée et le même serveur ; l&apos;ancienne clé reste valide {OVERLAP_HOURS}{" "}
                  heures, le temps de mettre à jour vos clients sans coupure, puis cesse de
                  fonctionner. Une rotation n&apos;occupe jamais d&apos;emplacement de clé
                  supplémentaire. Pendant ce délai, l&apos;ancienne clé ne peut plus créer, faire
                  tourner ni révoquer de clés (HTTP 403). <strong>Revoke</strong> prend effet
                  immédiatement. Une clé dont la date d&apos;expiration est passée est refusée
                  exactement comme une clé révoquée.
                </p>
              </div>
            </div>
          </section>

          <section id="cycle-de-vie" className="py-12">
            <h2 className="text-3xl font-medium">Cycle de vie d&apos;un serveur</h2>

            <div className="mt-6 divide-y divide-border">
              <div className="py-5 first:pt-0">
                <h3 className="text-2xl font-medium">Pause</h3>
                <p className="mt-2 text-base leading-7">
                  Le bouton <strong>Pause</strong> met en pause la sandbox du serveur et conserve
                  son disque : connecteurs installés, configuration, secrets et données sont
                  conservés. La requête MCP suivante — ou le bouton <strong>Resume</strong> sur la
                  page du serveur — le relance ; cette première requête peut prendre un peu plus de
                  temps, le temps du réveil (voir{" "}
                  <a href="#depannage" className={LINK}>
                    réveil en cours
                  </a>
                  ). Un serveur inactif peut aussi être mis en pause automatiquement et se réveille
                  de la même façon.
                </p>
              </div>

              <div className="py-5">
                <h3 className="text-2xl font-medium">Suppression de l&apos;environnement</h3>
                <p className="mt-2 text-base leading-7">
                  Le bouton <strong>Delete runtime</strong> détruit la sandbox du serveur et les
                  données qu&apos;elle contient. Il faut d&apos;abord saisir le nom du serveur, et
                  l&apos;opération est irréversible. Utilisez <strong>Pause</strong> si vous voulez
                  seulement que le serveur cesse de tourner.
                </p>
              </div>

              <div className="py-5 last:pb-0">
                <h3 className="text-2xl font-medium">Redémarrage</h3>
                <p className="mt-2 text-base leading-7">
                  Le bouton <strong>Restart</strong> recrée l&apos;environnement : la sandbox
                  actuelle est supprimée et une nouvelle est créée, qui réinstalle chaque connecteur
                  depuis sa configuration enregistrée. Les fichiers écrits dans l&apos;ancienne
                  sandbox sont perdus ; il faut donc aussi saisir le nom du serveur.
                </p>
              </div>
            </div>
          </section>

          <CreditDocsSection locale="fr" />

          <section id="depannage" className="py-12">
            {/* Same anchor as the English page, which the proxy's error.data.docsUrl
                targets, so /fr/docs#troubleshooting lands here too. */}
            <span id={TROUBLESHOOTING_ANCHOR} aria-hidden className="block" />
            <h2 className="text-3xl font-medium">Dépannage</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Chaque entrée cite le message exact affiché par le produit (en anglais), pour le
              retrouver par Ctrl+F. Les erreurs d&apos;un point d&apos;accès MCP sont des erreurs
              JSON-RPC dont le champ <code>error.data</code> contient un <code>requestId</code> et
              un lien vers cette rubrique :
            </p>
            <DocsCodeBlock code={ERROR_EXAMPLE} language="json" locale="fr" className="mt-4" />

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

              <div id="erreur-401" className="py-6">
                <h3 className="text-2xl font-medium">« Invalid API key » (HTTP 401)</h3>
                <p className="mt-2 text-base leading-7">
                  La clé dans votre configuration est erronée, révoquée, expirée (y compris une
                  ancienne clé {OVERLAP_HOURS} heures après une rotation), ou c&apos;est encore la
                  clé fictive <code>{API_KEY_PLACEHOLDER}</code>. Le bouton{" "}
                  <strong>Test connection</strong> du tableau de bord l&apos;affiche ainsi : «
                  Unauthorized — check your API key. » Ouvrez <strong>Dashboard → API keys</strong>,
                  créez ou copiez une clé (préfixe <code>ctx7sk_</code>), collez-la dans
                  l&apos;en-tête <code>Authorization: Bearer …</code>, puis redémarrez votre client
                  pour qu&apos;il recharge le fichier.
                </p>
              </div>

              <div id="erreur-403" className="py-6">
                <h3 className="text-2xl font-medium">
                  « {SERVER_SCOPE_MESSAGE} » (HTTP 403, JSON-RPC {RPC_CODES.wrongServer})
                </h3>
                <p className="mt-2 text-base leading-7">
                  La clé est une{" "}
                  <a href="#cles-api" className={LINK}>
                    clé proxy MCP
                  </a>{" "}
                  liée à un autre serveur. Utilisez une clé liée à ce serveur — le panneau{" "}
                  <strong>Connect</strong> du serveur en choisit ou en crée une — ou une clé proxy
                  qui n&apos;est liée à aucun serveur. La même clé utilisée sur l&apos;API REST
                  reçoit une erreur HTTP 403 « {MANAGEMENT_SCOPE_MESSAGE} ».
                </p>
              </div>

              <div id="erreur-402" className="py-6">
                <h3 className="text-2xl font-medium">
                  « Your TwinMCP credit is used up » (HTTP 402, JSON-RPC {CREDIT_RPC_CODE})
                </h3>
                <p className="mt-2 text-base leading-7">
                  Votre solde est à zéro : l&apos;appel d&apos;outil a été refusé avant
                  d&apos;atteindre le MCP, et il n&apos;est pas facturé. Seuls les{" "}
                  <code>tools/call</code> sont refusés — <code>initialize</code>,{" "}
                  <code>tools/list</code>, les notifications et les pings répondent toujours.
                  Rechargez à partir de {WALLET.minTopup} dans <strong>Dashboard → Billing</strong>{" "}
                  (le champ <code>error.data.topupUrl</code> de l&apos;erreur y mène), puis
                  réessayez. Pour l&apos;éviter, activez la recharge automatique. Voir{" "}
                  <a href="#credit" className={LINK}>
                    Crédit et tarifs
                  </a>
                  .
                </p>
              </div>

              <div id="erreur-429" className="py-6">
                <h3 className="text-2xl font-medium">« Too many requests » (HTTP 429)</h3>
                <p className="mt-2 text-base leading-7">
                  Trop d&apos;appels d&apos;outils en peu de temps depuis un même compte : une
                  limite par minute protège la plateforme des boucles qui s&apos;emballent. Il
                  n&apos;y a pas de plafond journalier : seul votre solde limite le volume.
                  Patientez un instant puis réessayez ; si la réponse porte <code>Retry-After</code>{" "}
                  (en secondes), attendez ce délai.
                </p>
              </div>

              <div id="erreur-503" className="py-6">
                <h3 className="text-2xl font-medium">
                  « Waking up » ou « still installing » (HTTP 503, JSON-RPC {RPC_CODES.notReady})
                </h3>
                <p className="mt-2 text-base leading-7">
                  Le serveur sort d&apos;une pause ou le connecteur est encore en cours
                  d&apos;installation. La première installation d&apos;un connecteur prend environ
                  une minute (le paquet est téléchargé dans la sandbox) ; le réveil d&apos;un
                  serveur en pause peut prendre jusqu&apos;à 30 secondes environ. La requête
                  n&apos;a pas atteint le connecteur : réessayez après le délai indiqué par{" "}
                  <code>Retry-After</code>. Le bouton <strong>Test connection</strong> du tableau de
                  bord affiche « … is still installing — this takes about a minute. »
                </p>
              </div>

              <div id="en-pause" className="py-6">
                <h3 className="text-2xl font-medium">Le serveur est en pause</h3>
                <p className="mt-2 text-base leading-7">
                  Un serveur en pause redémarre à sa prochaine requête MCP — le proxy réveille la
                  sandbox et répond en général à cette requête, un peu plus lentement ; si le réveil
                  échoue ou n&apos;est pas terminé, vous recevez l&apos;erreur 503 ci-dessus :
                  réessayez — ou cliquez <strong>Resume</strong> sur la page du serveur. Rien
                  n&apos;a été supprimé : voir{" "}
                  <a href="#cycle-de-vie" className={LINK}>
                    Cycle de vie d&apos;un serveur
                  </a>
                  . Si le serveur affiche <code>stopped</code> ou <code>error</code>, cliquez{" "}
                  <strong>Start</strong> et attendez le badge <code>running</code>.
                </p>
              </div>

              <div id="erreur-504" className="py-6">
                <h3 className="text-2xl font-medium">
                  « The MCP server did not answer in time. » (HTTP 504, JSON-RPC{" "}
                  {RPC_CODES.uncertain})
                </h3>
                <p className="mt-2 text-base leading-7">
                  Un appel d&apos;outil a dépassé le délai. Il a pu s&apos;exécuter quand même, donc
                  TwinMCP ne le renvoie pas : un outil à effet de bord (envoi d&apos;un message,
                  écriture en base) ne s&apos;exécute jamais deux fois. Vérifiez si l&apos;action a
                  eu lieu avant de réessayer.
                </p>
              </div>

              <div id="outil-bloque" className="py-6">
                <h3 className="text-2xl font-medium">
                  « Tool … is blocked by this MCP&apos;s tool access policy » (HTTP 200, JSON-RPC{" "}
                  {TOOL_POLICY_DENIED_CODE})
                </h3>
                <p className="mt-2 text-base leading-7">
                  La politique d&apos;accès aux outils du connecteur a refusé l&apos;appel avant
                  qu&apos;il n&apos;atteigne le connecteur : liste de blocage, mode lecture seule
                  (seuls les outils marqués <code>readOnlyHint</code>) ou liste d&apos;autorisation.
                  L&apos;outil ne s&apos;est pas exécuté. Pour la modifier, ouvrez le serveur, puis{" "}
                  <strong>Tool access</strong> sur le connecteur dans{" "}
                  <strong>Installed MCPs</strong>.
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

              <div id="support" className="py-6 last:pb-0">
                <h3 className="text-2xl font-medium">Toujours bloqué ? Contactez le support</h3>
                <p className="mt-2 text-base leading-7">
                  Écrivez à{" "}
                  <a href="mailto:hello@twinmcp.fr" className={LINK}>
                    hello@twinmcp.fr
                  </a>{" "}
                  en précisant : l&apos;<strong>identifiant de requête</strong>, le{" "}
                  <strong>slug du serveur</strong> (affiché sur sa page), le{" "}
                  <strong>message d&apos;erreur exact</strong>, le contenu de l&apos;onglet{" "}
                  <strong>Logs</strong>, et l&apos;heure approximative du problème (avec votre
                  fuseau horaire). Chaque réponse d&apos;un point d&apos;accès MCP porte cet
                  identifiant dans l&apos;en-tête <code>{REQUEST_ID_HEADER}</code>, et les erreurs
                  le reprennent dans <code>error.data.requestId</code>. Pour lire l&apos;en-tête
                  vous-même :
                </p>
                <DocsCodeBlock
                  code={REQUEST_ID_CURL}
                  language="bash"
                  locale="fr"
                  className="mt-4"
                />
              </div>
            </div>
          </section>

          <section id="ressources" className="py-12 last:pb-0">
            <h2 className="text-3xl font-medium">Ressources</h2>
            <ul role="list" className="mt-6 divide-y divide-border border-y border-border">
              <li className="py-3 leading-7">
                <Link href={"/fr/tarifs" as Route} className={LINK}>
                  Tarifs
                </Link>{" "}
                <span className="text-muted-foreground">
                  — la grille tarifaire, ce que permettent {WALLET.signupCredit} et un estimateur.
                </span>
              </li>
              <li className="py-3 leading-7">
                <Link href={"/docs/api-reference" as Route} className={LINK}>
                  Référence API interactive
                </Link>{" "}
                <span className="text-muted-foreground">
                  — l&apos;API REST complète du plan de contrôle (en anglais), avec une clé à accès
                  complet.
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
