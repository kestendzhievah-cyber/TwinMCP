import { Section } from "./section";
import { CodeSnippet } from "./code-snippet";

const mcpJsonExample = `{
  "mcpServers": {
    "twinmcp": {
      "url": "https://prod-cluster.mcp.twinmcp.fr",
      "apiKey": "tmcp_live_••••••••"
    }
  }
}`;

const steps = [
  {
    n: 1,
    title: "Sign up",
    body: "Create an account with GitHub or email. Free tier ships with 1 server, 5 official MCPs, and an API key — no card required.",
  },
  {
    n: 2,
    title: "Pick MCPs from the marketplace",
    body: "Install filesystem, github, fetch, postgres, or your own published MCP. Configs are encrypted at rest and reloaded on the fly.",
  },
  {
    n: 3,
    title: "Connect your IDE",
    body: "Drop one block into your mcp.json and point Cursor, Claude Code, or Windsurf at your TwinMCP server URL.",
    snippet: true,
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how-it-works"
      eyebrow="How it works"
      title="From signup to connected IDE in three steps"
      description="No Dockerfile to write, no Helm chart to maintain. Just a URL, an API key, and the MCPs you want."
    >
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li
            key={s.n}
            className="flex flex-col rounded-xl border border-border/80 bg-card p-6"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-full border border-border bg-secondary text-sm font-semibold tabular-nums text-foreground"
            >
              {s.n}
            </span>
            <h3 className="mt-4 font-semibold tracking-tight">{s.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
            {s.snippet && (
              <div className="mt-5">
                <CodeSnippet
                  code={mcpJsonExample}
                  language="json"
                  filename="~/.cursor/mcp.json"
                />
              </div>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
