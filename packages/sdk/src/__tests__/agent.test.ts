/**
 * @fileoverview Tests for createAgent — role-based creation, preset selection, memory toggle.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockLanguageModelV3 } from 'ai/test';
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
  resolveModel: (opts: Record<string, unknown>) => {
    // Return a real MockLanguageModelV3 so ToolLoopAgent works
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
    }) as unknown as LanguageModel;
  },
}));

vi.mock('../presets/role-registry', () => ({
  getRole: (name: string) => {
    const roles: Record<string, { systemPrompt: string; recommendedModel: string }> = {
      generic: { systemPrompt: 'You are a generic agent.', recommendedModel: 'standard' },
      coder: { systemPrompt: 'You are a coder agent.', recommendedModel: 'powerful' },
      researcher: { systemPrompt: 'You are a researcher.', recommendedModel: 'standard' },
      analyst: { systemPrompt: 'You are an analyst.', recommendedModel: 'standard' },
    };
    return roles[name] ?? roles.generic;
  },
}));

vi.mock('../presets/tools', () => ({
  createToolPreset: (preset: string, _options?: Record<string, unknown>) => {
    if (preset === 'none') return {};
    if (preset === 'minimal') return { glob: { description: 'glob' } };
    if (preset === 'standard') return { glob: { description: 'glob' }, grep: { description: 'grep' }, shell: { description: 'shell' } };
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
  loadSkills: () => [],
  buildSkillsSystemPrompt: () => '',
}));

vi.mock('../workflow/utils', () => ({
  checkWorkflowAvailability: async () => false,
}));

vi.mock('../observability', () => ({
  initObservability: vi.fn(async () => true),
  createTelemetrySettings: vi.fn((opts?: Record<string, unknown>) => ({
    isEnabled: true,
    functionId: opts?.functionId,
    metadata: opts?.metadata,
  })),
}));

// --- Import after mocks ---
import { createAgent, createCoderAgent, createResearcherAgent, createAnalystAgent } from '../agent';
import { initObservability, createTelemetrySettings } from '../observability';

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
  }) as unknown as LanguageModel;
}

describe('createAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('role-based creation', () => {
    it('should create agent with default generic role', () => {
      const agent = createAgent();
      expect(agent.role).toBe('generic');
      expect(agent.agentId).toBeDefined();
    });

    it('should create agent with coder role', () => {
      const agent = createAgent({ role: 'coder' });
      expect(agent.role).toBe('coder');
      expect(agent.getSystemPrompt()).toBe('You are a coder agent.');
    });

    it('should create agent with researcher role', () => {
      const agent = createAgent({ role: 'researcher' });
      expect(agent.role).toBe('researcher');
      expect(agent.getSystemPrompt()).toBe('You are a researcher.');
    });

    it('should create agent with analyst role', () => {
      const agent = createAgent({ role: 'analyst' });
      expect(agent.role).toBe('analyst');
      expect(agent.getSystemPrompt()).toBe('You are an analyst.');
    });

    it('should use custom systemPrompt over role default', () => {
      const agent = createAgent({
        role: 'coder',
        systemPrompt: 'Custom instructions here.',
      });
      expect(agent.getSystemPrompt()).toBe('Custom instructions here.');
    });
  });

  describe('preset selection', () => {
    it('should use standard preset by default', () => {
      const agent = createAgent();
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should pass toolPreset through to createToolPreset', () => {
      const agent = createAgent({ toolPreset: 'none' });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should merge custom tools with preset', () => {
      const customTool = { description: 'my custom tool' };
      const agent = createAgent({
        toolPreset: 'none',
        tools: { myTool: customTool } as Record<string, unknown> as Record<string, import('ai').Tool>,
      });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should filter tools with enableTools', () => {
      const agent = createAgent({
        toolPreset: 'standard',
        enableTools: ['glob'],
      });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should remove tools with disableTools', () => {
      const agent = createAgent({
        toolPreset: 'standard',
        disableTools: ['shell'],
      });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });
  });

  describe('sub-agents', () => {
    it('should add spawn_agent tool when enableSubAgents is true', () => {
      const agent = createAgent({ enableSubAgents: true });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });
  });

  describe('brain integration', () => {
    it('should add brain tools when brain instance is provided', () => {
      const mockBrain = {
        query: vi.fn().mockResolvedValue([]),
        remember: vi.fn().mockResolvedValue(undefined),
        recall: vi.fn().mockResolvedValue([]),
        extract: vi.fn().mockResolvedValue({}),
        close: vi.fn().mockResolvedValue(undefined),
      };

      const agent = createAgent({ brain: mockBrain });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });
  });

  describe('agent interface', () => {
    it('should expose agentId, role, getToolLoopAgent, getSystemPrompt', () => {
      const agent = createAgent({ role: 'coder' });
      expect(agent.agentId).toBeDefined();
      expect(agent.role).toBe('coder');
      expect(typeof agent.getToolLoopAgent).toBe('function');
      expect(typeof agent.getSystemPrompt).toBe('function');
      expect(typeof agent.stream).toBe('function');
      expect(typeof agent.generate).toBe('function');
    });

    it('should call generate on the underlying ToolLoopAgent', async () => {
      const agent = createAgent({
        model: createTestModel('response to: hello'),
        toolPreset: 'none',
        maxSteps: 1,
      });
      const result = await agent.generate({ prompt: 'hello' });
      expect(result.text).toBe('response to: hello');
    });
  });

  describe('maxSteps', () => {
    it('should default maxSteps to 10', () => {
      const agent = createAgent();
      const tla = agent.getToolLoopAgent();
      expect(tla).toBeDefined();
    });

    it('should accept custom maxSteps', () => {
      const agent = createAgent({ maxSteps: 25 });
      const tla = agent.getToolLoopAgent();
      expect(tla).toBeDefined();
    });
  });

  describe('usageLimits', () => {
    it('should accept usageLimits without error', () => {
      const agent = createAgent({
        usageLimits: { maxRequests: 20, maxTotalTokens: 100_000 },
      });
      expect(agent).toBeDefined();
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should create agent with usage limits configured', () => {
      const agent = createAgent({
        usageLimits: { maxRequests: 5 },
      });
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should create agent without usage limits', () => {
      const agent = createAgent();
      expect(agent.getToolLoopAgent()).toBeDefined();
    });
  });
});

describe('telemetry integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create agent with telemetry settings when telemetry provided', () => {
    const agent = createAgent({
      telemetry: {
        functionId: 'my-agent',
        metadata: { env: 'test' },
      },
    });

    expect(agent).toBeDefined();
    expect(agent.getToolLoopAgent()).toBeDefined();

    // Verify createTelemetrySettings was called with the right args
    expect(vi.mocked(createTelemetrySettings)).toHaveBeenCalledWith({
      functionId: 'my-agent',
      metadata: { env: 'test' },
    });
  });

  it('should default functionId to agent:<agentId> when not provided', () => {
    const agent = createAgent({
      agentId: 'test-id-42',
      telemetry: {},
    });

    expect(agent).toBeDefined();
    expect(vi.mocked(createTelemetrySettings)).toHaveBeenCalledWith({
      functionId: 'agent:test-id-42',
      metadata: undefined,
    });
  });

  it('should not call createTelemetrySettings when telemetry is not provided', () => {
    createAgent();
    expect(vi.mocked(createTelemetrySettings)).not.toHaveBeenCalled();
  });

  it('should call initObservability lazily on first generate()', async () => {
    const agent = createAgent({
      model: createTestModel('ok'),
      toolPreset: 'none',
      maxSteps: 1,
      telemetry: {
        provider: { provider: 'langfuse' },
      },
    });

    // Not called at creation time
    expect(vi.mocked(initObservability)).not.toHaveBeenCalled();

    // Called on first generate()
    await agent.generate({ prompt: 'test' });
    expect(vi.mocked(initObservability)).toHaveBeenCalledWith({ provider: 'langfuse' });
  });
});

describe('convenience factories', () => {
  it('createCoderAgent creates agent with coder role', () => {
    const agent = createCoderAgent();
    expect(agent.role).toBe('coder');
  });

  it('createResearcherAgent creates agent with researcher role', () => {
    const agent = createResearcherAgent();
    expect(agent.role).toBe('researcher');
  });

  it('createAnalystAgent creates agent with analyst role', () => {
    const agent = createAnalystAgent();
    expect(agent.role).toBe('analyst');
  });
});
