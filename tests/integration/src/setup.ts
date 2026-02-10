/**
 * @fileoverview Shared test setup and mock model factories for integration tests.
 * Uses ai/test MockLanguageModelV3 per official AI SDK testing guidance.
 */

import { MockLanguageModelV3, simulateReadableStream, mockValues } from 'ai/test';
import type { LanguageModel } from 'ai';

/**
 * Create a mock model that returns a fixed text response.
 */
export function createMockModel(text: string): LanguageModel {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  }) as unknown as LanguageModel;
}

/**
 * Create a mock model that cycles through multiple text responses.
 * Each call to generate returns the next text in the array.
 */
export function createMockMultiModel(texts: string[]): LanguageModel {
  const values = mockValues(
    ...texts.map((text) => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: undefined },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    })),
  );

  return new MockLanguageModelV3({
    doGenerate: async () => values(),
  }) as unknown as LanguageModel;
}

/**
 * Create a mock model that streams text chunks.
 */
export function createMockStreamModel(text: string): LanguageModel {
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start', id: 'text-1' },
          ...text.split(' ').map((word, i) => ({
            type: 'text-delta' as const,
            id: 'text-1',
            delta: (i > 0 ? ' ' : '') + word,
          })),
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 20, text: 20, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  }) as unknown as LanguageModel;
}

/**
 * Create a mock model that returns tool calls on first request, then text on second.
 */
export function createMockToolModel(
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  finalText: string,
): LanguageModel {
  let callCount = 0;
  return new MockLanguageModelV3({
    doGenerate: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: toolCalls.map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.id,
            toolName: tc.name,
            args: JSON.stringify(tc.args),
          })),
          finishReason: { unified: 'tool-calls', raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 20, text: 20, reasoning: undefined },
          },
          warnings: [],
        };
      }
      return {
        content: [{ type: 'text', text: finalText }],
        finishReason: { unified: 'stop', raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 20, text: 20, reasoning: undefined },
        },
        warnings: [],
      };
    },
  }) as unknown as LanguageModel;
}
