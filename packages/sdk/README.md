# @twinmcp/sdk

TypeScript client for the TwinMCP documentation API (`https://twinmcp.fr/api/v2`): search a
library, then fetch version-specific documentation and code examples for a question.

> Work in progress: the API may change between minor versions.

## Install

```bash
npm install @twinmcp/sdk
```

Requires a TwinMCP API key (`ctx7sk_…`). Create one in the dashboard at
[twinmcp.fr/dashboard](https://twinmcp.fr/dashboard).

## Usage

```ts
import { TwinMCP } from "@twinmcp/sdk";

const client = new TwinMCP({ apiKey: process.env.TWINMCP_API_KEY });

// Find the library ID
const libraries = await client.searchLibrary("I need to build a UI with components", "react");
console.log(libraries[0].id); // e.g. "/facebook/react"

// Documentation as JSON (default)
const docs = await client.getContext("How do I use hooks?", "/facebook/react");
console.log(docs[0].title, docs[0].content);

// Documentation as plain text
const text = await client.getContext("How do I use hooks?", "/facebook/react", { type: "txt" });
```

Without `apiKey`, the client reads `TWINMCP_API_KEY` from the environment.

## Related packages

- [`@twinmcp/tools-ai-sdk`](../tools-ai-sdk): the same calls as Vercel AI SDK tools.
- [`@twinmcp/mcp`](../mcp): the same calls as an MCP server.
- [`@twinmcp/cli`](../cli): manage TwinMCP servers and connect AI clients from a terminal.

## License

MIT, see [LICENSE](LICENSE).
