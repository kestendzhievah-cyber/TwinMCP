import type { Metadata, Route } from "next";
import Link from "next/link";
import { UseCaseLayout } from "@/components/use-cases/use-case-layout";
import { getUseCaseBySlug } from "@/lib/use-cases/registry";

const SLUG = "github-mcp";
const useCase = getUseCaseBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: useCase.metaTitle,
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
    title: "GitHub's official MCP server, hosted",
    body: "Runs GitHub's own github-mcp-server (the maintained successor to Anthropic's deprecated @modelcontextprotocol/server-github) in an isolated sandbox. Same tools, none of the laptop-token risk.",
  },
  {
    title: "Per-user personal access tokens",
    body: "Each TwinMCP user provides their own scoped GitHub PAT. The model sees what you can see — no shared bot account, no permission ambiguity.",
  },
  {
    title: "Tool-call audit logs",
    body: "Tool invocations are captured in audit logs (30-day retention on Pro, 90-day on Team) with timestamps. Compliance-friendly out of the box.",
  },
];

const steps = [
  {
    title: "Generate a scoped GitHub PAT",
    body: "From GitHub Settings → Developer settings → Personal access tokens, create a fine-grained PAT scoped to the repositories the AI should see. Read-only contents + read-only pull requests covers most use cases.",
  },
  {
    title: "Install the GitHub MCP from the TwinMCP marketplace",
    body: "One click in the dashboard. Paste the PAT into the encrypted secret field; TwinMCP stores it hashed and only decrypts at runtime.",
  },
  {
    title: "Connect Cursor, Claude, or Windsurf",
    body: "Copy the host-specific snippet from your dashboard. URL plus Authorization bearer is all your AI client needs.",
  },
  {
    title: "Ask the model to look at your repos",
    body: 'Triggers like "summarize the open PRs on repo X" or "find issues mentioning rate limit" make the AI call the GitHub MCP automatically.',
  },
];

const faq = [
  {
    q: "What can the GitHub MCP do, exactly?",
    a: "List repositories, read file contents, browse and comment on pull requests, list and create issues, create branches, inspect GitHub Actions runs. The full tool list is documented at github.com/github/github-mcp-server (GitHub's official server) and visible in your TwinMCP dashboard once installed.",
  },
  {
    q: "How scoped should my GitHub PAT be?",
    a: "Use a fine-grained PAT, restrict it to the specific repositories the AI should access, and grant read-only scopes by default. Add write scopes (issues, pull requests) only if you specifically want the model to create them.",
  },
  {
    q: "Can the AI accept its own pull requests?",
    a: "Only if your PAT has the merge scope and the repository allows it. By default, the AI can comment and request reviews but not merge. We strongly recommend leaving merging to humans.",
  },
  {
    q: "Does the GitHub MCP work with GitHub Enterprise?",
    a: "Yes. The upstream server accepts a custom API base URL. In your TwinMCP install dialog, set the GITHUB_API_URL field to your Enterprise endpoint (https://github.your-company.com/api/v3).",
  },
  {
    q: "What happens if my GitHub PAT expires?",
    a: "GitHub returns 401 on every tool call. The AI host shows a red dot next to the server. Update the PAT in your TwinMCP dashboard — once you replace the upstream GitHub token, the new value takes effect on the next request. (Your TwinMCP API key — the one Cursor or Claude uses to reach the server — is separate; rotating that one uses a short grace period to avoid downtime.)",
  },
];

export default function GithubMcpPage() {
  return (
    <UseCaseLayout useCase={useCase} benefits={benefits} steps={steps} faq={faq}>
      <section className="mb-20">
        <h2 className="text-3xl font-semibold tracking-tight">
          What the AI can do with the GitHub MCP
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          A non-exhaustive list of the tools your AI host (Cursor, Claude, Windsurf) gets when you
          connect the hosted GitHub MCP:
        </p>
        <ul className="mt-6 space-y-3 text-base text-muted-foreground">
          <li>
            <strong className="text-foreground">list_repositories</strong> &mdash; enumerate the
            repos your PAT can see.
          </li>
          <li>
            <strong className="text-foreground">get_file_contents</strong> &mdash; read any file
            from a repo at a specific ref.
          </li>
          <li>
            <strong className="text-foreground">list_pull_requests</strong> &mdash; browse open /
            closed / merged PRs across the repos in scope.
          </li>
          <li>
            <strong className="text-foreground">create_pull_request</strong> &mdash; open a PR
            (write scope required).
          </li>
          <li>
            <strong className="text-foreground">create_issue</strong> &mdash; file an issue with
            title, body, labels, assignees.
          </li>
          <li>
            <strong className="text-foreground">get_workflow_run</strong> &mdash; inspect CI runs to
            debug failing pipelines.
          </li>
        </ul>
        <p className="mt-6 text-sm text-muted-foreground">
          Looking for the broader catalogue of MCPs worth installing?{" "}
          <Link
            href={"/blog/production-mcp-servers" as Route}
            className="font-medium underline underline-offset-4 hover:text-foreground"
          >
            Browse 10 production-ready MCP servers
          </Link>
          .
        </p>
      </section>
    </UseCaseLayout>
  );
}
