import type { Metadata, Route } from "next";
import Link from "next/link";
import { PostLayout } from "@/components/blog/post-layout";
import { faqPageSchema, howToSchema } from "@/lib/seo/schema";
import { getPostBySlug } from "@/lib/blog/posts";

const SLUG = "build-mcp-server";
const post = getPostBySlug(SLUG)!;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://twinmcp.fr";

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

const tutorial = howToSchema({
  name: "Build a Model Context Protocol server in TypeScript",
  description:
    "Step-by-step tutorial to build, test, and deploy a Model Context Protocol (MCP) server in TypeScript and connect it to Cursor and Claude Code.",
  totalTime: "PT45M",
  steps: [
    {
      name: "Initialize a TypeScript project",
      text: "Create a new npm project and add the official @modelcontextprotocol/sdk dependency along with TypeScript and tsx.",
    },
    {
      name: "Define the server and its capabilities",
      text: "Instantiate the MCP Server, declare which capabilities (tools, resources, prompts) it advertises, and wire it to a transport.",
    },
    {
      name: "Add a tool the AI model can call",
      text: "Register a tool with a name, a description, and a Zod schema for its parameters. Implement the handler that returns structured content.",
    },
    {
      name: "Add a resource the AI can read",
      text: "Register a resource URI scheme and return content on demand. Resources are read-only data the model can fetch into context.",
    },
    {
      name: "Add a prompt template",
      text: "Define a reusable prompt the user can trigger from the host UI with arguments substituted into a templated conversation.",
    },
    {
      name: "Run the server with the MCP Inspector",
      text: "Use the official MCP Inspector to verify your server announces capabilities correctly and tools execute as expected.",
    },
    {
      name: "Connect the server to Cursor and Claude Code",
      text: "Add the server to each AI host's MCP config (stdio transport for local dev), restart, and verify the tools appear in the model's catalog.",
    },
    {
      name: "Deploy with HTTP transport",
      text: "Switch the transport from stdio to HTTP, package the server, and deploy it to a managed runtime or self-hosted container so multiple developers can share it.",
    },
  ],
});

const faq = [
  {
    q: "What language should I use to build an MCP server?",
    a: "Official MCP SDKs cover TypeScript, Python, C#, Java, Kotlin, Ruby, and Swift; community SDKs exist for Go, Rust, PHP, and others. TypeScript and Python have the most production examples and the smallest gap between local dev and deployment. Pick the language your existing backend is written in.",
  },
  {
    q: "Do I need to know about JSON-RPC to build an MCP server?",
    a: "No. The SDKs hide JSON-RPC entirely. You declare tools, resources, and prompts with high-level helpers; the SDK takes care of message framing, request IDs, and error encoding.",
  },
  {
    q: "How long does it take to build a working MCP server?",
    a: "A minimal server with one tool can be working end to end in under 30 minutes. A production-ready server with auth, retries, logging, and tests typically takes a few days, depending on what the tool wraps.",
  },
  {
    q: "Can I use my existing API client libraries inside an MCP server?",
    a: "Yes. An MCP server is just a Node.js or Python process. You can import any SDK, hit any database, talk to any internal service. The MCP layer only wraps the public surface you expose to the AI client.",
  },
  {
    q: "How do I test an MCP server without an AI model?",
    a: "Use the MCP Inspector, the official MCP project debugger. It connects to your server like a real client, lists declared capabilities, and lets you trigger tool calls manually. You can validate the entire server contract without ever paying for LLM tokens.",
  },
];

export default function Post() {
  return (
    <PostLayout post={post} extraSchemas={[tutorial, faqPageSchema(faq)]}>
      <p>
        <strong>TL;DR.</strong> This tutorial walks through building a working Model Context
        Protocol server from an empty folder. We use TypeScript and the official{" "}
        <code>@modelcontextprotocol/sdk</code> package. By the end you have a server that exposes
        one tool, one resource, and one prompt; you have tested it with the Inspector; you have
        connected it to both Cursor and Claude Code over stdio; and you have deployed it over HTTP
        so others can use it. Total time: about 45 minutes.
      </p>

      <h2 id="what-youll-build">What you will build</h2>
      <p>
        A weather server. The example is deliberately small enough to fit in a single file and
        concrete enough to be useful as a template. It exposes:
      </p>
      <ul>
        <li>
          <strong>One tool</strong>: <code>get_forecast(latitude, longitude)</code> &mdash; returns
          a 3-day forecast from a public weather API.
        </li>
        <li>
          <strong>One resource</strong>: <code>weather://stations/&lt;id&gt;</code> &mdash; returns
          the metadata for a specific weather station.
        </li>
        <li>
          <strong>One prompt</strong>: <code>/plan-trip &lt;city&gt;</code> &mdash; a templated
          prompt that asks the model to draft a trip plan informed by the forecast.
        </li>
      </ul>
      <p>
        Everything you write here generalises directly: replace the weather API with your own
        service, expand the schema, and you have shipped your first internal MCP.
      </p>

      <h2 id="prerequisites">Prerequisites</h2>
      <ul>
        <li>Node.js 20 or newer.</li>
        <li>An AI host installed locally &mdash; Cursor, Claude Code, or Claude Desktop.</li>
        <li>Familiarity with TypeScript and async/await. No prior MCP experience required.</li>
        <li>
          A public weather API key (we use the free tier of{" "}
          <a href="https://open-meteo.com" rel="noopener noreferrer" target="_blank">
            Open-Meteo
          </a>
          , which requires no key, to keep the example portable).
        </li>
      </ul>

      <h2 id="step-1">Step 1 &mdash; Initialize the project</h2>
      <pre>
        <code>{`mkdir mcp-weather && cd mcp-weather
npm init -y
npm install @modelcontextprotocol/sdk zod
npm install -D typescript tsx @types/node
npx tsc --init`}</code>
      </pre>
      <p>
        Edit <code>tsconfig.json</code> so the compiler targets modern Node:
      </p>
      <pre>
        <code>{`{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}`}</code>
      </pre>
      <p>
        Open <code>package.json</code> and add <code>{`"type": "module"`}</code> plus a couple of
        scripts:
      </p>
      <pre>
        <code>{`{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}`}</code>
      </pre>

      <h2 id="step-2">Step 2 &mdash; Define the server</h2>
      <p>
        Create <code>src/server.ts</code> and instantiate the MCP Server. The constructor takes a
        name, a version, and the list of capabilities the server advertises.
      </p>
      <pre>
        <code>{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "weather", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Weather MCP server running on stdio");`}</code>
      </pre>
      <p>
        Two things to notice. First, the <code>capabilities</code> object declares which primitive
        types this server supports &mdash; clients use it to know which lists to ask for. Second, we
        log to <code>stderr</code> on purpose: stdout carries the JSON-RPC protocol, and a stray{" "}
        <code>console.log</code> would corrupt the stream.
      </p>

      <h2 id="step-3">Step 3 &mdash; Register a tool</h2>
      <p>
        Tools are the most common primitive. Each one needs a name, a description (the model reads
        this to decide when to use the tool), and a schema for its inputs. The SDK uses Zod schemas,
        which it converts to JSON Schema automatically.
      </p>
      <pre>
        <code>{`import { z } from "zod";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const ForecastInput = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_forecast",
      description:
        "Returns a 3-day weather forecast (temperature, precipitation) for a given coordinate.",
      inputSchema: {
        type: "object",
        properties: {
          latitude: { type: "number" },
          longitude: { type: "number" },
        },
        required: ["latitude", "longitude"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_forecast") {
    throw new Error(\`Unknown tool: \${request.params.name}\`);
  }
  const { latitude, longitude } = ForecastInput.parse(request.params.arguments);
  const r = await fetch(
    \`https://api.open-meteo.com/v1/forecast?latitude=\${latitude}\` +
    \`&longitude=\${longitude}&daily=temperature_2m_max,precipitation_sum&forecast_days=3\`,
  );
  const data = await r.json();
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
});`}</code>
      </pre>
      <p>
        The <code>content</code> array in the response is how MCP returns structured data. Each
        entry has a type (<code>text</code>, <code>image</code>, <code>resource</code>); clients
        render them appropriately. For now, returning JSON as text is the path of least resistance.
      </p>

      <h2 id="step-4">Step 4 &mdash; Register a resource</h2>
      <p>
        Resources are read-only data the model can fetch on demand. They are addressed by URI under
        a scheme you choose. Here we expose station metadata under{" "}
        <code>weather://stations/&lt;id&gt;</code>.
      </p>
      <pre>
        <code>{`import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const STATIONS = {
  "paris-le-bourget": { lat: 48.97, lon: 2.44, name: "Paris Le Bourget" },
  "london-heathrow": { lat: 51.47, lon: -0.45, name: "London Heathrow" },
};

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: Object.entries(STATIONS).map(([id, s]) => ({
    uri: \`weather://stations/\${id}\`,
    name: s.name,
    mimeType: "application/json",
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const id = request.params.uri.replace("weather://stations/", "");
  const station = STATIONS[id as keyof typeof STATIONS];
  if (!station) throw new Error(\`Unknown station: \${id}\`);
  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(station, null, 2),
      },
    ],
  };
});`}</code>
      </pre>

      <h2 id="step-5">Step 5 &mdash; Register a prompt</h2>
      <p>
        Prompts are user-initiated templates. The user picks one from the host&apos;s command
        palette, fills in the arguments, and the host sends the resulting conversation to the model.
      </p>
      <pre>
        <code>{`import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    {
      name: "plan-trip",
      description: "Draft a trip plan informed by the weather forecast.",
      arguments: [
        { name: "city", description: "Destination city", required: true },
        { name: "days", description: "Trip duration in days", required: false },
      ],
    },
  ],
}));

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "plan-trip") {
    throw new Error(\`Unknown prompt: \${request.params.name}\`);
  }
  const city = request.params.arguments?.city ?? "Paris";
  const days = request.params.arguments?.days ?? "3";
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            \`Plan a \${days}-day trip to \${city}. Use the get_forecast tool to check the \` +
            \`weather before suggesting outdoor activities. Be specific about timing.\`,
        },
      },
    ],
  };
});`}</code>
      </pre>

      <h2 id="step-6">Step 6 &mdash; Test with the MCP Inspector</h2>
      <p>
        Before wiring the server into a real IDE, validate it with the Inspector. It is a small web
        UI that connects to any MCP server, lists its capabilities, and lets you trigger tool calls
        manually.
      </p>
      <pre>
        <code>{`npx @modelcontextprotocol/inspector tsx src/server.ts`}</code>
      </pre>
      <p>
        The Inspector opens in your browser. Confirm the three tabs &mdash; Tools, Resources,
        Prompts &mdash; show your declarations. Call <code>get_forecast</code> with sample
        coordinates and check the response. Read the{" "}
        <code>weather://stations/paris-le-bourget</code> resource. Trigger the{" "}
        <code>plan-trip</code> prompt. If any of these fail, fix them now &mdash; the debugging loop
        with a real AI client is much slower than the Inspector.
      </p>

      <h2 id="step-7">Step 7 &mdash; Connect to Cursor and Claude Code</h2>
      <p>
        Both hosts read MCP server lists from a config file. The format is identical and
        straightforward.
      </p>
      <h3>Cursor</h3>
      <p>
        Open Cursor settings, jump to <strong>Features &rarr; Model Context Protocol</strong>, and
        add a server. The config is:
      </p>
      <pre>
        <code>{`{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["/absolute/path/to/dist/server.js"]
    }
  }
}`}</code>
      </pre>
      <p>
        Build the project first (<code>npm run build</code>), then point Cursor at the built file.
        Restart Cursor; the weather server appears in the panel and its tools light up green when
        the model has access to them.
      </p>
      <h3>Claude Code</h3>
      <p>From a terminal, run:</p>
      <pre>
        <code>{`claude mcp add weather node /absolute/path/to/dist/server.js`}</code>
      </pre>
      <p>
        Claude Code reloads automatically. Start a new conversation, ask for the weather in a city,
        and watch the model call <code>get_forecast</code> in real time.
      </p>

      <h2 id="step-8">Step 8 &mdash; Switch to HTTP transport and deploy</h2>
      <p>
        stdio is great for local development but does not allow sharing across machines. Swap the
        transport for HTTP to let teammates connect to one shared instance.
      </p>
      <pre>
        <code>{`import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
app.use(express.json());

let transport: SSEServerTransport | undefined;

app.get("/sse", async (_req, res) => {
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  if (!transport) return res.status(400).send("No active SSE session");
  await transport.handlePostMessage(req, res);
});

app.listen(3001, () => console.error("MCP server listening on :3001"));`}</code>
      </pre>
      <p>
        From here you have two paths. The first is self-hosting: package the server in Docker, push
        it to a VPS, put it behind a reverse proxy with TLS, and configure the IDE with the public
        URL plus a bearer token. The second is a managed runtime:{" "}
        <Link href="/">deploy to TwinMCP</Link> by pointing it at your package, filling in the
        install and start commands, and getting a stable URL with a per-user API key in return.
        Either way, the server is now shareable.
      </p>
      <p>
        For a deeper comparison of every hosting option &mdash; cost, ops burden, isolation &mdash;
        read our dedicated guide on{" "}
        <Link href={"/blog/mcp-server-hosting" as Route}>MCP server hosting</Link>.
      </p>

      <h2 id="pitfalls">Common pitfalls (and how to avoid them)</h2>
      <h3>Logging to stdout</h3>
      <p>
        With stdio transport, stdout is the protocol channel. Any stray <code>console.log</code>
        breaks the connection silently. Always log to stderr (<code>console.error</code>) during
        local development. Once you move to HTTP this stops mattering.
      </p>
      <h3>Forgetting to declare capabilities</h3>
      <p>
        If you implement tools but forget the <code>tools: {`{}`}</code> entry in the server
        constructor, clients will never ask for the tool list and the model will not see them. The
        same applies to resources and prompts.
      </p>
      <h3>Returning unstructured strings</h3>
      <p>
        Tool responses must be wrapped in the <code>content</code> array. Returning a raw string
        from the handler throws a hard-to-read SDK error. When in doubt, return{" "}
        <code>{`{ content: [{ type: "text", text: "..." }] }`}</code>.
      </p>
      <h3>Holding mutable state in a stdio server</h3>
      <p>
        Restart the host and the server restarts; in-memory state vanishes. If your tool needs
        persistence, write it to disk or to an external store. Migration to HTTP transport solves
        this automatically because the server then outlives any single client.
      </p>
      <h3>Hardcoded absolute paths</h3>
      <p>
        Every host config in this article uses absolute paths. They break the moment you move the
        project. For production, ship the server as a published npm package (clients run it via{" "}
        <code>npx your-package</code>) or as a Docker image with an explicit entrypoint.
      </p>

      <h2 id="next-steps">Where to go from here</h2>
      <p>
        You now have the entire shape of an MCP server in muscle memory. Concrete next moves, in
        order of usefulness:
      </p>
      <ol>
        <li>
          Replace the weather example with whatever internal API your team actually maintains. The
          structure does not change.
        </li>
        <li>
          Add tests. The SDK ships <code>InMemoryTransport</code>, which lets you exercise the
          server end-to-end inside a Vitest or Jest run without network or stdio.
        </li>
        <li>
          Add auth. For HTTP transport, the standard pattern is a bearer token validated in an
          Express middleware before requests reach the MCP handler.
        </li>
        <li>
          Publish. If the server is open source and broadly useful, list it on the public MCP
          catalogs. If it is private, deploy it to a runtime that handles secrets and isolation.
        </li>
      </ol>
      <p>
        For the conceptual background you skipped to get here, read{" "}
        <Link href={"/blog/what-is-mcp" as Route}>
          the complete guide to Model Context Protocol
        </Link>
        . And when you are ready to stop running this server on your laptop, the{" "}
        <Link href="/">TwinMCP free tier</Link> takes you from <code>git push</code> to a working
        HTTP MCP in about two minutes.
      </p>
    </PostLayout>
  );
}
