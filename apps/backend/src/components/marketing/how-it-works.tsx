import type { Locale } from "@/lib/i18n/locales";
import { FREE_MCP_LIMIT } from "@/components/pricing/pricing-data";
import { walletFacts } from "@/components/pricing/wallet-copy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { marketingClientSnippets } from "@/lib/marketing/client-snippets";
import { Section } from "./section";
import { CodeSnippet } from "./code-snippet";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

// The same blocks the dashboard's Connect panel generates, one per named
// client, so the examples can never drift from what users actually paste.
const SNIPPETS = marketingClientSnippets(SITE_URL);

const EN = walletFacts("en");
const FR = walletFacts("fr");

const COPY = {
  en: {
    eyebrow: "How it works",
    title: "From sign-up to connected client in three steps",
    description:
      "No Dockerfile, no VPS. Each MCP gets its own URL, ready to paste into your client.",
    steps: [
      {
        n: 1,
        title: "Create your account",
        body: `No credit card. You start with ${EN.signupCredit} of free credit, valid ${EN.signupDays} days: ${EN.creditServers} server with up to ${FREE_MCP_LIMIT} MCPs plus TwinMCP Docs.`,
      },
      {
        n: 2,
        title: "Pick MCPs from the catalog",
        body: "Fetch, Wikipedia or Memory install in one click, with no configuration. Connectors such as Notion or Postgres ask for your own key, encrypted at rest. After your first top-up, publish your own npm or PyPI MCP.",
      },
      {
        n: 3,
        title: "Paste the URL into your client",
        body: "The same server URL works in every client below. Switch IDEs without reinstalling anything: only the config block changes.",
      },
    ],
    clientsTitle: "Works with your client",
    clientsLead:
      "Pick your client and copy the block. Replace the key with one from Dashboard → API keys; the dashboard fills in your real server URL for you.",
    tabsLabel: "MCP clients",
  },
  fr: {
    eyebrow: "Comment ça marche",
    title: "De l’inscription au client connecté, en trois étapes",
    description:
      "Pas de Dockerfile, pas de VPS : chaque MCP a sa propre URL, prête à coller dans votre client.",
    steps: [
      {
        n: 1,
        title: "Créez votre compte",
        body: `Sans carte bancaire. Vous commencez avec ${FR.signupCredit} de crédit offert, valable ${FR.signupDays} jours : ${FR.creditServers} serveur avec jusqu’à ${FREE_MCP_LIMIT} MCP plus TwinMCP Docs.`,
      },
      {
        n: 2,
        title: "Choisissez vos MCP",
        body: "Fetch, Wikipedia ou Memory s’installent en un clic, sans configuration. Les connecteurs comme Notion ou Postgres demandent votre propre clé, chiffrée au repos. Après votre première recharge, publiez votre propre MCP npm ou PyPI.",
      },
      {
        n: 3,
        title: "Collez l’URL dans votre client",
        body: "La même URL de serveur fonctionne dans tous les clients ci-dessous. Changez d’IDE sans rien réinstaller : seul le bloc de configuration change.",
      },
    ],
    clientsTitle: "Compatible avec votre client",
    clientsLead:
      "Choisissez votre client et copiez le bloc. Remplacez la clé par une clé créée dans Dashboard → API keys ; le tableau de bord y met pour vous l’URL réelle de votre serveur.",
    tabsLabel: "Clients MCP",
  },
} as const;

export function HowItWorks({ locale = "en" }: { locale?: Locale }) {
  const t = COPY[locale];
  return (
    <Section
      id="how-it-works"
      eyebrow={t.eyebrow}
      title={t.title}
      description={t.description}
      className="scroll-mt-20"
    >
      <ol className="grid gap-6 md:grid-cols-3">
        {t.steps.map((s) => (
          <li
            key={s.n}
            className="flex min-w-0 flex-col border border-border bg-card p-6 shadow-sm"
          >
            {/* The step number is stamped in a hairline square, lining figures. */}
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="lining grid h-9 w-9 shrink-0 place-items-center border border-foreground/60 text-sm font-medium text-foreground"
              >
                {s.n}
              </span>
              <h3 className="smallcaps tracking-sc text-lg font-medium">{s.title}</h3>
            </div>
            <p className="mt-4 text-base text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      {/* Works with your client: one tab per client the Connect panel supports.
          Radix Tabs give the tablist/tab/tabpanel roles and arrow-key focus. */}
      <div className="mx-auto mt-12 max-w-4xl border border-border bg-card p-6 shadow-sm md:p-8">
        <h3 className="smallcaps tracking-sc text-lg font-medium">{t.clientsTitle}</h3>
        <p className="mt-2 text-base text-muted-foreground">{t.clientsLead}</p>
        <Tabs defaultValue={SNIPPETS[0]?.id} className="mt-6 min-w-0">
          <TabsList aria-label={t.tabsLabel}>
            {SNIPPETS.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SNIPPETS.map((s) => (
            <TabsContent key={s.id} value={s.id} className="min-w-0">
              <CodeSnippet
                code={s.code}
                language={s.language}
                filename={s.filename}
                locale={locale}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Section>
  );
}
