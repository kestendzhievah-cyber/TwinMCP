/**
 * /api/mcp/tools — Legacy tool-list endpoint.
 *
 * Returns the same tool list as the main JSON-RPC endpoint.
 * Kept for backward compatibility.
 *
 * Preferred usage: POST /api/mcp with { "method": "tools/list" }
 */

import { NextResponse } from 'next/server';

const MCP_TOOLS = [
  {
    name: 'resolve-library-id',
    description:
      'Resolve library names and find matching software libraries. Use this to find the TwinMCP library ID for a given library name before querying documentation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'User question or task to help contextualise the search',
        },
        libraryName: {
          type: 'string',
          description: 'Human name of the library (e.g. "React", "Next.js", "MongoDB")',
        },
      },
      required: ['query', 'libraryName'],
    },
  },
  {
    name: 'query-docs',
    description:
      'Search documentation for a specific library. Returns code snippets, guides, and API references optimised for LLM context.',
    inputSchema: {
      type: 'object',
      properties: {
        libraryId: { type: 'string', description: 'TwinMCP library ID in format /vendor/lib' },
        query: {
          type: 'string',
          description: 'Question or task (setup, code example, configuration, etc.)',
        },
        version: { type: 'string', description: 'Optional specific version of the library' },
        maxResults: { type: 'number', description: 'Maximum number of results (default: 10)' },
        maxTokens: { type: 'number', description: 'Maximum tokens in response (default: 4000)' },
      },
      required: ['libraryId', 'query'],
    },
  },
];

export async function GET() {
  return NextResponse.json({
    tools: MCP_TOOLS,
    serverInfo: { name: 'twinmcp-server', version: '1.0.0' },
  });
}
