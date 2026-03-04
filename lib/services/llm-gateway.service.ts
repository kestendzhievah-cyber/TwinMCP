/**
 * Centralized LLM Gateway for Next.js app routes.
 *
 * Single source of truth for:
 *  - Provider selection (OpenAI → Anthropic → simulation fallback)
 *  - Cost calculation per model
 *  - Token counting
 *  - Streaming + non-streaming
 *
 * Eliminates duplicated raw fetch() calls across chat/message and chat/stream routes.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMGatewayOptions {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMGatewayResponse {
  content: string;
  metadata: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latency: number;
    cost: number;
  };
}

export interface LLMStreamChunk {
  content?: string;
  done?: boolean;
  metadata?: {
    provider: string;
    model: string;
  };
}

// ---------------------------------------------------------------------------
// Cost calculation
// ---------------------------------------------------------------------------

interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
}

function getModelPricing(provider: string, model: string): ModelPricing {
  if (provider === 'openai') {
    if (model.includes('gpt-4o-mini')) return { inputPer1K: 0.00015, outputPer1K: 0.0006 };
    if (model.includes('gpt-4o')) return { inputPer1K: 0.0025, outputPer1K: 0.01 };
    if (model.includes('gpt-4-turbo')) return { inputPer1K: 0.01, outputPer1K: 0.03 };
    if (model.includes('gpt-4')) return { inputPer1K: 0.03, outputPer1K: 0.06 };
    // gpt-3.5-turbo and fallback
    return { inputPer1K: 0.0005, outputPer1K: 0.0015 };
  }

  if (provider === 'anthropic') {
    if (model.includes('opus')) return { inputPer1K: 0.015, outputPer1K: 0.075 };
    if (model.includes('sonnet')) return { inputPer1K: 0.003, outputPer1K: 0.015 };
    // haiku and fallback
    return { inputPer1K: 0.0008, outputPer1K: 0.004 };
  }

  return { inputPer1K: 0, outputPer1K: 0 };
}

function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = getModelPricing(provider, model);
  return (promptTokens / 1000) * pricing.inputPer1K + (completionTokens / 1000) * pricing.outputPer1K;
}

// ---------------------------------------------------------------------------
// Non-streaming generation
// ---------------------------------------------------------------------------

export async function generateResponse(
  message: string,
  options: LLMGatewayOptions = {}
): Promise<LLMGatewayResponse> {
  const startTime = Date.now();
  const systemPrompt = options.systemPrompt || 'You are a helpful assistant.';

  // Try OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = options.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: options.maxTokens || 1024,
          temperature: options.temperature ?? 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const promptTokens = data.usage?.prompt_tokens || 0;
        const completionTokens = data.usage?.completion_tokens || 0;
        const actualModel = data.model || model;
        return {
          content: data.choices?.[0]?.message?.content || 'No response generated',
          metadata: {
            provider: 'openai',
            model: actualModel,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            latency: Date.now() - startTime,
            cost: calculateCost('openai', actualModel, promptTokens, completionTokens),
          },
        };
      }
    } catch (error) {
      logger.warn('[LLM Gateway] OpenAI failed, trying fallback:', error);
    }
  }

  // Try Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const model = options.model || 'claude-3-5-haiku-20241022';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 1024,
          messages: [{ role: 'user', content: message }],
          system: systemPrompt,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const promptTokens = data.usage?.input_tokens || 0;
        const completionTokens = data.usage?.output_tokens || 0;
        const actualModel = data.model || model;
        return {
          content: data.content?.[0]?.text || 'No response generated',
          metadata: {
            provider: 'anthropic',
            model: actualModel,
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
            latency: Date.now() - startTime,
            cost: calculateCost('anthropic', actualModel, promptTokens, completionTokens),
          },
        };
      }
    } catch (error) {
      logger.warn('[LLM Gateway] Anthropic failed, trying fallback:', error);
    }
  }

  // Simulation fallback
  return {
    content: `[Mode simulation] Réponse à : "${message.substring(0, 100)}". Configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour des réponses réelles.`,
    metadata: {
      provider: 'simulation',
      model: 'none',
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      latency: Date.now() - startTime,
      cost: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Streaming generation
// ---------------------------------------------------------------------------

export async function* streamResponse(
  message: string,
  options: LLMGatewayOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  const systemPrompt = options.systemPrompt || 'You are a helpful assistant.';

  // Try OpenAI streaming
  if (process.env.OPENAI_API_KEY) {
    try {
      const model = options.model || 'gpt-4o-mini';
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          max_tokens: options.maxTokens || 1024,
          temperature: options.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed?.startsWith('data: ')) continue;
            const payload = trimmed.slice(6);
            if (payload === '[DONE]') {
              yield { done: true };
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                yield { content: delta, metadata: { provider: 'openai', model: parsed.model || model } };
              }
            } catch {
              /* skip malformed chunk */
            }
          }
        }
        yield { done: true };
        return;
      }
    } catch (error) {
      logger.warn('[LLM Gateway] OpenAI streaming failed, trying fallback:', error);
    }
  }

  // Try Anthropic streaming
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const model = options.model || 'claude-3-5-haiku-20241022';
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens || 1024,
          messages: [{ role: 'user', content: message }],
          system: systemPrompt,
          stream: true,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed?.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                yield {
                  content: parsed.delta.text,
                  metadata: { provider: 'anthropic', model },
                };
              }
              if (parsed.type === 'message_stop') {
                yield { done: true };
                return;
              }
            } catch {
              /* skip malformed chunk */
            }
          }
        }
        yield { done: true };
        return;
      }
    } catch (error) {
      logger.warn('[LLM Gateway] Anthropic streaming failed, trying fallback:', error);
    }
  }

  // Simulation fallback
  const simParts = [
    `[Mode simulation] Réponse à : "${message.substring(0, 80)}". `,
    'Configurez OPENAI_API_KEY ou ANTHROPIC_API_KEY pour des réponses réelles. ',
  ];
  for (const part of simParts) {
    yield { content: part, metadata: { provider: 'simulation', model: 'none' } };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  yield { done: true };
}

// ---------------------------------------------------------------------------
// Utility: estimate tokens from text (simple heuristic)
// ---------------------------------------------------------------------------

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
