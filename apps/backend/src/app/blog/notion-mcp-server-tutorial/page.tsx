import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { howToSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "notion-mcp-server-tutorial";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

export const metadata: Metadata = {
  title: post.title,
  description: post.description,
  alternates: { canonical: `/blog/${SLUG}` },
  openGraph: {
    type: "article",
    title: post.title,
    description: post.description,
    url: `${SITE_URL}/blog/${SLUG}`,
    publishedTime: post.publishedAt,
  },
};

const tutorial = howToSchema({
  name: "Build a Notion MCP server with TypeScript",
  description:
    "Build a Model Context Protocol server that lets an AI agent search, read, and create pages in a Notion workspace.",
  totalTime: "PT30M",
  steps: [
    {
      name: "Create a Notion integration and grant workspace access",
      text: "From notion.so/my-integrations, create a new internal integration and copy the secret. In your workspace, share the relevant pages or databases with the integration so the API can read them.",
    },
    {
      name: "Bootstrap the TypeScript project",
      text: "Initialize an npm project, install @modelcontextprotocol/sdk, @notionhq/client, zod, and the TypeScript toolchain.",
    },
    {
      name: "Wire up the MCP server with stdio transport",
      text: "Instantiate the Server, declare the tools capability, and connect StdioServerTransport.",
    },
    {
      name: "Implement search_pages, read_page, and create_page tools",
      text: "Register three tools that map directly to the Notion API endpoints, with Zod input schemas validated server-side.",
    },
    {
      name: "Test with the MCP Inspector",
      text: "Run npx @modelcontextprotocol/inspector against the server, exercise each tool with sample arguments, and confirm responses.",
    },
    {
      name: "Add the server to Cursor or Claude Desktop",
      text: "Update the AI host config file to spawn the server as a child process with the NOTION_TOKEN environment variable.",
    },
  ],
});

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[tutorial]}>
      <p>
        <strong>TL;DR.</strong> In about 30 minutes you can have a working Notion MCP server that
        lets an AI agent search pages, read their content, and create new ones. We use the official
        Notion API client and the MCP TypeScript SDK. The result is a small, focused server you can
        drop into Cursor or Claude Desktop, or deploy to a managed runtime so your whole team uses
        the same instance.
      </p>

      <h2 id="prerequisites">Prerequisites</h2>
      <ul>
        <li>Node.js 20 or newer.</li>
        <li>A Notion workspace where you have permission to create integrations.</li>
        <li>An AI host (Cursor, Claude Desktop, or Claude Code) installed locally.</li>
        <li>
          Familiarity with TypeScript and the basics of MCP &mdash; if you have not built one
          before, read{" "}
          <Link href={"/blog/build-mcp-server" as Route}>
            how to build a Model Context Protocol server
          </Link>{" "}
          first.
        </li>
      </ul>

      <h2 id="step-1">Step 1 &mdash; Create a Notion integration</h2>
      <p>
        Go to <code>notion.so/my-integrations</code> and click &ldquo;New integration.&rdquo; Pick a
        name, leave it as an internal integration, and copy the generated secret (it starts with{" "}
        <code>secret_</code> or <code>ntn_</code>). Save it &mdash; you will paste it into the
        server&apos;s environment.
      </p>
      <p>
        Now share the pages or databases the integration should access. Open any page in your
        workspace, click the three-dot menu, &ldquo;Add connections,&rdquo; and select your
        integration. The integration only sees what you share with it, explicitly. This is
        Notion&apos;s permissions model and it is the right one.
      </p>

      <h2 id="step-2">Step 2 &mdash; Bootstrap the project</h2>
      <pre>
        <code>{`mkdir notion-mcp && cd notion-mcp
npm init -y
npm install @modelcontextprotocol/sdk @notionhq/client zod
npm install -D typescript tsx @types/node
npx tsc --init`}</code>
      </pre>
      <p>
        Set <code>{`"type": "module"`}</code> in <code>package.json</code> and update the{" "}
        <code>compilerOptions</code> in <code>tsconfig.json</code> to target ES2022 + Node16 modules
        (the standard MCP project setup &mdash; see the{" "}
        <Link href={"/blog/build-mcp-server" as Route}>main tutorial</Link> for the complete{" "}
        <code>tsconfig.json</code>).
      </p>

      <h2 id="step-3">Step 3 &mdash; Define the server</h2>
      <p>
        Create <code>src/server.ts</code>. We instantiate the MCP Server, advertise the tools
        capability, and connect a stdio transport.
      </p>
      <pre>
        <code>{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client as NotionClient } from "@notionhq/client";
import { z } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const notion = new NotionClient({ auth: process.env.NOTION_TOKEN });

const server = new Server(
  { name: "notion", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Notion MCP server running on stdio");`}</code>
      </pre>

      <h2 id="step-4">Step 4 &mdash; Implement three tools</h2>
      <p>
        We expose <code>search_pages</code> (find a page by title or content),{" "}
        <code>read_page</code> (return the blocks of a specific page), and <code>create_page</code>{" "}
        (create a new page under a parent).
      </p>
      <pre>
        <code>{`const SearchInput = z.object({ query: z.string().min(1) });
const ReadInput = z.object({ page_id: z.string() });
const CreateInput = z.object({
  parent_page_id: z.string(),
  title: z.string(),
  content: z.string().optional(),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_pages",
      description: "Search Notion pages by query string. Returns id, title, URL.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
    {
      name: "read_page",
      description: "Read the block content of a Notion page by id.",
      inputSchema: {
        type: "object",
        properties: { page_id: { type: "string" } },
        required: ["page_id"],
      },
    },
    {
      name: "create_page",
      description: "Create a Notion page under a parent page with optional content.",
      inputSchema: {
        type: "object",
        properties: {
          parent_page_id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
        },
        required: ["parent_page_id", "title"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "search_pages") {
    const { query } = SearchInput.parse(req.params.arguments);
    const res = await notion.search({ query, filter: { value: "page", property: "object" } });
    const items = res.results.map((p: any) => ({
      id: p.id,
      url: p.url,
      title:
        p.properties?.title?.title?.[0]?.plain_text ??
        p.properties?.Name?.title?.[0]?.plain_text ??
        "(untitled)",
    }));
    return { content: [{ type: "text", text: JSON.stringify(items, null, 2) }] };
  }

  if (req.params.name === "read_page") {
    const { page_id } = ReadInput.parse(req.params.arguments);
    const blocks = await notion.blocks.children.list({ block_id: page_id });
    return { content: [{ type: "text", text: JSON.stringify(blocks.results, null, 2) }] };
  }

  if (req.params.name === "create_page") {
    const { parent_page_id, title, content } = CreateInput.parse(req.params.arguments);
    const page = await notion.pages.create({
      parent: { page_id: parent_page_id },
      properties: {
        title: { title: [{ type: "text", text: { content: title } }] },
      },
      children: content
        ? [{
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ type: "text", text: { content } }] },
          }]
        : [],
    });
    return { content: [{ type: "text", text: JSON.stringify({ id: page.id }) }] };
  }

  throw new Error(\`Unknown tool: \${req.params.name}\`);
});`}</code>
      </pre>
      <p>
        Every handler returns a structured response wrapped in <code>content</code> &mdash; the MCP
        convention. The schemas above use Zod for input validation; the SDK does not validate inputs
        against the JSON Schema you declared, so this is your safety net.
      </p>

      <h2 id="step-5">Step 5 &mdash; Test with the Inspector</h2>
      <pre>
        <code>{`NOTION_TOKEN=secret_... npx @modelcontextprotocol/inspector tsx src/server.ts`}</code>
      </pre>
      <p>
        The Inspector opens in your browser. Switch to the Tools tab and confirm three tools appear.
        Invoke <code>search_pages</code> with a query you know matches a shared page, copy the
        resulting page id, and use it with <code>read_page</code>. Try <code>create_page</code> with
        a known parent page id (the integration must have access to the parent).
      </p>
      <p>
        If <code>search_pages</code> returns nothing, the integration probably does not have
        permission on any shared page yet &mdash; go back to step 1 and verify.
      </p>

      <h2 id="step-6">Step 6 &mdash; Wire it into Cursor or Claude Desktop</h2>
      <p>
        Build the project (<code>npm run build</code> if you have a build script; otherwise we keep
        using <code>tsx</code> at runtime). Then update your host config to spawn the server.
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "notion": {
      "command": "tsx",
      "args": ["/absolute/path/to/notion-mcp/src/server.ts"],
      "env": {
        "NOTION_TOKEN": "secret_..."
      }
    }
  }
}`}</code>
      </pre>
      <p>
        Reload the host (full quit for Claude Desktop, MCP panel reload for Cursor). Start a
        conversation: &ldquo;Find my Q2 planning doc&rdquo; should trigger <code>search_pages</code>{" "}
        automatically.
      </p>

      <h2 id="deploy">Optional: deploy with HTTP transport</h2>
      <p>
        stdio is great for one developer. For the rest of your team to use the same server, swap
        stdio for HTTP (a small refactor &mdash; the{" "}
        <Link href={"/blog/build-mcp-server" as Route}>main tutorial</Link> shows the full code) and
        host it. Two clean options:
      </p>
      <ul>
        <li>Deploy on a small VPS with Docker. You manage TLS, secrets, restarts.</li>
        <li>
          Push to a managed runtime: <Link href="/">TwinMCP</Link> takes a package or Git URL plus
          install/start commands, runs it in an isolated sandbox, and gives you a stable HTTPS URL
          plus per-user API keys. Same code, no operational tax.
        </li>
      </ul>

      <h2 id="next">Where to go next</h2>
      <p>
        For the broader tutorial that this one specializes, read{" "}
        <Link href={"/blog/build-mcp-server" as Route}>
          how to build a Model Context Protocol server (step-by-step)
        </Link>
        . To harden the server before sharing it with your team, follow{" "}
        <Link href={"/blog/secure-mcp-server" as Route}>securing your MCP server</Link>. And for
        inspiration on what else to wrap as an MCP, browse our list of{" "}
        <Link href={"/blog/production-mcp-servers" as Route}>10 production-ready MCP servers</Link>.
      </p>
    </PostLayout>
  );
}
