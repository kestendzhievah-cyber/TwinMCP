import { ToolLoopAgent, type ToolLoopAgentSettings, type ToolSet, stepCountIs } from "ai";
import { resolveLibraryId, queryDocs } from "@tools";
import { AGENT_PROMPT } from "@prompts";

/**
 * Configuration for TwinMCP agent.
 */
export interface TwinMCPAgentConfig extends ToolLoopAgentSettings<never, ToolSet> {
  /**
   * TwinMCP API key. If not provided, uses the TWINMCP_API_KEY environment variable.
   */
  apiKey?: string;
}

/**
 * TwinMCP documentation search agent
 *
 * The agent follows a multi-step workflow:
 * 1. Resolves library names to TwinMCP library IDs
 * 2. Fetches documentation for the resolved library
 * 3. Provides answers with code examples
 *
 * @example
 * ```typescript
 * import { TwinMCPAgent } from '@upstash/twinmcp-tools-ai-sdk';
 * import { anthropic } from '@ai-sdk/anthropic';
 *
 * const agent = new TwinMCPAgent({
 *   model: anthropic('claude-sonnet-4-20250514'),
 *   apiKey: 'your-twinmcp-api-key',
 * });
 *
 * const result = await agent.generate({
 *   prompt: 'How do I use React Server Components?',
 * });
 * ```
 */
export class TwinMCPAgent extends ToolLoopAgent<never, ToolSet> {
  constructor(config: TwinMCPAgentConfig) {
    const {
      model,
      stopWhen = stepCountIs(5),
      instructions,
      apiKey,

      tools,
      ...agentSettings
    } = config;

    const twinmcpConfig = { apiKey };

    super({
      ...agentSettings,
      model,
      instructions: instructions || AGENT_PROMPT,
      tools: {
        ...tools,
        resolveLibraryId: resolveLibraryId(twinmcpConfig),
        queryDocs: queryDocs(twinmcpConfig),
      },
      stopWhen,
    });
  }
}
