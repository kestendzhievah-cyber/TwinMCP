# @twinmcp/tools-ai-sdk

[Vercel AI SDK](https://ai-sdk.dev/) tools and an agent that look up version-specific library
documentation through the TwinMCP documentation API. Built on [`@twinmcp/sdk`](../sdk).

Two tools:

- `resolveLibraryId` finds the TwinMCP library ID for a package name (e.g. `/facebook/react`).
- `queryDocs` fetches documentation and code examples for that ID and a question.

## Install

```bash
npm install @twinmcp/tools-ai-sdk @twinmcp/sdk ai zod
```

Requires a TwinMCP API key (`ctx7sk_…`) from [twinmcp.fr/dashboard](https://twinmcp.fr/dashboard),
passed as `apiKey` or set as `TWINMCP_API_KEY`.

## Tools with `generateText`

```ts
import { resolveLibraryId, queryDocs } from "@twinmcp/tools-ai-sdk";
import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  prompt: "How do I use React Server Components?",
  tools: {
    resolveLibraryId: resolveLibraryId(),
    queryDocs: queryDocs(),
  },
  stopWhen: stepCountIs(5),
});
```

## The agent

`TwinMCPAgent` wires both tools and the system prompt into an AI SDK `ToolLoopAgent`:

```ts
import { TwinMCPAgent } from "@twinmcp/tools-ai-sdk";
import { anthropic } from "@ai-sdk/anthropic";

const agent = new TwinMCPAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  apiKey: process.env.TWINMCP_API_KEY,
});

const { text } = await agent.generate({ prompt: "How do I set up routing in Next.js?" });
```

## Development

```sh
pnpm --filter @twinmcp/tools-ai-sdk test
pnpm --filter @twinmcp/tools-ai-sdk build
```
