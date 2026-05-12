import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "what-is-mcp";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.dev";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: {
    canonical: `/blog/${SLUG}`,
    languages: {
      en: `/blog/${SLUG}`,
      fr: `/fr/blog/${SLUG}`,
      "x-default": `/blog/${SLUG}`,
    },
  },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${SLUG}`,
    publishedTime: post.publishedAt,
  },
};

const faq = [
  {
    q: "Is Model Context Protocol open source?",
    a: "Yes. The MCP specification, the official reference SDKs (TypeScript, Python, C#, Java, Kotlin, Ruby, Swift), and the Inspector debugger are all published under an open license on GitHub. The protocol is designed to be vendor-neutral — Claude is one client among many, and community SDKs exist for Go, Rust, and other languages.",
  },
  {
    q: "Do I need an Anthropic API key to use MCP?",
    a: "No. MCP is a transport-level protocol between an AI client and a server. The client may be Claude Desktop, Cursor, Claude Code, Windsurf, Cline, or any custom integration. None of these require you to call the Anthropic API directly when talking to an MCP server.",
  },
  {
    q: "How is MCP different from OpenAI function calling?",
    a: "Function calling is a per-request mechanism where you describe tools inline in the prompt to the model. MCP externalizes that: the server runs as its own process, exposes a stable list of tools, resources, and prompts, and the AI client discovers them dynamically. The same server works across Claude, Cursor, Windsurf, Cline, and anything else that speaks MCP — you build the integration once.",
  },
  {
    q: "What can an MCP server actually do?",
    a: "Three primitives: tools (functions the AI can call), resources (read-only data the AI can fetch), and prompts (reusable templates the user can trigger). Anything you can wrap in JSON-RPC over stdio or HTTP is fair game — file systems, databases, GitHub, Slack, internal APIs, scrapers, anything.",
  },
  {
    q: "Do I have to host MCP servers myself?",
    a: "No. You can run them locally over stdio (good for personal tools), self-host them on a VPS, deploy them to a serverless runtime, or use a managed runtime like TwinMCP that handles isolation, secrets, and IDE wiring for you.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> Model Context Protocol (MCP) is an open standard, released by
        Anthropic in late 2024, that lets AI assistants talk to external tools and data through a
        single uniform interface. Instead of writing custom integrations for every model and every
        IDE, you build one MCP server and every MCP-aware client &mdash; Claude Desktop, Cursor,
        Claude Code, Windsurf, Cline &mdash; can use it. This guide explains what MCP is, why it
        exists, how the protocol actually works, what you can build with it today, and where the
        ecosystem is heading in 2026.
      </p>

      <h2 id="why">Why MCP exists: the integration mess of 2023&ndash;2024</h2>
      <p>
        For most of 2023, &ldquo;giving an AI agent access to a tool&rdquo; meant inlining a JSON
        schema into a prompt and parsing the model&apos;s response back into a function call. Each
        model vendor had their own convention. OpenAI introduced function calling. Anthropic had
        tool use. Google had something else. The frameworks layered on top (LangChain, LlamaIndex,
        custom orchestrators) papered over the differences, but the result was the same: every
        integration was bespoke, brittle, and rewritten for each new client.
      </p>
      <p>
        The problem compounded fast. Cursor wanted to read a developer&apos;s GitHub issues. Claude
        Desktop wanted to read local files. Windsurf wanted access to a Postgres database. Each IDE
        shipped its own plugin system, with its own auth model, its own tool schema, and its own way
        of streaming results back to the model. A small team wanting to expose, say, &ldquo;query
        our internal docs&rdquo; to four AI clients ended up writing four parallel integrations and
        maintaining four release cadences.
      </p>
      <p>
        Anthropic published MCP on November 25, 2024 as the answer: one protocol, defined once, with
        official reference SDKs in multiple languages. The AI client speaks MCP. The tool provider
        speaks MCP. The protocol handles discovery, schemas, transport, errors, streaming, and
        authentication. The integration becomes a contract, not a custom adapter.
      </p>

      <h2 id="what-is-it">What MCP actually is, in one paragraph</h2>
      <p>
        MCP is a JSON-RPC 2.0 protocol that runs over one of two transports &mdash; standard
        input/output (stdio) for local processes, or HTTP with Server-Sent Events (SSE) for remote
        ones. Two parties talk to each other: an <strong>MCP client</strong> embedded in an AI
        application, and an <strong>MCP server</strong> that exposes capabilities. The server
        advertises a list of tools, resources, and prompts. The client connects, reads the catalog,
        and surfaces the relevant items to the AI model and the user. When the model decides to call
        a tool, the client sends the request to the server, the server executes, and the response
        goes back through the same channel. That is the entire protocol &mdash; everything else is
        convention.
      </p>

      <h2 id="architecture">The three actors: host, client, server</h2>
      <p>
        The MCP spec defines three distinct roles. Getting them right matters because they often
        live in different processes.
      </p>
      <h3>The host</h3>
      <p>
        The host is the user-facing application &mdash; Cursor, Claude Desktop, Claude Code,
        Windsurf, Cline. It owns the UI, the model conversation, and the user&apos;s session. The
        host decides which servers to connect to and how to present their capabilities to the model.
        It does not speak MCP directly; it delegates that to a client.
      </p>
      <h3>The client</h3>
      <p>
        Each host spawns one client per server it wants to talk to. The client handles the protocol
        mechanics &mdash; connection lifecycle, message serialization, capability negotiation. From
        the host&apos;s perspective, the client exposes a clean local API for &ldquo;list
        tools,&rdquo; &ldquo;call this tool,&rdquo; &ldquo;read this resource.&rdquo; A host that
        connects to five MCP servers runs five client instances.
      </p>
      <h3>The server</h3>
      <p>
        The server is what you build. It exposes one or more capabilities and waits for the client
        to call them. It can run as a child process of the host (stdio transport) or as an
        independent HTTP service. The server has its own permissions, its own environment variables,
        its own network access. The user authorizes the connection once; after that, calls flow.
      </p>

      <h2 id="primitives">The three primitives: tools, resources, prompts</h2>
      <p>
        Every MCP server exposes some combination of three primitive types. Understanding the
        difference is the single most important thing for using MCP correctly.
      </p>
      <h3>Tools</h3>
      <p>
        Tools are functions the AI model can call. Each tool has a name, a description, and a JSON
        Schema for its parameters. The server returns structured output. Tools are the bread and
        butter &mdash; &ldquo;list open pull requests,&rdquo; &ldquo;run this SQL,&rdquo;
        &ldquo;send a Slack message.&rdquo; A tool call is model-initiated: the model decides,
        mid-conversation, that a tool would help, and the client routes the call. Tools are also the
        only primitive that can have side effects, which is why every MCP host shows a confirmation
        dialog before executing one by default.
      </p>
      <h3>Resources</h3>
      <p>
        Resources are read-only data the AI can fetch. Think of them as URLs the model can ask the
        client to dereference: a file path, a database row, a wiki page, a calendar. Resources are
        user-initiated more often than tools &mdash; the user attaches them to the conversation, or
        the client surfaces them as @-mentions. The server returns the content, optionally with
        metadata. Resources have no side effects.
      </p>
      <h3>Prompts</h3>
      <p>
        Prompts are reusable templates the user (not the model) triggers. They appear in the host UI
        as slash commands or autocomplete entries. A prompt accepts arguments, substitutes them into
        a template, and returns a prepared conversation that the host sends to the model. Prompts
        are how you encode workflows: &ldquo;summarize this PR,&rdquo; &ldquo;write a postmortem for
        incident X,&rdquo; &ldquo;refactor this function to use the new logger.&rdquo;
      </p>

      <h2 id="transport">Transport: stdio and HTTP/SSE</h2>
      <p>MCP defines two transports, and the choice has serious operational consequences.</p>
      <h3>stdio transport</h3>
      <p>
        The host spawns the server as a child process and talks to it through stdin and stdout.
        Newline-delimited JSON-RPC messages flow each way. There is no port to open, no auth to
        configure, no network exposure. This is how Claude Desktop and Cursor load most of their
        default MCPs on day one. It is also the default for personal tools you do not want to host
        anywhere.
      </p>
      <p>
        The cost of stdio is that the server only lives as long as the host process. Restart Cursor
        and the server restarts. Three IDEs open on your laptop means three copies of the same
        server running. State is per-process. Background work is harder. And if the host crashes,
        the server dies with it.
      </p>
      <h3>HTTP/SSE transport</h3>
      <p>
        The newer transport runs the server as a long-lived HTTP service. Clients POST JSON-RPC
        requests; responses can stream back as Server-Sent Events. This is what you want when the
        server has state worth keeping (a database connection pool, a cache), when multiple hosts
        should share one instance, or when the server needs to live in a different security domain
        than the host (server-side secrets, internal network access).
      </p>
      <p>
        The cost of HTTP is that you have to host it, secure it, and give the client a URL and an
        auth token. This is exactly the problem managed runtimes like <Link href="/">TwinMCP</Link>{" "}
        were built to solve &mdash; you write the server, the platform handles isolation, transport,
        secrets, and IDE wiring.
      </p>

      <h2 id="examples">What people actually build with MCP</h2>
      <p>
        Three categories dominate the ecosystem in 2026, and they are useful to know about before
        you start a server of your own.
      </p>
      <h3>Connectors to existing systems</h3>
      <p>
        The largest category. GitHub, Linear, Notion, Slack, Jira, Postgres, MySQL, BigQuery,
        Snowflake, Stripe, HubSpot, Salesforce, Google Drive, Google Calendar, Figma, Sentry,
        Datadog. Each is a thin wrapper around an existing REST or GraphQL API, repackaged as MCP
        tools and resources. These are the &ldquo;official&rdquo; marketplace MCPs &mdash; they
        exist because the integration was already valuable, MCP just made it portable across
        clients.
      </p>
      <h3>Local-system access</h3>
      <p>
        Filesystem, shell, browser, screenshot, OCR, audio. These mostly run as stdio servers
        because they need access to your machine. Anthropic ships a filesystem server with Claude
        Desktop; community alternatives expose Bash, Playwright, AppleScript. Be careful with these
        &mdash; an unconstrained shell MCP gives the model write access to your entire workstation.
      </p>
      <h3>Domain-specific knowledge</h3>
      <p>
        Internal docs, custom RAG indexes, retrieval over a company wiki, retrieval over a codebase.
        These are usually private and self-built. They tend to expose two tools
        (&ldquo;search&rdquo; and &ldquo;fetch&rdquo;) plus a handful of resources. This is also the
        category where you most clearly need a managed runtime: the server has a vector store, a
        secret API key, and a budget for embeddings &mdash; you do not want that running in every
        developer&apos;s laptop process.
      </p>

      <h2 id="vs-alternatives">MCP versus the alternatives</h2>
      <p>
        Three competing approaches show up in the same conversations as MCP. Each has its place.
      </p>
      <h3>Model-vendor function calling</h3>
      <p>
        OpenAI function calling, Anthropic tool use, Gemini function calling. These are the
        primitives MCP sits on top of. If you only target one model and one client, vendor function
        calling is simpler &mdash; one less layer. The moment you have two clients (your IDE plus a
        chatbot, say), MCP starts paying off because the tool definition and the implementation are
        decoupled.
      </p>
      <h3>LangChain Tools, LlamaIndex Tools, agent frameworks</h3>
      <p>
        Framework-level tool abstractions. They give you a runtime (the agent loop) plus the tool
        registry plus the LLM client. MCP gives you only the protocol &mdash; the agent loop is the
        host&apos;s problem. The two are complementary: a LangChain agent can speak MCP to call your
        servers, and the implementation of an MCP tool can be a full LangChain chain underneath.
      </p>
      <h3>Plain REST APIs</h3>
      <p>
        The pre-MCP default. The agent calls your REST API directly, with OpenAPI for the schema and
        OAuth for auth. This still works fine when the consumer is a custom backend with bespoke
        wiring. It does not work when the consumer is a third-party host like Cursor, because Cursor
        has no way to learn about your API. MCP solves exactly that discovery problem.
      </p>

      <h2 id="where-to-run">Where MCP servers run in 2026</h2>
      <p>
        Five options dominate, and we cover them in depth in our dedicated guide on{" "}
        <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting</Link>.
      </p>
      <ul>
        <li>
          <strong>Local stdio</strong> &mdash; the server is a child of the IDE. Zero hosting cost,
          zero security exposure, but no persistence and no sharing.
        </li>
        <li>
          <strong>Self-hosted Docker on a VPS</strong> &mdash; the server is an HTTP service on your
          own infrastructure. Maximum control, maximum operational cost.
        </li>
        <li>
          <strong>Serverless</strong> &mdash; Cloudflare Workers, Vercel Functions, AWS Lambda.
          Cheap when idle, fast cold-starts on modern platforms. Hard to do long-lived connections
          (the SSE part of MCP is awkward on stateless functions).
        </li>
        <li>
          <strong>Catalogs / aggregators</strong> &mdash; Smithery and similar curated MCP hubs run
          servers on shared infrastructure. Good for popular open-source MCPs, weaker when you need
          private secrets or custom code.
        </li>
        <li>
          <strong>Managed MCP runtimes</strong> &mdash; <Link href="/">TwinMCP</Link> and similar
          provision isolated sandboxes per server, handle secrets, expose stable URLs, and give you
          a dashboard with logs. The sweet spot for production use of your own MCPs.
        </li>
      </ul>

      <h2 id="security">Security: the part most posts skip</h2>
      <p>
        MCP punches holes through your security perimeter on purpose. The model, prompted by text in
        your conversation, can call functions that touch your file system, run SQL, or hit external
        APIs. Three things matter and almost nothing else.
      </p>
      <h3>Confirmations</h3>
      <p>
        Hosts default to asking you before executing a tool, but the &ldquo;always allow&rdquo;
        option is one click away. Treat it like sudo: only check that box for servers you have
        actually read.
      </p>
      <h3>Secrets isolation</h3>
      <p>
        A stdio server runs with your shell&apos;s environment variables. If your IDE has your
        GitHub token in <code>GITHUB_TOKEN</code>, every MCP server on your laptop can read it. Use
        per-server secret scoping (managed runtimes give you this; stdio does not).
      </p>
      <h3>Prompt injection</h3>
      <p>
        An MCP server fetches data from somewhere. That data ends up in your context window.
        Adversarial text in a GitHub issue can instruct the model to call a different tool with
        parameters that leak data. The mitigation is the same as for any RAG system: treat retrieved
        content as untrusted, and design tools so the worst outcome of a single confused call is
        recoverable.
      </p>

      <h2 id="ecosystem-2026">The 2026 ecosystem at a glance</h2>
      <p>
        Roughly eighteen months after the initial spec, the protocol has settled. Official SDKs
        cover TypeScript, Python, C#, Java, Kotlin, Ruby, and Swift; community SDKs exist for Go,
        Rust, and other languages. There is an Inspector debugger, three managed runtimes, multiple
        public catalogs, and a few thousand published servers. The pace of breaking spec changes has
        slowed: the November 25, 2025 revision was the most recent to require meaningful SDK
        updates, and the &ldquo;tools / resources / prompts&rdquo; trio is now stable.
      </p>
      <p>
        On the host side, every major AI coding tool has shipped a first-class MCP client. Cursor,
        Claude Code, Claude Desktop, Windsurf, Cline, Continue, Zed, JetBrains AI Assistant. The
        interesting frontier is non-developer hosts: customer-support agents, operations runbooks,
        internal chat tools at large companies. The protocol works for all of them &mdash; the gap
        is the catalog of servers that match those use cases.
      </p>

      <h2 id="getting-started">How to get started</h2>
      <p>Two paths, depending on what you want.</p>
      <p>
        <strong>If you want to use MCP</strong>, install Claude Desktop, Cursor, Claude Code, or
        Windsurf, browse their built-in catalog, and add an MCP server with two clicks. Most useful
        default servers (filesystem, GitHub, fetch) are included.
      </p>
      <p>
        <strong>If you want to build an MCP server</strong>, read our dedicated tutorial:{" "}
        <Link href={"/blog/build-mcp-server" as Route}>
          how to build a Model Context Protocol server (step-by-step)
        </Link>
        . It covers TypeScript and Python, both transports, and how to deploy what you built.
      </p>
      <p>
        <strong>If you want to run someone else&apos;s MCP server in production</strong>, without
        managing the underlying infrastructure, sign up for a free TwinMCP account &mdash; you get
        one isolated server and the marketplace catalogue on the free tier.
      </p>
    </PostLayout>
  );
}
