// Public MCP server catalog — curated, decoupled from the internal mcp_servers
// table to keep marketing content stable when product seed data evolves.
//
// Each entry powers /servers/<slug> with per-MCP content rich enough to avoid
// thin-content penalties. Update this registry when adding/removing entries
// from the public site.

export type ServerKind = "official" | "community" | "hosted-remote";

export interface ServerTool {
  name: string;
  description: string;
}

export interface ServerFaqItem {
  q: string;
  a: string;
}

export interface ServerEntry {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  kind: ServerKind;
  maintainer: string;
  source: string; // GitHub repo or homepage
  packageOrImage: string; // npm package, container image, or remote URL
  // Long-form description (markdown-free, plain text — rendered as paragraphs)
  description: string[];
  tools: ServerTool[];
  installStdio: string; // command line for stdio (Cursor / Claude Desktop)
  installHttp: string | null; // command for HTTP / hosted setup (Claude Code), or null if N/A
  setupSteps: string[];
  useCases: string[];
  faq: ServerFaqItem[];
  relatedSlugs: string[];
  relatedBlogSlugs: string[];
  warnings?: string[]; // optional caveats (e.g. "deprecated", "experimental")
}

export const SERVERS: ServerEntry[] = [
  // ───────────────────────────── Official Anthropic ─────────────────────────────
  {
    slug: "filesystem",
    name: "Filesystem MCP",
    category: "Local system",
    tagline: "Sandboxed read and write access to a local directory you whitelist at startup.",
    kind: "official",
    maintainer: "Model Context Protocol project",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-filesystem",
    description: [
      "The Filesystem MCP gives an AI agent the ability to read, write, list, and search files inside a directory you explicitly allow at startup. The whitelist is enforced at the server boundary — not by prompting — so a confused model cannot escape the configured path.",
      "This is one of the canonical day-one MCPs. It works as a stdio child process of your AI host (Cursor, Claude Desktop, Claude Code, Windsurf) and starts up in under a second. The trade-off versus an HTTP-hosted variant is that state is per-session and the server only lives as long as the host process.",
    ],
    tools: [
      { name: "read_file", description: "Read the contents of a file by path." },
      { name: "write_file", description: "Create or overwrite a file at a given path." },
      { name: "list_directory", description: "List entries in a directory." },
      { name: "search_files", description: "Glob-search files matching a pattern." },
      { name: "move_file", description: "Rename or move a file." },
      { name: "create_directory", description: "Create a new directory." },
    ],
    installStdio: "npx -y @modelcontextprotocol/server-filesystem /absolute/path/to/whitelist",
    installHttp: null,
    setupSteps: [
      "Decide which directory the AI should be able to touch — keep it scoped (a project folder, not your $HOME).",
      "Add the server to your AI host's MCP config with the absolute whitelisted path as the last argument.",
      "Reload the host. The Filesystem tools appear in the model's catalog.",
      "Confirm the first write — most hosts ask before letting a tool execute a destructive action.",
    ],
    useCases: [
      "Project-local code review: have the AI read every file in src/ and summarize the architecture.",
      "Doc drafting: ask the AI to read existing docs and propose updates in adjacent files.",
      "Refactors: let the AI read multiple files, draft a refactor plan, then apply it under your supervision.",
    ],
    faq: [
      {
        q: "Can the model escape the whitelisted directory?",
        a: "Not via the server — the path constraint is enforced at the handler level, not just the prompt. The model can attempt to pass a path outside the whitelist; the server rejects it.",
      },
      {
        q: "Is it safe to point this at $HOME?",
        a: "It works, but it is a bad idea. The Filesystem MCP is designed for project-scoped access. Pointing it at $HOME gives the model read access to every credential, dotfile, and SSH key on your machine.",
      },
      {
        q: "Can I run multiple Filesystem servers with different whitelists?",
        a: "Yes. Add a stanza per server in your MCP config with different names (e.g. fs-project-a, fs-project-b). Each runs as its own child process.",
      },
    ],
    relatedSlugs: ["memory", "fetch"],
    relatedBlogSlugs: ["cursor-mcp-setup", "claude-desktop-mcp", "production-mcp-servers"],
  },

  {
    slug: "memory",
    name: "Memory MCP",
    category: "Knowledge",
    tagline: "Knowledge-graph memory the model writes to and reads back across sessions.",
    kind: "official",
    maintainer: "Model Context Protocol project",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-memory",
    description: [
      "The Memory MCP gives an AI agent persistent memory between conversations. It stores facts as nodes and edges in a small knowledge graph, surviving host restarts. The model writes to it explicitly when it notices something worth remembering, and reads from it at the start of relevant conversations.",
      "Think of it as the simplest possible retrieval layer for personal AI: no embeddings, no vector store, no RAG infrastructure. Notes-by-the-model, queryable later. Scope it per-project for best results — a global memory graph gets noisy fast when contexts mix.",
    ],
    tools: [
      { name: "create_entities", description: "Add new nodes to the knowledge graph." },
      { name: "create_relations", description: "Connect existing entities with typed edges." },
      { name: "add_observations", description: "Attach facts/observations to existing entities." },
      { name: "delete_entities", description: "Remove entities and their relations." },
      { name: "search_nodes", description: "Search entities by text or type." },
      { name: "open_nodes", description: "Read the full graph around named entities." },
    ],
    installStdio: "npx -y @modelcontextprotocol/server-memory",
    installHttp: null,
    setupSteps: [
      "Add the Memory server to your AI host's MCP config (no arguments needed).",
      "Reload the host.",
      "Tell the model what to remember: 'Remember that this project uses Drizzle, not Prisma.'",
      "Next conversation, start with 'What do you know about this project?' to see what stuck.",
    ],
    useCases: [
      "Project context: remember stack choices, conventions, gotchas, on-call rotations.",
      "Long-running research: build up a knowledge graph of papers, claims, and counter-claims.",
      "Personal assistant: remember user preferences without setting them in every prompt.",
    ],
    faq: [
      {
        q: "Where is the memory stored?",
        a: "By default, in a small JSON file in the host's data directory. On stdio, it lives wherever the server process is launched from. Scope it per-project by running the server from the project root.",
      },
      {
        q: "Does the model decide what to remember automatically?",
        a: "Only if you prompt it to. The server provides the tools; the model uses them when you (or your system prompt) tells it to. Out of the box, expect the model to forget unless you remind it to use the memory.",
      },
      {
        q: "Can I share the memory across team members?",
        a: "Not directly with the default Memory MCP. For team-wide memory, point a hosted variant at a shared persistent store (S3, Postgres) and host it through TwinMCP so secrets stay encrypted.",
      },
    ],
    relatedSlugs: ["sequential-thinking", "filesystem"],
    relatedBlogSlugs: ["production-mcp-servers", "build-mcp-server"],
  },

  {
    slug: "fetch",
    name: "Fetch MCP",
    category: "Web",
    tagline: "Minimal HTTP fetcher that returns URLs as readable markdown for the model.",
    kind: "official",
    maintainer: "Model Context Protocol project",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-fetch",
    description: [
      "The Fetch MCP does one thing well: GET a URL, convert the HTML to readable markdown, return it. That's the entire interface. It replaces a dozen of the smaller MCPs people otherwise install for the same task.",
      "Pair it with the Playwright MCP for a clean split: Fetch handles static pages cheaply, Playwright handles JavaScript-rendered or interactive sites. The model will pick the right one based on the tool descriptions you give it.",
    ],
    tools: [
      {
        name: "fetch",
        description: "Fetch a URL and return the content as markdown.",
      },
    ],
    installStdio: "npx -y @modelcontextprotocol/server-fetch",
    installHttp: null,
    setupSteps: [
      "Add to your AI host's MCP config — no arguments, no env vars.",
      "Reload the host.",
      "Ask the model to fetch a URL: 'What does <some doc page> say about X?'",
    ],
    useCases: [
      "Reading docs the model has no built-in knowledge of (new framework, recent release).",
      "Pulling RFCs, blog posts, GitHub issues into the conversation by URL.",
      "Verifying claims by asking the model to fetch the primary source and quote it.",
    ],
    faq: [
      {
        q: "Does Fetch follow redirects?",
        a: "Yes, with sensible defaults. It also respects robots.txt by default — some sites will refuse.",
      },
      {
        q: "Can it handle JavaScript-rendered pages?",
        a: "No. Fetch is a pure HTTP client, so SPAs that need JS execution come back empty or partially rendered. Use the Playwright MCP for those.",
      },
      {
        q: "Will it leak my IP to the URLs it fetches?",
        a: "Yes — Fetch makes the request directly from wherever it runs. On stdio, that's your machine. On TwinMCP hosting, it's the sandbox IP. Either way, treat it like any HTTP client.",
      },
    ],
    relatedSlugs: ["playwright", "brave-search"],
    relatedBlogSlugs: ["production-mcp-servers", "secure-mcp-server"],
  },

  {
    slug: "time",
    name: "Time MCP",
    category: "Utilities",
    tagline: "Awareness of the current time and timezone arithmetic for the model.",
    kind: "official",
    maintainer: "Model Context Protocol project",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-time",
    description: [
      "Models are notoriously bad at the current date and at timezone math. The Time MCP fixes both with a tiny surface: ask what time it is, ask to convert between zones, get a stable answer.",
      "Cheap to install (no auth, no config), and surprisingly impactful — it removes a class of subtle errors in scheduling, log analysis, and reasoning about deadlines.",
    ],
    tools: [
      { name: "get_current_time", description: "Get the current time in a specified timezone." },
      { name: "convert_time", description: "Convert a time from one timezone to another." },
    ],
    installStdio: "npx -y @modelcontextprotocol/server-time",
    installHttp: null,
    setupSteps: [
      "Add to your AI host's MCP config with no arguments.",
      "Reload.",
      "Ask the model 'what time is it in Tokyo right now?' to confirm it uses the tool rather than hallucinating.",
    ],
    useCases: [
      "Scheduling: 'When does the next deploy happen in PT, CET, and IST?'",
      "Log analysis: ground absolute timestamps in 'how long ago that was.'",
      "Calendar work: tame timezone math when arranging across hemispheres.",
    ],
    faq: [
      {
        q: "Does the model automatically use this tool when asked about time?",
        a: "Usually, yes — the tool description is unambiguous enough that the model chooses it instead of guessing. If you find it still hallucinating dates, mention 'use the time tool' explicitly in your prompt.",
      },
      {
        q: "Is the IANA timezone database bundled?",
        a: "Yes — the server ships its own copy via the platform's Intl support. No external dependency.",
      },
    ],
    relatedSlugs: ["sequential-thinking", "memory"],
    relatedBlogSlugs: ["production-mcp-servers"],
  },

  {
    slug: "sequential-thinking",
    name: "Sequential Thinking MCP",
    category: "Reasoning",
    tagline: "Externalised chain-of-thought buffer the model writes into when planning.",
    kind: "official",
    maintainer: "Model Context Protocol project",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-sequential-thinking",
    description: [
      "Sequential Thinking gives the model a scratchpad to plan multi-step work explicitly before executing. The model writes its plan as a sequence of thoughts; downstream tool calls can read them back.",
      "Useful in two cases: long multi-tool workflows where the model otherwise loses track, and audit trails where you want to see what the model intended to do at each step. Lightweight and worth adding to most setups.",
    ],
    tools: [
      {
        name: "sequentialthinking",
        description:
          "Append a thought to the current plan. Each thought is numbered and can revise earlier thoughts.",
      },
    ],
    installStdio: "npx -y @modelcontextprotocol/server-sequential-thinking",
    installHttp: null,
    setupSteps: [
      "Add to your host config (no arguments needed).",
      "Reload.",
      "Prompt the model to plan before acting on complex tasks: 'Think step by step about how you will do this before calling any other tool.'",
    ],
    useCases: [
      "Multi-step refactors where the order of edits matters.",
      "Debugging sessions: model writes hypotheses, then validates them against tools.",
      "Researching: model lays out a search plan before invoking Fetch or web search.",
    ],
    faq: [
      {
        q: "Is this really necessary if Claude already has extended thinking?",
        a: "Different mechanism. Extended thinking is internal and ephemeral. Sequential Thinking is an explicit, externally-visible plan that other tools (and audit logs) can read.",
      },
      {
        q: "Does it slow down responses?",
        a: "Marginally — the model spends more tokens planning. For trivial tasks, that's overhead. For multi-step work, it usually pays for itself in fewer wrong moves.",
      },
    ],
    relatedSlugs: ["memory", "time"],
    relatedBlogSlugs: ["production-mcp-servers"],
  },

  // ───────────────────────────── Vendor-shipped ─────────────────────────────
  {
    slug: "github",
    name: "GitHub MCP",
    category: "Developer tools",
    tagline:
      "GitHub's official MCP server — repos, pull requests, issues, Actions, all via Go binary.",
    kind: "official",
    maintainer: "GitHub",
    source: "https://github.com/github/github-mcp-server",
    packageOrImage: "ghcr.io/github/github-mcp-server",
    description: [
      "Maintained by GitHub themselves, github-mcp-server is the successor to Anthropic's deprecated @modelcontextprotocol/server-github npm package. It ships as a Go binary distributed primarily via Docker, which means you don't need a Node toolchain on the machine running it.",
      "Authentication is a GitHub personal access token (fine-grained recommended) or a GitHub App. Scopes determine what the model can see and do — start with read-only and add write scopes deliberately. An unscoped token gives the AI write access to every repo you can touch.",
    ],
    tools: [
      { name: "list_repositories", description: "Enumerate repos the token can see." },
      { name: "get_file_contents", description: "Read any file from a repo at a specific ref." },
      { name: "list_pull_requests", description: "Browse open / closed / merged PRs." },
      { name: "get_pull_request", description: "Read a PR's full diff, comments, reviews." },
      { name: "create_pull_request", description: "Open a PR (write scope required)." },
      { name: "list_issues", description: "Search and filter issues across the org." },
      { name: "create_issue", description: "File an issue with labels, assignees, body." },
      { name: "get_workflow_run", description: "Inspect a GitHub Actions run for debugging." },
    ],
    installStdio:
      "docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server",
    installHttp:
      'claude mcp add github --transport http https://github.your-team.twinmcp.dev/mcp --header "Authorization: Bearer tw_live_..."',
    setupSteps: [
      "Generate a fine-grained GitHub PAT scoped to the repositories you want the AI to access.",
      "Choose default scopes: read-only contents + read-only pull requests for daily use.",
      "Add the server to your AI host's MCP config with the Docker command above.",
      "Reload the host and confirm the GitHub tools appear with green status.",
      "When the model wants to make a write change, you'll see a confirmation dialog — review every one.",
    ],
    useCases: [
      "Code archaeology: 'When did this function last change, and why?'",
      "PR review prep: have the AI summarize an open PR and surface risks.",
      "Issue triage: cluster recent issues by theme; draft labels and assignees.",
      "CI debugging: ask the AI to read the failing workflow run and propose a fix.",
    ],
    faq: [
      {
        q: "Why not the @modelcontextprotocol/server-github npm package?",
        a: "That package has been deprecated. GitHub now ships its own server (this one) as the maintained canonical option. The Go binary is more reliable on Windows and avoids Node version mismatches.",
      },
      {
        q: "Can I use this with GitHub Enterprise?",
        a: "Yes. Set the GITHUB_API_URL environment variable to your Enterprise endpoint (https://github.your-company.com/api/v3) when launching the container.",
      },
      {
        q: "Should I let the AI merge its own pull requests?",
        a: "No. Strongly recommend leaving merge permissions off the token. The AI can comment and request reviews; humans should merge.",
      },
    ],
    relatedSlugs: ["linear", "filesystem"],
    relatedBlogSlugs: ["production-mcp-servers", "secure-mcp-server", "cursor-mcp-setup"],
    warnings: ["Replaces the deprecated @modelcontextprotocol/server-github npm package."],
  },

  {
    slug: "linear",
    name: "Linear MCP",
    category: "Project management",
    tagline: "Linear's official hosted remote MCP — connect directly via HTTP, no install.",
    kind: "hosted-remote",
    maintainer: "Linear",
    source: "https://linear.app/docs/mcp",
    packageOrImage: "https://mcp.linear.app/mcp",
    description: [
      "Linear ships an official hosted remote MCP server. Unlike most MCPs, there is nothing to install locally — you connect directly to mcp.linear.app/mcp over HTTP transport. Linear handles auth, runtime, scaling, and updates.",
      "The schema stays in sync with Linear's GraphQL API because the same team owns both. Query issues, create issues, transition status, assign teammates, comment — all reflected in real time across the Linear workspace.",
    ],
    tools: [
      { name: "list_issues", description: "Query issues by team, status, assignee, label." },
      { name: "get_issue", description: "Read a single issue with full comments and history." },
      { name: "create_issue", description: "Open a new issue with title, body, labels, assignee." },
      { name: "update_issue", description: "Change status, priority, due date, assignee." },
      { name: "list_projects", description: "Enumerate active and archived projects." },
      { name: "list_teams", description: "List Linear teams the user belongs to." },
      { name: "create_comment", description: "Add a comment to an existing issue." },
    ],
    installStdio: "# Linear MCP is hosted-only — no stdio mode.",
    installHttp: "claude mcp add linear --transport http https://mcp.linear.app/mcp",
    setupSteps: [
      "Authenticate the connection in the Linear UI when prompted (OAuth flow).",
      "Run `claude mcp add linear --transport http https://mcp.linear.app/mcp` to register with Claude Code.",
      "For Cursor: add the URL under Settings → Features → MCP with the Linear-issued token.",
      "Reload the host — Linear tools appear in the model's catalog immediately.",
    ],
    useCases: [
      "Cross-tool workflows: GitHub PR opens → AI moves the linked Linear issue to In Progress.",
      "Standup prep: 'What did the backend team ship this week?' aggregated from Linear + GitHub.",
      "Issue creation from conversation: 'File a bug for the 500 we just saw in Sentry.'",
    ],
    faq: [
      {
        q: "Does Linear MCP work with Linear's free tier?",
        a: "Yes. The MCP server is part of Linear's standard API surface and works on every paid tier; the free tier has the usual API rate limits.",
      },
      {
        q: "Can multiple people in my workspace use the same MCP connection?",
        a: "Each user authenticates individually via OAuth — Linear scopes the connection to that user's permissions. There is no shared bot account.",
      },
      {
        q: "Why hosted rather than an npm package?",
        a: "Linear's API is complex enough that maintaining a thick client wrapper drifts quickly. Hosting it themselves lets Linear update the surface in lockstep with the underlying GraphQL schema.",
      },
    ],
    relatedSlugs: ["github", "notion"],
    relatedBlogSlugs: ["production-mcp-servers", "build-mcp-server"],
  },

  {
    slug: "notion",
    name: "Notion MCP",
    category: "Knowledge",
    tagline:
      "Search Notion pages, read content, create pages — Notion's hosted remote + a local fallback.",
    kind: "official",
    maintainer: "Notion",
    source: "https://github.com/makenotion/notion-mcp-server",
    packageOrImage: "@notionhq/notion-mcp-server",
    description: [
      "Notion ships two flavors: a hosted remote MCP (recommended for most users) and a local npm package for self-managed deployments. Both expose the same primitives — search, read, create, append blocks — backed by Notion's official API.",
      "Permissions follow Notion's integration model: the integration only sees pages and databases you explicitly share with it. This is good security hygiene by default. The trade-off is verbosity: Notion's API surface is large, so token usage can be higher than for narrower tools.",
    ],
    tools: [
      { name: "search_pages", description: "Full-text search across shared pages and databases." },
      { name: "get_page", description: "Read a page's metadata, properties, and content tree." },
      { name: "create_page", description: "Create a new page under a parent page or database." },
      {
        name: "append_blocks",
        description: "Add paragraphs, headings, or bullets to an existing page.",
      },
      { name: "query_database", description: "Filter and sort entries in a Notion database." },
      { name: "update_page", description: "Edit page properties (title, status, tags, etc.)." },
    ],
    installStdio: "NOTION_TOKEN=secret_... npx -y @notionhq/notion-mcp-server",
    installHttp: "claude mcp add notion --transport http <Notion-issued URL after OAuth>",
    setupSteps: [
      "Go to notion.so/my-integrations and create a new internal integration.",
      "Copy the integration secret (begins with secret_ or ntn_).",
      "Share each Notion page or database the AI should access with the integration.",
      "For local: set NOTION_TOKEN in your MCP config env block.",
      "For hosted: complete the OAuth flow Notion presents on first connection.",
    ],
    useCases: [
      "'Find my Q2 planning doc and summarize the key bets.'",
      "Convert a Slack discussion into a Notion meeting notes page.",
      "Generate a release-notes page from a list of merged Linear issues.",
    ],
    faq: [
      {
        q: "Hosted remote or local npm package — which should I use?",
        a: "Notion recommends the hosted remote for most users; the local package is being de-prioritized. Choose local only if you have a specific reason to self-host (compliance, custom auth, etc.).",
      },
      {
        q: "Will the AI accidentally edit my workspace?",
        a: "Only pages you shared with the integration are visible, and write tools surface a confirmation in your AI host. The blast radius is bounded by what you explicitly grant.",
      },
      {
        q: "How do I scope the integration to a single database?",
        a: "Share only that database with the integration in the Notion UI. The integration cannot access anything that hasn't been shared with it.",
      },
    ],
    relatedSlugs: ["linear", "filesystem"],
    relatedBlogSlugs: ["notion-mcp-server-tutorial", "production-mcp-servers"],
  },

  // ───────────────────────────── Community / replacements ─────────────────────────────
  {
    slug: "postgres",
    name: "Postgres MCP",
    category: "Databases",
    tagline: "Read-only (and optional write) SQL execution against a Postgres database.",
    kind: "community",
    maintainer: "Community (crystaldba and others)",
    source: "https://github.com/crystaldba/postgres-mcp",
    packageOrImage: "crystaldba/postgres-mcp",
    description: [
      "The recommended Postgres MCP after Anthropic's @modelcontextprotocol/server-postgres was archived in mid-2025 following a SQL injection disclosure. Community alternatives like crystaldba/postgres-mcp are actively maintained and add safety primitives (timeouts, query budgets, read-only mode).",
      "What a Postgres MCP gives the model is direct schema introspection plus query execution. The model can describe tables, write SQL, and execute it. Default policy is read-only; write access requires an explicit flag. Point at dev/staging databases freely; point at production only with a tightly-scoped read-only role.",
    ],
    tools: [
      { name: "describe_table", description: "Show columns, types, indexes for a table." },
      { name: "list_tables", description: "Enumerate tables visible to the connection role." },
      { name: "execute_query", description: "Run a SELECT statement and return rows as JSON." },
      { name: "explain_query", description: "Return the query plan without executing." },
      {
        name: "execute_mutation",
        description: "Run INSERT/UPDATE/DELETE (only when write mode is on).",
      },
    ],
    installStdio: "npx -y @crystaldba/postgres-mcp postgresql://user:pass@host:5432/db",
    installHttp: null,
    setupSteps: [
      "Create a dedicated read-only database role for the AI (no DROP, no DELETE, no writes).",
      "Build the connection string with that role's credentials.",
      "Pass the connection string to the MCP server at startup.",
      "Test with describe_table and a few SELECTs in the MCP Inspector before connecting to Cursor.",
      "When ready, add to your AI host config with the same command.",
    ],
    useCases: [
      "Ad-hoc analytics: 'Top 10 users by signups this month, grouped by acquisition channel.'",
      "Schema review: 'What columns does the orders table have, and which ones are nullable?'",
      "Debug data shape: 'Show me 5 example rows from sessions where status = error.'",
    ],
    faq: [
      {
        q: "Why not the Anthropic-original @modelcontextprotocol/server-postgres?",
        a: "It was archived in mid-2025 after a SQL injection disclosure. It is still downloadable but no longer maintained — community forks closed the vulnerability and added safety features.",
      },
      {
        q: "Is it safe to point this at production?",
        a: "Only with a strictly read-only role, a row-level security policy you trust, and a query timeout. Read-only mode prevents writes at the server level; RLS prevents unauthorized reads.",
      },
      {
        q: "Can the AI accidentally lock my database with a runaway query?",
        a: "Possible without limits. Configure statement_timeout on the role (e.g. 30 seconds) and set max query budgets at the MCP layer.",
      },
    ],
    relatedSlugs: ["github", "fetch"],
    relatedBlogSlugs: ["production-mcp-servers", "secure-mcp-server", "mcp-server-hosting"],
    warnings: ["Recommended replacement for the archived @modelcontextprotocol/server-postgres."],
  },

  {
    slug: "playwright",
    name: "Playwright MCP",
    category: "Browser automation",
    tagline:
      "Headless Chromium / Firefox / WebKit driven by the model — navigate, screenshot, fill forms.",
    kind: "community",
    maintainer: "Microsoft (@playwright/mcp)",
    source: "https://github.com/microsoft/playwright-mcp",
    packageOrImage: "@playwright/mcp",
    description: [
      "Playwright MCP gives the AI a real browser it can navigate, screenshot, and interact with. Microsoft's official package supersedes the older @modelcontextprotocol/server-puppeteer (archived) and covers Chromium, Firefox, and WebKit with the same surface.",
      "This is one of the most powerful MCPs available — and one of the most dangerous. A confused model can burn arbitrary amounts of compute opening tabs. Always run Playwright in a sandboxed runtime with CPU and wall-clock limits, never directly on your laptop with unrestricted resources.",
    ],
    tools: [
      { name: "browser_navigate", description: "Open a URL in the headless browser." },
      {
        name: "browser_snapshot",
        description: "Return the accessibility tree of the current page.",
      },
      { name: "browser_screenshot", description: "Capture a PNG of the viewport or full page." },
      { name: "browser_click", description: "Click an element by accessibility selector." },
      { name: "browser_type", description: "Type into a focused input." },
      { name: "browser_wait_for", description: "Wait for an element or network to settle." },
    ],
    installStdio: "npx -y @playwright/mcp@latest",
    installHttp: null,
    setupSteps: [
      "Decide whether to run this locally or in a sandboxed runtime (we strongly recommend the latter).",
      "On first install, Playwright will download browser binaries (~150MB).",
      "Add to your AI host's MCP config — set wall-clock timeouts and a memory cap.",
      "For TwinMCP-hosted deployments, the sandbox enforces CPU and memory limits by default.",
    ],
    useCases: [
      "Visual regression: 'Screenshot the homepage and tell me what changed since yesterday.'",
      "Form filling for tests: drive a flow the model is debugging.",
      "Scraping JS-rendered content: pull data Fetch can't see.",
      "QA assistance: 'Find every page that links to /pricing and screenshot the link.'",
    ],
    faq: [
      {
        q: "Why replace Puppeteer MCP with Playwright?",
        a: "Puppeteer MCP (@modelcontextprotocol/server-puppeteer) was archived. Playwright covers more browsers, has better accessibility-tree primitives, and is maintained by Microsoft.",
      },
      {
        q: "Is this safe to run on my laptop?",
        a: "Risky. A confused model can open hundreds of tabs, follow arbitrary links, and consume a lot of CPU. Better to run Playwright in a TwinMCP sandbox or a dedicated container with hard limits.",
      },
      {
        q: "Can the AI take actions in my logged-in Gmail / GitHub session?",
        a: "Only if you pass it the session cookies or run it inside a profile with those cookies. By default, Playwright launches a fresh profile per session.",
      },
    ],
    relatedSlugs: ["fetch", "brave-search"],
    relatedBlogSlugs: ["production-mcp-servers", "secure-mcp-server", "mcp-server-hosting"],
    warnings: [
      "Replaces the archived @modelcontextprotocol/server-puppeteer.",
      "High blast radius — always run inside a sandbox with resource limits.",
    ],
  },

  {
    slug: "slack",
    name: "Slack MCP",
    category: "Communication",
    tagline: "Search messages, list channels, and post to channels the bot is invited to.",
    kind: "community",
    maintainer: "Community (post-archive replacement)",
    source: "https://github.com/modelcontextprotocol/servers-archived",
    packageOrImage: "Community Slack MCP (search npm at install time)",
    description: [
      "The Anthropic-original @modelcontextprotocol/server-slack moved to servers-archived and is no longer supported. Community-maintained replacements exist; search npm or the awesome-mcp lists for the most-starred current option before installing.",
      "Functionally a Slack MCP exposes message search, channel listing, and posting to channels a bot is invited to. The native auth model is a Slack app bot token — predictable rate limits, audit logs name the bot, and access is scoped to channels you've explicitly added the bot to.",
    ],
    tools: [
      { name: "slack_list_channels", description: "Enumerate channels the bot is in." },
      { name: "slack_post_message", description: "Send a message to a channel as the bot." },
      {
        name: "slack_search_messages",
        description: "Full-text search across accessible channels.",
      },
      { name: "slack_get_channel_history", description: "Read recent messages from a channel." },
      { name: "slack_reply_to_thread", description: "Post a threaded reply to a parent message." },
    ],
    installStdio: "SLACK_BOT_TOKEN=xoxb-... npx -y <chosen-slack-mcp-package>",
    installHttp: null,
    setupSteps: [
      "Create a Slack app at api.slack.com/apps with bot scopes (channels:read, chat:write, search:read).",
      "Install the app to your workspace and copy the Bot User OAuth Token (xoxb-...).",
      "Invite the bot to the channels you want the AI to access — Slack scopes everything to that.",
      "Pick a maintained community Slack MCP and set SLACK_BOT_TOKEN in your config env.",
      "Reload the host and verify the bot tools appear.",
    ],
    useCases: [
      "Postmortem assist: search recent incident threads, surface key messages and timestamps.",
      "Standup digest: 'Summarize what each team posted in #eng-updates this week.'",
      "Notifications: have the AI post a release summary to #releases when a deploy succeeds.",
    ],
    faq: [
      {
        q: "Why is the Anthropic Slack MCP archived?",
        a: "It moved to the servers-archived repo as part of Anthropic's catalog consolidation in 2025. Community replacements exist and are actively maintained.",
      },
      {
        q: "Should I give the bot write access to all channels?",
        a: "No. Invite the bot only to channels you want it to read or post in. Slack permissions are channel-scoped by design — use that.",
      },
      {
        q: "Can the bot read DMs?",
        a: "Only if you grant the im:read scope and the bot is in the DM. By default it sees only channels it's invited to.",
      },
    ],
    relatedSlugs: ["github", "notion"],
    relatedBlogSlugs: ["production-mcp-servers", "secure-mcp-server"],
    warnings: [
      "Replaces the archived @modelcontextprotocol/server-slack — verify the current community maintainer before installing.",
    ],
  },

  {
    slug: "brave-search",
    name: "Brave Search MCP",
    category: "Web",
    tagline: "Privacy-respecting web search exposed as an MCP — Brave API key required.",
    kind: "official",
    maintainer: "Brave + community wrappers",
    source: "https://github.com/modelcontextprotocol/servers",
    packageOrImage: "@modelcontextprotocol/server-brave-search",
    description: [
      "Brave Search MCP gives the AI agent a web search tool that hits Brave's index rather than a hyperscaler's. The result quality is comparable to mainstream engines for most general queries and noticeably better for technical and long-tail content.",
      "Requires a Brave Search API key (free tier covers most personal use). Pair with the Fetch MCP for a search → read pipeline: model searches, picks a result, fetches the full article.",
    ],
    tools: [
      { name: "brave_web_search", description: "Web search with up to 20 results." },
      { name: "brave_local_search", description: "Geo-aware local search for businesses, places." },
    ],
    installStdio: "BRAVE_API_KEY=brsk-... npx -y @modelcontextprotocol/server-brave-search",
    installHttp: null,
    setupSteps: [
      "Sign up at api.search.brave.com and copy a free-tier API key.",
      "Add the server to your AI host config with BRAVE_API_KEY in the env block.",
      "Reload the host.",
      "Test: ask the model to search for something current — 'What is the latest TypeScript release?'",
    ],
    useCases: [
      "Research grounded in current information the base model wasn't trained on.",
      "Debugging: search for error messages across Stack Overflow, GitHub issues, docs.",
      "Competitive intel: 'What are people saying about <competitor product> this month?'",
    ],
    faq: [
      {
        q: "Does the model spend my Brave API quota on every prompt?",
        a: "Only when it explicitly calls the search tool, which it does for queries needing current info. Cache the results at the application layer if you're cost-sensitive.",
      },
      {
        q: "Why Brave instead of Google?",
        a: "Google does not offer a usable programmatic search API anymore. Brave has a real one, with sane pricing and quality on the topics most AI agents care about.",
      },
      {
        q: "Are search results filtered by Brave?",
        a: "Brave applies standard safe-search defaults; you can adjust per-request. Their privacy stance means less personalization, which is usually what you want for AI-driven search.",
      },
    ],
    relatedSlugs: ["fetch", "playwright"],
    relatedBlogSlugs: ["production-mcp-servers"],
  },

  {
    slug: "sentry",
    name: "Sentry MCP",
    category: "Observability",
    tagline: "Read Sentry issues, events, and traces from your AI host.",
    kind: "community",
    maintainer: "Community (Sentry-aligned)",
    source: "https://github.com/getsentry/sentry-mcp",
    packageOrImage: "@sentry/mcp-server",
    description: [
      "Sentry MCP gives the AI direct access to your error and performance data. The model can list recent issues, read stack traces, query events for a release, and surface correlations across services.",
      "This is the canonical 'debug with AI' MCP: paste an alert URL into the conversation, the model reads the issue context, proposes a fix, and (if you also have GitHub MCP installed) drafts a PR. Auth is a Sentry API token scoped to the org/project you want exposed.",
    ],
    tools: [
      { name: "list_issues", description: "Recent issues in a project, filterable by status." },
      { name: "get_issue", description: "Full issue with stack trace and breadcrumbs." },
      { name: "list_events", description: "Events for an issue, ordered by recency." },
      { name: "search_events", description: "Search events with Sentry's query syntax." },
      { name: "get_release", description: "Release metadata: commits included, deploys, stats." },
    ],
    installStdio: "SENTRY_AUTH_TOKEN=... npx -y @sentry/mcp-server",
    installHttp: null,
    setupSteps: [
      "Create a Sentry auth token in your org settings with project:read scope.",
      "Note the organization slug — you'll need it in the config.",
      "Add the server to your MCP config with both env vars.",
      "Reload the host.",
      "Workflow: drop a Sentry alert URL in chat, ask the AI to read the issue and propose a fix.",
    ],
    useCases: [
      "Incident response: AI reads recent issues, clusters by signature, proposes priorities.",
      "Release health: 'Summarize what broke in v2.4.0 versus v2.3.7.'",
      "On-call assist: paste an alert link, AI reads the trace and proposes a hypothesis.",
    ],
    faq: [
      {
        q: "Does this expose user PII to the model?",
        a: "Sentry events can contain PII depending on what you log. Configure Sentry's data scrubbing rules before connecting MCP to a real org.",
      },
      {
        q: "Can the AI resolve or modify Sentry issues?",
        a: "With write scopes, yes (resolve, ignore, assign). Default config is read-only — recommend keeping it that way.",
      },
    ],
    relatedSlugs: ["github", "postgres"],
    relatedBlogSlugs: ["mcp-server-monitoring", "secure-mcp-server"],
  },
];

export function getServerBySlug(slug: string): ServerEntry | undefined {
  return SERVERS.find((s) => s.slug === slug);
}

// Inverse of `relatedBlogSlugs`: the catalog servers that reference a given blog
// post. Powers the "Related MCP servers" block on blog posts so editorial pages
// pass link equity to the programmatic /servers pages (internal linking).
export function getRelatedServers(
  blogSlug: string,
  limit = 4
): Array<Pick<ServerEntry, "slug" | "name" | "tagline">> {
  return SERVERS.filter((s) => s.relatedBlogSlugs.includes(blogSlug))
    .slice(0, limit)
    .map((s) => ({ slug: s.slug, name: s.name, tagline: s.tagline }));
}

export function getServersByCategory(): Record<string, ServerEntry[]> {
  const grouped: Record<string, ServerEntry[]> = {};
  for (const s of SERVERS) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }
  return grouped;
}
