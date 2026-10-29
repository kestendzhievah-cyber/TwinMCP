import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug, type UseCase } from "@/lib/use-cases/registry";

const SLUG = "github-mcp";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

// Honesty note: TwinMCP does NOT host GitHub's MCP server. GitHub's official
// github-mcp-server ships as a Go binary / Docker image, which has no viable
// runtime in a TwinMCP box, so the catalogue entry is retired (RETIRED_SLUGS in
// scripts/seed-mcps.ts, NOT_ON_TWINMCP in lib/servers/catalog.ts). This page
// says what works today instead. The hero copy is overridden here so the page
// never promises a hosted GitHub MCP, whatever the registry entry says.
const useCase: UseCase = {
  ...getUseCaseBySlug(SLUG)!,
  metaTitle: "GitHub MCP: what works today, and how to bring your own — TwinMCP",
  description:
    "TwinMCP does not host GitHub's official MCP server. Here is what works today: GitHub's own remote MCP server, your own npm or PyPI GitHub MCP published on TwinMCP Pro, and the GitLab and Git MCPs from the catalogue.",
  heroEyebrow: "GitHub connector",
  heroHeadline: "GitHub MCP: what works today",
  heroSubheadline:
    "TwinMCP does not host GitHub's official MCP server. You can still give your AI agent GitHub context: connect GitHub's own remote server, or bring a Node or Python GitHub MCP and run it on your TwinMCP server.",
};

export const metadata: Metadata = {
  title: { absolute: useCase.metaTitle },
  description: useCase.description,
  alternates: { canonical: `/use-cases/${SLUG}` },
  openGraph: {
    title: useCase.metaTitle,
    description: useCase.description,
    url: `${SITE_URL}/use-cases/${SLUG}`,
  },
};

const benefits = [
  {
    title: "Bring your own GitHub MCP",
    body: "On Pro, publish a GitHub MCP that ships as an npm or PyPI package as your own MCP: TwinMCP installs and starts it in your isolated server. It stays private to your account. You choose the package and keep it up to date; TwinMCP does not maintain it.",
  },
  {
    title: "Your token, encrypted per server",
    body: "Declare the GitHub token as a secret config field when you publish. The value you paste is encrypted at rest (AES-256-GCM) and only used by that server, never by another account.",
  },
  {
    title: "Git and GitLab from the catalogue",
    body: "If you need repository context rather than GitHub's API, the official catalogue has a Git MCP (status, log, diff, branches of a repo in your box) and a GitLab MCP (projects, files, issues, merge requests).",
  },
];

const steps = [
  {
    title: "Pick the route that fits",
    body: "Need GitHub's full official toolset? Connect GitHub's own remote MCP server directly from your AI client; TwinMCP is not involved. Need it next to your other MCPs, behind one API key? Bring a Node or Python GitHub MCP to TwinMCP.",
  },
  {
    title: "Create a scoped GitHub token",
    body: "From GitHub Settings → Developer settings → Personal access tokens, create a fine-grained token limited to the repositories the AI should see. Read-only contents and pull requests cover most uses.",
  },
  {
    title: "Publish the MCP on your TwinMCP server (Pro)",
    body: "In the dashboard, publish your own MCP: the npm or PyPI start command (run with npx or uvx) and a secret field for the token. Install it on a server and paste the token.",
  },
  {
    title: "Connect Cursor, Claude Code, Windsurf or VS Code",
    body: "Copy the block from the server's Connect panel: one URL for the whole server (recommended), plus an MCP-proxy ctx7sk_ key bound to that server in the Authorization header.",
  },
];

const faq = [
  {
    q: "Does TwinMCP host GitHub's official MCP server?",
    a: "No. GitHub's official server (github.com/github/github-mcp-server) ships as a Go binary and a Docker image, and neither runs in a TwinMCP sandbox today, so it is not in the catalogue. GitHub documents its own hosted (remote) version of that server; see that repository for the current endpoint and setup.",
  },
  {
    q: "Can I run a GitHub MCP on TwinMCP at all?",
    a: "Yes, on Pro, if the server you want ships as an npm or PyPI package: publish it as your own MCP with its npx or uvx start command. It runs in your isolated server and stays private to your account. You pick and maintain the package; check that it is still maintained before you rely on it.",
  },
  {
    q: "How scoped should my GitHub token be?",
    a: "Use a fine-grained personal access token, restrict it to the repositories the AI should access, and grant read-only permissions by default. Add write permissions (issues, pull requests) only if you specifically want the model to create them.",
  },
  {
    q: "What works on the Free plan?",
    a: "The official catalogue on one small server, with 50 tool calls a day. That includes the Git MCP (inspect a repository inside your box) and the GitLab MCP. Publishing your own MCP, which a GitHub MCP needs, is a Pro feature; your first Pro subscription starts with 30 days free.",
  },
  {
    q: "What happens if my GitHub token expires?",
    a: "GitHub rejects the calls and the MCP's tools return errors to your AI client. Paste a new token into the MCP's config in your TwinMCP dashboard; the new value is used on the next request. Your TwinMCP API key, the one your client uses to reach the server, is separate.",
  },
];

// The routes are typeset as a ledger: name, where it runs, hairline rows (DESIGN.md §4.5).
const ledgerRow =
  "grid gap-1 border-b border-border py-4 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-8";
const ledgerName = "text-base font-medium text-foreground";
const ledgerBody = "text-base text-muted-foreground";
const LINK = "text-brand underline decoration-brand/40 underline-offset-4 hover:decoration-brand";

export default function GithubMcpPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="rule-double py-16 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow flex items-center justify-center gap-4 before:h-px before:w-10 before:bg-border before:content-[''] after:h-px after:w-10 after:bg-border after:content-['']">
            Routes
          </p>
          <h2 className="mt-4 text-balance text-3xl font-medium md:text-4xl">
            Four ways to give your agent GitHub or Git context
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            What each route needs and where it runs. Only the last three involve TwinMCP.
          </p>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          <div
            aria-hidden
            className="smallcaps tracking-sc hidden border-b border-foreground/50 pb-2 text-xs text-muted-foreground sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] sm:gap-8"
          >
            <span>Route</span>
            <span>What it involves</span>
          </div>
          <ul className="border-t border-foreground/50 sm:border-t-0">
            <li className={ledgerRow}>
              <strong className={ledgerName}>GitHub&apos;s remote server</strong>
              <span className={ledgerBody}>
                Run by GitHub. Your AI client connects to it directly with GitHub credentials; see{" "}
                <span className="font-mono text-sm">github.com/github/github-mcp-server</span>.
              </span>
            </li>
            <li className={ledgerRow}>
              <strong className={ledgerName}>Your own GitHub MCP</strong>
              <span className={ledgerBody}>
                On TwinMCP Pro: an npm or PyPI GitHub MCP published as your own MCP, with your token
                as an encrypted secret.
              </span>
            </li>
            <li className={ledgerRow}>
              <strong className={ledgerName}>Git MCP</strong>
              <span className={ledgerBody}>
                Official catalogue, any plan: status, log, diff, show and branches of a repository
                inside your box.
              </span>
            </li>
            <li className={ledgerRow}>
              <strong className={ledgerName}>GitLab MCP</strong>
              <span className={ledgerBody}>
                Official catalogue, any plan: projects, files, issues and merge requests, with a
                GitLab access token.
              </span>
            </li>
          </ul>
          <p className="mt-8 text-sm text-muted-foreground">
            Moving off Smithery?{" "}
            <Link href={"/migrate-from-smithery" as Route} className={LINK}>
              See the migration guide
            </Link>
            . Looking for other MCPs worth installing?{" "}
            <Link href={"/blog/production-mcp-servers" as Route} className={LINK}>
              Browse production-ready MCP servers
            </Link>
            .
          </p>
        </div>
      </section>
    </UseCaseLayout>
  );
}
