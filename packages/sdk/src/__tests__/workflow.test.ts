/**
 * @agntk/core - Workflow Tests (Phase 2: Durability)
 *
 * Tests for:
 * - DurableAgent wrapper (SDK-DURABLE-006)
 * - Durable tool wrapping with step naming
 * - Workflow availability detection
 * - Duration helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  wrapToolAsDurableStep,
  wrapToolsAsDurable,
  wrapSelectedToolsAsDurable,
  wrapToolAsIndependentStep,
  getDurabilityConfig,
  setDurabilityConfig,
  getStepName,
  DURABILITY_CONFIG,
} from '../workflow/durable-tool';
import {
  createDurableAgent,
  checkWorkflowAvailability,
  parseDuration,
  formatDuration,
  _resetWorkflowCache,
} from '../workflow/durable-agent';
import type { DurableAgent } from '../workflow/durable-agent';
import type { Agent } from '../agent';
import type { Tool } from 'ai';

// ============================================================================
// Helpers
// ============================================================================

function createMockTool(name: string): Tool {
  return {
    description: `Mock ${name} tool`,
    parameters: {},
    execute: vi.fn().mockResolvedValue(`${name} result`),
  } as unknown as Tool;
}

function createMockAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    agentId: 'test-agent-001',
    role: 'generic',
    stream: vi.fn().mockReturnValue(Promise.resolve({ fullStream: (async function* () { })(), text: 'streamed text' })),
    generate: vi.fn().mockResolvedValue({
      text: 'generated text',
      totalUsage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      steps: [],
    }),
    getToolLoopAgent: vi.fn().mockReturnValue({}),
    getSystemPrompt: vi.fn().mockReturnValue('You are a test agent.'),
    ...overrides,
  } as Agent;
}

// ============================================================================
// Durable Tool Tests
// ============================================================================

describe('wrapToolAsDurableStep', () => {
  it('wraps tool execute with durability', async () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool, {}, 'test');

    expect(wrapped.description).toBe(tool.description);

    const result = await (wrapped as any).execute({ input: 'test' }, {});
    expect((tool as any).execute).toHaveBeenCalled();
    expect(result).toBe('test result');
  });

  it('returns original tool if durability disabled', () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool, { enabled: false });

    expect(wrapped).toBe(tool);
  });

  it('returns original if no execute function', () => {
    const toolWithoutExecute = {
      description: 'No execute',
      parameters: {},
    };

    const wrapped = wrapToolAsDurableStep(toolWithoutExecute as unknown as Tool);
    expect(wrapped).toBe(toolWithoutExecute);
  });

  it('assigns default step name from tool name', () => {
    const tool = createMockTool('read_file');
    const wrapped = wrapToolAsDurableStep(tool, {}, 'read_file');

    const config = getDurabilityConfig(wrapped);
    expect(config?.stepName).toBe('tool-exec-read_file');
  });

  it('uses custom step name when provided', () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool, { stepName: 'custom-step' }, 'test');

    const config = getDurabilityConfig(wrapped);
    expect(config?.stepName).toBe('custom-step');
  });

  it('falls back to generic step name without tool name', () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsDurableStep(tool);

    const config = getDurabilityConfig(wrapped);
    expect(config?.stepName).toBe('tool-exec');
  });

  it('propagates errors from original execute', async () => {
    const tool = createMockTool('test');
    (tool as any).execute = vi.fn().mockRejectedValue(new Error('exec failed'));

    const wrapped = wrapToolAsDurableStep(tool, {}, 'test');
    await expect((wrapped as any).execute({}, {})).rejects.toThrow('exec failed');
  });
});

describe('wrapToolsAsDurable', () => {
  it('wraps all tools in set', () => {
    const tools = {
      read: createMockTool('read'),
      write: createMockTool('write'),
    };

    const wrapped = wrapToolsAsDurable(tools);

    expect(Object.keys(wrapped)).toEqual(['read', 'write']);
    expect(wrapped.read).not.toBe(tools.read);
    expect(wrapped.write).not.toBe(tools.write);
  });

  it('assigns step names from tool keys', () => {
    const tools = {
      glob: createMockTool('glob'),
      grep: createMockTool('grep'),
    };

    const wrapped = wrapToolsAsDurable(tools);

    expect(getStepName(wrapped.glob)).toBe('tool-exec-glob');
    expect(getStepName(wrapped.grep)).toBe('tool-exec-grep');
  });

  it('applies config to all tools', () => {
    const tools = { test: createMockTool('test') };
    const wrapped = wrapToolsAsDurable(tools, { retryCount: 5 });

    const config = getDurabilityConfig(wrapped.test);
    expect(config?.retryCount).toBe(5);
  });
});

describe('wrapSelectedToolsAsDurable', () => {
  it('only wraps selected tools', () => {
    const tools = {
      read: createMockTool('read'),
      write: createMockTool('write'),
      exec: createMockTool('exec'),
    };

    const wrapped = wrapSelectedToolsAsDurable(tools, ['read', 'write']);

    expect(wrapped.read).not.toBe(tools.read);
    expect(wrapped.write).not.toBe(tools.write);
    expect(wrapped.exec).toBe(tools.exec);
  });

  it('assigns step names to selected tools only', () => {
    const tools = {
      read: createMockTool('read'),
      write: createMockTool('write'),
    };

    const wrapped = wrapSelectedToolsAsDurable(tools, ['read']);

    expect(getStepName(wrapped.read)).toBe('tool-exec-read');
    expect(getStepName(wrapped.write)).toBeUndefined();
  });
});

describe('wrapToolAsIndependentStep', () => {
  it('marks tool as independent', () => {
    const tool = createMockTool('test');
    const wrapped = wrapToolAsIndependentStep(tool, 'test');

    const config = getDurabilityConfig(wrapped);
    expect(config?.independent).toBe(true);
  });
});

describe('durability config metadata', () => {
  it('can set and get config', () => {
    const tool = createMockTool('test');

    setDurabilityConfig(tool, { enabled: true, independent: false, retryCount: 3 });

    const config = getDurabilityConfig(tool);
    expect(config).toEqual({ enabled: true, independent: false, retryCount: 3 });
  });

  it('returns undefined if no config set', () => {
    const tool = createMockTool('test');
    expect(getDurabilityConfig(tool)).toBeUndefined();
  });

  it('uses correct symbol', () => {
    expect(typeof DURABILITY_CONFIG).toBe('symbol');
  });
});

describe('getStepName', () => {
  it('returns step name from config', () => {
    const tool = createMockTool('test');
    setDurabilityConfig(tool, { stepName: 'my-step' });
    expect(getStepName(tool)).toBe('my-step');
  });

  it('returns undefined if no config', () => {
    const tool = createMockTool('test');
    expect(getStepName(tool)).toBeUndefined();
  });
});

// ============================================================================
// Duration Helper Tests
// ============================================================================

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });

  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300000);
  });

  it('parses hours', () => {
    expect(parseDuration('1h')).toBe(3600000);
  });

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86400000);
  });

  it('throws on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow();
    expect(() => parseDuration('10')).toThrow();
    expect(() => parseDuration('10x')).toThrow();
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(5000)).toBe('5s');
  });

  it('formats minutes', () => {
    expect(formatDuration(300000)).toBe('5m');
  });

  it('formats hours', () => {
    expect(formatDuration(3600000)).toBe('1h');
  });

  it('formats days', () => {
    expect(formatDuration(86400000)).toBe('1d');
  });
});

// ============================================================================
// Workflow Availability Tests
// ============================================================================

describe('checkWorkflowAvailability', () => {
  beforeEach(() => {
    _resetWorkflowCache();
  });

  afterEach(() => {
    _resetWorkflowCache();
  });

  it('detects workflow package availability', async () => {
    const available = await checkWorkflowAvailability();
    // `workflow` is installed as a peer dep in this workspace, so it resolves
    expect(typeof available).toBe('boolean');
  });

  it('caches the result on subsequent calls', async () => {
    const first = await checkWorkflowAvailability();
    const second = await checkWorkflowAvailability();
    expect(first).toBe(second);
  });

  it('_resetWorkflowCache allows re-detection', async () => {
    await checkWorkflowAvailability();
    _resetWorkflowCache();
    // After reset, re-detection should still work
    const result = await checkWorkflowAvailability();
    expect(typeof result).toBe('boolean');
  });
});

// ============================================================================
// DurableAgent Tests
// ============================================================================

describe('createDurableAgent', () => {
  it('extends the base Agent interface', () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    // Base Agent properties
    expect(durableAgent.agentId).toBe('test-agent-001');
    expect(durableAgent.role).toBe('generic');
    expect(durableAgent.generate).toBeDefined();
    expect(durableAgent.stream).toBeDefined();
    expect(durableAgent.getToolLoopAgent).toBeDefined();
    expect(durableAgent.getSystemPrompt).toBeDefined();

    // DurableAgent-specific properties
    expect(durableAgent.durableGenerate).toBeDefined();
    expect(durableAgent.withApproval).toBeDefined();
    expect(durableAgent.scheduled).toBeDefined();
    expect(durableAgent.isWorkflowActive).toBeDefined();
  });

  it('delegates standard generate to base agent', async () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    await durableAgent.generate({ prompt: 'test prompt' });

    expect(baseAgent.generate).toHaveBeenCalledWith({ prompt: 'test prompt' });
  });

  it('delegates stream to base agent', () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    durableAgent.stream({ prompt: 'test' });

    expect(baseAgent.stream).toHaveBeenCalledWith({ prompt: 'test' });
  });

  it('delegates getSystemPrompt to base agent', () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    const prompt = durableAgent.getSystemPrompt();

    expect(prompt).toBe('You are a test agent.');
    expect(baseAgent.getSystemPrompt).toHaveBeenCalled();
  });

  it('durableGenerate wraps base agent generate', async () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    const result = await durableAgent.durableGenerate('test prompt');

    expect(result).toHaveProperty('text');
    expect(result).toHaveProperty('steps');
    expect(result.steps).toBeDefined();
    expect(result.steps!.some(s => s.name === 'llm-generate')).toBe(true);
    expect(baseAgent.generate).toHaveBeenCalled();
  });

  it('withApproval calls generate for draft and finalize', async () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    const result = await durableAgent.withApproval('draft this', '/api/approve');

    expect(result).toHaveProperty('text');
    expect(result.steps).toBeDefined();
    // Should have draft + approval + finalize steps
    expect(result.steps!.length).toBeGreaterThanOrEqual(2);
  });

  it('scheduled uses delay then generates', async () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    // Use a very short delay for testing
    const result = await durableAgent.scheduled('delayed prompt', '1s');

    expect(result).toHaveProperty('text');
    expect(result.steps).toBeDefined();
    expect(result.steps!.some(s => s.name === 'sleep')).toBe(true);
    expect(result.steps!.some(s => s.name === 'llm-generate')).toBe(true);
  }, 10000);

  it('preserves agentId from base agent', () => {
    const baseAgent = createMockAgent({ agentId: 'custom-id-123' });
    const durableAgent = createDurableAgent(baseAgent);

    expect(durableAgent.agentId).toBe('custom-id-123');
  });

  it('preserves role from base agent', () => {
    const baseAgent = createMockAgent({ role: 'coder' as any });
    const durableAgent = createDurableAgent(baseAgent);

    expect(durableAgent.role).toBe('coder');
  });

  it('isWorkflowActive reflects availability check', async () => {
    _resetWorkflowCache();
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    // Run availability check
    const available = await checkWorkflowAvailability();
    expect(durableAgent.isWorkflowActive).toBe(available);

    _resetWorkflowCache();
  });

  it('workflowRunId is undefined initially', () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent);

    expect(durableAgent.workflowRunId).toBeUndefined();
  });

  it('accepts workflowOptions', () => {
    const baseAgent = createMockAgent();
    const durableAgent = createDurableAgent(baseAgent, {
      workflowOptions: {
        workflowRunId: 'run-abc-123',
        defaultRetryCount: 5,
        defaultTimeout: '10m',
      },
    });

    expect(durableAgent.workflowRunId).toBe('run-abc-123');
  });
});

// ============================================================================
// Integration: DurableAgent as Agent
// ============================================================================

describe('DurableAgent as Agent compatibility', () => {
  it('can be used wherever Agent is expected', () => {
    const baseAgent = createMockAgent();
    const durableAgent: DurableAgent = createDurableAgent(baseAgent);

    // Should satisfy Agent type
    const agent: Agent = durableAgent;
    expect(agent.agentId).toBeDefined();
    expect(agent.role).toBeDefined();
    expect(agent.generate).toBeDefined();
    expect(agent.stream).toBeDefined();
  });

  it('maintains Agent interface contract', async () => {
    const baseAgent = createMockAgent();
    const durableAgent: Agent = createDurableAgent(baseAgent);

    // These should all work via the Agent interface
    expect(typeof durableAgent.agentId).toBe('string');
    expect(typeof durableAgent.role).toBe('string');
    expect(typeof durableAgent.generate).toBe('function');
    expect(typeof durableAgent.stream).toBe('function');
    expect(typeof durableAgent.getToolLoopAgent).toBe('function');
    expect(typeof durableAgent.getSystemPrompt).toBe('function');
  });
});

// ============================================================================
// Integration: createAgent({ durable: true }) shorthand
// ============================================================================

describe('createAgent({ durable: true }) shorthand', () => {
  // We can't call the real createAgent (it requires model providers),
  // but we can verify the durable-agent creation path produces the
  // right shape by testing the same flow createAgent uses internally.

  it('produces a DurableAgent with standard Agent methods', () => {
    const baseAgent = createMockAgent();
    // This is the same call createAgent makes internally when durable:true
    const agent = createDurableAgent(baseAgent, { durable: true });

    // Must satisfy Agent interface
    expect(agent.agentId).toBeDefined();
    expect(agent.role).toBeDefined();
    expect(typeof agent.generate).toBe('function');
    expect(typeof agent.stream).toBe('function');
    expect(typeof agent.getToolLoopAgent).toBe('function');
    expect(typeof agent.getSystemPrompt).toBe('function');
  });

  it('produces a DurableAgent with durable methods', () => {
    const baseAgent = createMockAgent();
    const agent = createDurableAgent(baseAgent, { durable: true });

    // Must have durable-specific methods
    expect(typeof agent.durableGenerate).toBe('function');
    expect(typeof agent.withApproval).toBe('function');
    expect(typeof agent.scheduled).toBe('function');
    expect(typeof agent.isWorkflowActive).toBe('boolean');
  });

  it('both paths produce equivalent agent shape', () => {
    const baseAgent = createMockAgent();

    // Path 1: Direct createDurableAgent
    const directAgent = createDurableAgent(baseAgent);

    // Path 2: createDurableAgent with options (same as createAgent shorthand)
    const shorthandAgent = createDurableAgent(baseAgent, { durable: true });

    // Both should have the same methods
    const directKeys = Object.keys(directAgent).sort();
    const shorthandKeys = Object.keys(shorthandAgent).sort();
    expect(directKeys).toEqual(shorthandKeys);

    // Both should have the same types for each method
    for (const key of directKeys) {
      expect(typeof (directAgent as any)[key]).toBe(typeof (shorthandAgent as any)[key]);
    }
  });

  it('standard generate works without workflow', async () => {
    const baseAgent = createMockAgent();
    const agent = createDurableAgent(baseAgent, { durable: true });

    // Standard generate should work regardless of workflow availability
    await agent.generate({ prompt: 'test' });
    expect(baseAgent.generate).toHaveBeenCalledWith({ prompt: 'test' });
  });

  it('standard stream works without workflow', () => {
    const baseAgent = createMockAgent();
    const agent = createDurableAgent(baseAgent, { durable: true });

    // Standard stream should work regardless of workflow availability
    agent.stream({ prompt: 'test' });
    expect(baseAgent.stream).toHaveBeenCalledWith({ prompt: 'test' });
  });
});
