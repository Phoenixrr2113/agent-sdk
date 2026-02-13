/**
 * @fileoverview Tests for createAgent — the unified, zero-config agent factory.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
import { simulateReadableStream } from 'ai';
import type { LanguageModel } from 'ai';

// Mock internal dependencies (NOT 'ai' itself)
vi.mock('@agntk/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    time: () => vi.fn(),
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      trace: vi.fn(),
      time: () => vi.fn(),
    }),
  }),
}));

vi.mock('../models', () => ({
  resolveModel: () => {
    return new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: 'text' as const, text: 'mock response' }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage: {
          inputTokens: { total: 10 },
          outputTokens: { total: 20, text: 20, reasoning: 0 },
        },
        warnings: [],
      }),
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: 'text-start' as const, id: 'text-1' },
            { type: 'text-delta' as const, id: 'text-1', delta: 'mock response' },
            { type: 'text-end' as const, id: 'text-1' },
            {
              type: 'finish' as const,
              finishReason: { unified: 'stop' as const, raw: undefined },
              logprobs: undefined,
              usage: {
                inputTokens: { total: 10 },
                outputTokens: { total: 20, text: 20, reasoning: 0 },
              },
            },
          ],
        }),
      }),
    }) as unknown as LanguageModel;
  },
}));

vi.mock('../presets/tools', () => ({
  createToolPreset: (preset: string, _options?: Record<string, unknown>) => {
    if (preset === 'none') return {};
    if (preset === 'full') return { glob: { description: 'glob' }, grep: { description: 'grep' }, shell: { description: 'shell' }, ast_grep_search: { description: 'ast' } };
    throw new Error(`Unknown tool preset: ${preset}`);
  },
}));

vi.mock('../tools/spawn-agent', () => ({
  createSpawnAgentTool: () => ({ description: 'spawn_agent mock' }),
}));

vi.mock('../tools/model-retry', () => ({
  wrapAllToolsWithRetry: (tools: Record<string, unknown>, _maxRetries?: number) => tools,
}));

vi.mock('../skills', () => ({
  discoverSkills: () => [],
  filterEligibleSkills: () => [],
  loadSkillContent: (s: unknown) => s,
  buildSkillsSystemPrompt: () => '',
}));

vi.mock('../workflow/utils', () => ({
  checkWorkflowAvailability: async () => false,
}));

vi.mock('../workflow/durable-tool', () => ({
  wrapToolsAsDurable: (tools: Record<string, unknown>) => tools,
}));

vi.mock('../observability', () => ({
  initObservability: vi.fn(async () => true),
  createTelemetrySettings: vi.fn((opts?: Record<string, unknown>) => ({
    isEnabled: true,
    functionId: opts?.functionId,
    metadata: opts?.metadata,
  })),
}));

vi.mock('../reflection', () => ({
  createReflectionPrepareStep: () => undefined,
}));

vi.mock('../guardrails/built-ins', () => ({
  contentFilter: () => ({ name: 'content-filter', check: async () => ({ passed: true, name: 'content-filter' }) }),
}));

vi.mock('../guardrails/runner', () => ({
  runGuardrails: async () => ({ results: [], filteredText: '' }),
  handleGuardrailResults: () => ({ blocked: false, text: '' }),
}));

vi.mock('../memory/store', () => ({
  MarkdownMemoryStore: vi.fn().mockImplementation(() => ({
    getProjectPath: () => '/tmp/test',
    getGlobalPath: () => '/tmp/test-global',
  })),
}));

vi.mock('../memory/loader', () => ({
  loadMemoryContext: async () => null,
}));

vi.mock('../memory/tools', () => ({
  createMemoryTools: () => ({}),
}));

vi.mock('../prompts/context', () => ({
  buildDynamicSystemPrompt: async (prompt: string) => prompt,
}));

// --- Import after mocks ---
import { createAgent } from '../agent';

/**
 * Helper: create a MockLanguageModelV3 for passing directly as `model` option.
 */
function createTestModel(text = 'test response'): LanguageModel {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text' as const, text }],
      finishReason: { unified: 'stop' as const, raw: 'stop' },
      usage: {
        inputTokens: { total: 10 },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
      warnings: [],
    }),
    doStream: async () => ({
      stream: simulateReadableStream({
        chunks: [
          { type: 'text-start' as const, id: 'text-1' },
          { type: 'text-delta' as const, id: 'text-1', delta: text },
          { type: 'text-end' as const, id: 'text-1' },
          {
            type: 'finish' as const,
            finishReason: { unified: 'stop' as const, raw: undefined },
            logprobs: undefined,
            usage: {
              inputTokens: { total: 10 },
              outputTokens: { total: 20, text: 20, reasoning: 0 },
            },
          },
        ],
      }),
    }),
  }) as unknown as LanguageModel;
}

describe('createAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('basic creation', () => {
    it('should create agent with just a name', () => {
      const agent = createAgent({ name: 'test-agent' });
      expect(agent.name).toBe('test-agent');
    });

    it('should create agent with name and instructions', () => {
      const agent = createAgent({
        name: 'deploy-bot',
        instructions: 'You manage deployments for our k8s cluster.',
      });
      expect(agent.name).toBe('deploy-bot');
      expect(agent.getSystemPrompt()).toContain('deploy-bot');
      expect(agent.getSystemPrompt()).toContain('You manage deployments');
    });

    it('should include instructions in system prompt', () => {
      const agent = createAgent({
        name: 'my-agent',
        instructions: 'Custom instructions here.',
      });
      expect(agent.getSystemPrompt()).toContain('Custom instructions here.');
    });
  });

  describe('agent interface', () => {
    it('should expose name, init, stream, getSystemPrompt, getToolNames', () => {
      const agent = createAgent({ name: 'test-agent' });
      expect(agent.name).toBe('test-agent');
      expect(typeof agent.init).toBe('function');
      expect(typeof agent.stream).toBe('function');
      expect(typeof agent.getSystemPrompt).toBe('function');
      expect(typeof agent.getToolNames).toBe('function');
    });

    it('should return tool names', () => {
      const agent = createAgent({ name: 'test-agent' });
      const toolNames = agent.getToolNames();
      expect(Array.isArray(toolNames)).toBe(true);
      // Should have at least spawn_agent from the mock
      expect(toolNames).toContain('spawn_agent');
    });
  });

  describe('custom tools', () => {
    it('should merge custom tools with built-in tools', () => {
      const customTool = { description: 'my custom tool' };
      const agent = createAgent({
        name: 'test-agent',
        tools: { myTool: customTool } as Record<string, unknown> as Record<string, import('ai').Tool>,
      });
      expect(agent.getToolNames()).toContain('myTool');
    });
  });

  describe('model override', () => {
    it('should accept explicit model', () => {
      const model = createTestModel('custom model response');
      const agent = createAgent({
        name: 'test-agent',
        model,
      });
      expect(agent).toBeDefined();
    });
  });

  describe('maxSteps', () => {
    it('should accept custom maxSteps', () => {
      const agent = createAgent({ name: 'test-agent', maxSteps: 50 });
      expect(agent).toBeDefined();
    });
  });

  describe('usageLimits', () => {
    it('should accept usageLimits without error', () => {
      const agent = createAgent({
        name: 'test-agent',
        usageLimits: { maxRequests: 20, maxTotalTokens: 100_000 },
      });
      expect(agent).toBeDefined();
    });
  });

  describe('streaming', () => {
    it('should call stream and return result', async () => {
      const agent = createAgent({
        name: 'test-agent',
        model: createTestModel('stream response'),
        maxSteps: 1,
      });

      const result = await agent.stream({ prompt: 'hello' });
      expect(result.fullStream).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.usage).toBeDefined();

      const text = await result.text;
      expect(text).toBe('stream response');
    });
  });
});
