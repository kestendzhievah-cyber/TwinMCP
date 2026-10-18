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
            {s.snippet && (
              <div className="mt-6 min-w-0">
                <CodeSnippet code={mcpJsonExample} language="json" filename="~/.cursor/mcp.json" />
              </div>
            )}
          </li>
        ))}
      </ol>
    </Section>
  );
}
