import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "mcp-vs-langchain";
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

const faq = [
  {
    q: "Is MCP a replacement for LangChain?",
    a: "No. LangChain is an agent framework — it orchestrates the loop between an LLM and its tools. MCP is a protocol — it defines how a client and a tool server talk over the wire. A LangChain agent can absolutely speak MCP to call your servers, and the implementation of an MCP tool can be a LangChain chain underneath.",
  },
  {
    q: "Which one should I pick if I'm starting today?",
    a: "If you're building an AI host (something users interact with), you need an agent framework — pick LangChain, LangGraph, the OpenAI Agents SDK, or build your own loop. If you're building a tool that should be usable by every AI host out there, build an MCP server. The two are not alternatives.",
  },
  {
    q: "Can I expose LangChain tools as MCP servers?",
    a: "Yes. Wrap each LangChain Tool in an MCP server: declare the tool's name, description, and input schema in the MCP layer, and call the underlying LangChain Tool inside the handler. The official Anthropic SDK plus the LangChain Tool class is enough — no third-party adapter required.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> MCP and LangChain are often discussed as alternatives. They are not.
        LangChain is a Python/TypeScript framework for building AI agents &mdash; it owns the
        orchestration loop, the LLM client, and the tool registry inside one process. MCP is a
        JSON-RPC protocol that defines how an external tool server talks to any AI host. You pick
        LangChain to build an agent; you pick MCP to make a tool usable by every agent ever. The
        interesting question is when each one wins, and how to combine them &mdash; which is what
        this post is actually about.
      </p>

      <h2 id="different-layer">They live at different layers</h2>
      <p>
        The mental model that fixes the confusion: MCP is a transport-level protocol; LangChain is
        an application-level framework. A LangChain agent is the program your user talks to &mdash;
        it holds the conversation, calls the LLM, decides which tools to invoke, parses the
        responses. An MCP server is the program a tool lives in &mdash; it exposes a stable surface
        that any AI host (including a LangChain agent) can discover and call.
      </p>
      <p>
        The two solve different problems. Replacing LangChain with MCP makes no more sense than
        replacing React with HTTP &mdash; they sit on top of each other.
      </p>

      <h2 id="when-langchain">When LangChain (or a framework) wins</h2>
      <p>
        Pick a framework like LangChain, LangGraph, the OpenAI Agents SDK, or LlamaIndex when you
        are building the agent itself. Specifically:
      </p>
      <ul>
        <li>
          The user is interacting with <em>your</em> application, not with Cursor or Claude Desktop.
        </li>
        <li>
          You need control over the agent loop &mdash; retries, branching, memory, multi-step plans,
          supervision.
        </li>
        <li>
          You want a single deployable artifact that bundles the LLM client, the tool
          implementations, and the orchestration.
        </li>
        <li>The tools are internal and never need to be reused outside this codebase.</li>
      </ul>
      <p>
        The cost is lock-in to the framework&apos;s opinionated abstractions and its dependency
        footprint &mdash; LangChain in particular is a large surface that changes faster than most
        teams want.
      </p>

      <h2 id="when-mcp">When MCP wins</h2>
      <p>
        Pick MCP when the consumer of the tool is not your own code. The protocol is almost only
        valuable across process boundaries you do not control:
      </p>
      <ul>
        <li>
          You want the same &ldquo;query our internal docs&rdquo; tool to work in Cursor, Claude
          Desktop, Windsurf, and Cline without four implementations.
        </li>
        <li>
          You want third-party AI agents (customer-support tooling, runbook automations) to access
          your data without bespoke integration.
        </li>
        <li>
          The tool has its own lifecycle &mdash; secrets, deployments, scaling &mdash; that is
          separate from the agent that calls it.
        </li>
        <li>
          You want a public catalog: anyone with an MCP-capable client can install your server with
          one config line.
        </li>
      </ul>
      <p>
        The cost is the protocol overhead &mdash; one extra network hop, JSON-RPC framing,
        capability negotiation. For interactive tools (sub-second user-visible latency), the cost is
        invisible.
      </p>

      <h2 id="combining">Combining them: LangChain agent calling MCP servers</h2>
      <p>
        The most common production pattern uses both. The agent is a LangChain process; its tools
        are MCP servers that live elsewhere. Concretely, in TypeScript:
      </p>
      <pre>
        <code>{`import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const client = new Client({ name: "agent", version: "0.1" }, {});
const transport = new StdioClientTransport({
  command: "node",
  args: ["./weather-server.js"],
});
await client.connect(transport);

const { tools } = await client.listTools();

const langchainTools = tools.map((t) =>
  tool(
    async (input) => {
      const result = await client.callTool({
        name: t.name,
        arguments: input,
      });
      return JSON.stringify(result.content);
    },
    {
      name: t.name,
      description: t.description ?? "",
      schema: z.any(),
    },
  ),
);`}</code>
      </pre>
      <p>
        The agent now treats MCP tools as LangChain tools. You get the orchestration of LangChain
        plus the portability of MCP &mdash; the same tool servers are usable by your agent, by
        Cursor, by Claude Desktop, by anything else that speaks MCP.
      </p>

      <h2 id="exposing">Exposing LangChain tools as an MCP server</h2>
      <p>
        The reverse pattern is equally common. You have a battle-tested LangChain Tool (with its own
        retries, prompt template, vector store) and you want Cursor users to be able to call it.
        Wrap it:
      </p>
      <pre>
        <code>{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { myLangchainTool } from "./internal-tool.js";

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "query_docs") throw new Error("unknown tool");
  const result = await myLangchainTool.invoke(req.params.arguments);
  return { content: [{ type: "text", text: result }] };
});`}</code>
      </pre>
      <p>
        The LangChain code stays in place. The MCP server is a thin protocol wrapper around it. Now
        every MCP host can use your tool, and your existing internal agent is unaffected.
      </p>

      <h2 id="decision">Decision table</h2>
      <table>
        <thead>
          <tr>
            <th>Question</th>
            <th>Answer</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Building an app users talk to directly?</td>
            <td>Agent framework (LangChain, LangGraph, etc.)</td>
          </tr>
          <tr>
            <td>Building a tool for Cursor/Claude Desktop/Windsurf?</td>
            <td>MCP server</td>
          </tr>
          <tr>
            <td>Building both?</td>
            <td>Agent framework that calls MCP servers</td>
          </tr>
          <tr>
            <td>Need to expose internal tools to third parties?</td>
            <td>MCP server (the protocol is the standard)</td>
          </tr>
          <tr>
            <td>Need to orchestrate multi-step workflows with branching?</td>
            <td>Agent framework (MCP has no orchestration primitive)</td>
          </tr>
        </tbody>
      </table>

      <h2 id="next">Where to go next</h2>
      <p>
        For the protocol fundamentals, read{" "}
        <Link href={"/blog/what-is-mcp" as Route}>
          the complete guide to Model Context Protocol
        </Link>
        . To see what an MCP server actually looks like in code, the{" "}
        <Link href={"/blog/build-mcp-server" as Route}>step-by-step tutorial</Link> ships you a
        working server in under an hour. And if you decide to build MCP servers and want them hosted
        without the operational tax, <Link href="/">TwinMCP runs them for you</Link>.
      </p>
    </PostLayout>
  );
}
