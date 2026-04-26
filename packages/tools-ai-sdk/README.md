# Upstash TwinMCP AI SDK

`@upstash/twinmcp-tools-ai-sdk` provides [Vercel AI SDK](https://ai-sdk.dev/) compatible tools and agents that give your AI applications access to up to date library documentation through TwinMCP.

Use this package to:

- Add documentation lookup tools to your AI SDK workflows with `generateText` or `streamText`
- Create documentation aware agents using the pre-configured `TwinMCPAgent`
- Build RAG pipelines that retrieve accurate, version specific code examples

The package provides two main tools:

- `resolveLibrary` - Searches TwinMCP's database to find the correct library ID
- `getLibraryDocs` - Fetches documentation for a specific library with optional topic filtering

## Quick Start

### Install

```bash
npm install @upstash/twinmcp-tools-ai-sdk @upstash/twinmcp-sdk ai zod
```

### Get API Key

Get your API key from [TwinMCP](https://twinmcp.com)

## Usage

### Using Tools with `generateText`

```typescript
import { resolveLibrary, getLibraryDocs } from "@upstash/twinmcp-tools-ai-sdk";
import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: "How do I use React Server Components?",
  tools: {
    resolveLibrary: resolveLibrary(),
    getLibraryDocs: getLibraryDocs(),
  },
  stopWhen: stepCountIs(5),
});

console.log(text);
```

### Using the TwinMCP Agent

The package provides a pre-configured agent that handles the multi-step workflow automatically:

```typescript
import { TwinMCPAgent } from "@upstash/twinmcp-tools-ai-sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new TwinMCPAgent({
  model: anthropic("claude-sonnet-4-20250514"),
});

const { text } = await agent.generate({
  prompt: "How do I set up routing in Next.js?",
});

console.log(text);
```

## Configuration

### Environment Variables

Set your API key via environment variable:

```sh
TWINMCP_API_KEY=ctx7sk-...
```

Then use tools and agents without explicit configuration:

```typescript
const tool = resolveLibrary(); // Uses TWINMCP_API_KEY automatically
```

## Docs

See the [documentation](https://twinmcp.com/docs/agentic-tools/ai-sdk/getting-started) for details.

## Contributing

### Running tests

```sh
pnpm test
```

### Building

```sh
pnpm build
```
