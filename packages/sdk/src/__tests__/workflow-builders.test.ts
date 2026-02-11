/**
 * @fileoverview Tests for createPipeline and createParallel workflow builders.
 */

import { describe, it, expect, vi } from 'vitest';
import type { Agent } from '../agent';

vi.mock('@agntk/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(() => vi.fn()),
  }),
}));

import { createPipeline } from '../workflow/builders/pipeline';
import { createParallel } from '../workflow/builders/parallel';
import { asStep } from '../workflow/builders/adapt';
import type { WorkflowStep, WorkflowOutput } from '../workflow/builders/types';

// ============================================================================
// Helpers
// ============================================================================

function createMockStep(transform: (prompt: string) => string): WorkflowStep {
  return {
    execute: vi.fn().mockImplementation(async ({ prompt }) => ({
      text: transform(prompt),
    })),
  };
}

function createMockAgent(textFn: (prompt: string) => string = () => 'agent output'): Agent {
  return {
    agentId: 'test-agent',
    role: 'generic',
    stream: vi.fn(),
    generate: vi.fn().mockImplementation(async ({ prompt }: { prompt: string }) => ({
      text: textFn(prompt),
      steps: [],
      totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    })),
    getToolLoopAgent: vi.fn(),
    getSystemPrompt: () => 'test prompt',
  } as unknown as Agent;
}

// ============================================================================
// createPipeline
// ============================================================================

describe('createPipeline', () => {
  it('should chain 2 steps sequentially', async () => {
    const step1 = createMockStep((p) => `[step1:${p}]`);
    const step2 = createMockStep((p) => `[step2:${p}]`);

    const pipeline = createPipeline({
      name: 'test-pipeline',
      steps: [step1, step2],
    });

    const result = await pipeline.execute({ prompt: 'hello' });

    expect(result.text).toBe('[step2:[step1:hello]]');
    expect(step1.execute).toHaveBeenCalledWith({ prompt: 'hello' });
    expect(step2.execute).toHaveBeenCalledWith({ prompt: '[step1:hello]' });
  });

  it('should chain 3 steps sequentially', async () => {
    const step1 = createMockStep((p) => `A(${p})`);
    const step2 = createMockStep((p) => `B(${p})`);
    const step3 = createMockStep((p) => `C(${p})`);

    const pipeline = createPipeline({
      steps: [step1, step2, step3],
    });

    const result = await pipeline.execute({ prompt: 'x' });

    expect(result.text).toBe('C(B(A(x)))');
  });

  it('should support custom transform between steps', async () => {
    const step1 = createMockStep(() => 'raw data');
    const step2 = createMockStep((p) => `processed: ${p}`);

    const pipeline = createPipeline({
      steps: [step1, step2],
      transform: (output, stepIndex) => `[context ${stepIndex}] ${output.text}`,
    });

    const result = await pipeline.execute({ prompt: 'query' });

    expect(result.text).toBe('processed: [context 1] raw data');
  });

  it('should throw for empty steps', () => {
    expect(() => createPipeline({ steps: [] })).toThrow('at least one step');
  });

  it('should have correct name and stepCount', () => {
    const pipeline = createPipeline({
      name: 'my-pipeline',
      steps: [createMockStep(() => ''), createMockStep(() => '')],
    });

    expect(pipeline.name).toBe('my-pipeline');
    expect(pipeline.stepCount).toBe(2);
  });

  it('should work with a single step', async () => {
    const step = createMockStep((p) => `only:${p}`);
    const pipeline = createPipeline({ steps: [step] });

    const result = await pipeline.execute({ prompt: 'input' });
    expect(result.text).toBe('only:input');
  });
});

// ============================================================================
// createParallel
// ============================================================================

describe('createParallel', () => {
  it('should fan out to 3 steps concurrently', async () => {
    const order: number[] = [];

    const step1: WorkflowStep = {
      execute: vi.fn().mockImplementation(async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 30));
        return { text: 'A' };
      }),
    };
    const step2: WorkflowStep = {
      execute: vi.fn().mockImplementation(async () => {
        order.push(2);
        await new Promise((r) => setTimeout(r, 30));
        return { text: 'B' };
      }),
    };
    const step3: WorkflowStep = {
      execute: vi.fn().mockImplementation(async () => {
        order.push(3);
        await new Promise((r) => setTimeout(r, 30));
        return { text: 'C' };
      }),
    };

    const parallel = createParallel({
      name: 'test-parallel',
      steps: [step1, step2, step3],
      synthesize: (outputs) => ({
        text: outputs.map((o) => o.text).join(', '),
      }),
    });

    const result = await parallel.execute({ prompt: 'analyze' });

    // All 3 should have started
    expect(order).toEqual([1, 2, 3]);
    expect(result.text).toBe('A, B, C');
    // All steps should receive the same input
    expect(step1.execute).toHaveBeenCalledWith({ prompt: 'analyze' });
    expect(step2.execute).toHaveBeenCalledWith({ prompt: 'analyze' });
    expect(step3.execute).toHaveBeenCalledWith({ prompt: 'analyze' });
  });

  it('should use custom synthesize function', async () => {
    const step1 = createMockStep(() => 'security: OK');
    const step2 = createMockStep(() => 'performance: WARN');

    const parallel = createParallel({
      steps: [step1, step2],
      synthesize: (outputs) => ({
        text: `Report:\n${outputs.map((o) => `- ${o.text}`).join('\n')}`,
      }),
    });

    const result = await parallel.execute({ prompt: 'check' });

    expect(result.text).toBe('Report:\n- security: OK\n- performance: WARN');
  });

  it('should handle step failures gracefully', async () => {
    const step1 = createMockStep(() => 'success');
    const step2: WorkflowStep = {
      execute: vi.fn().mockRejectedValue(new Error('step crashed')),
    };

    const parallel = createParallel({
      steps: [step1, step2],
      synthesize: (outputs) => ({
        text: outputs.map((o) => o.text).join(' | '),
      }),
    });

    const result = await parallel.execute({ prompt: 'test' });

    expect(result.text).toContain('success');
    expect(result.text).toContain('failed');
    expect(result.text).toContain('step crashed');
  });

  it('should throw for empty steps', () => {
    expect(() =>
      createParallel({ steps: [], synthesize: () => ({ text: '' }) }),
    ).toThrow('at least one step');
  });

  it('should have correct name and stepCount', () => {
    const parallel = createParallel({
      name: 'my-parallel',
      steps: [createMockStep(() => ''), createMockStep(() => '')],
      synthesize: () => ({ text: '' }),
    });

    expect(parallel.name).toBe('my-parallel');
    expect(parallel.stepCount).toBe(2);
  });
});

// ============================================================================
// asStep (Agent → WorkflowStep adapter)
// ============================================================================

describe('asStep', () => {
  it('should adapt an agent to a WorkflowStep', async () => {
    const agent = createMockAgent((p) => `agent says: ${p}`);
    const step = asStep(agent);

    const result = await step.execute({ prompt: 'hello' });

    expect(result.text).toBe('agent says: hello');
    expect(result.metadata?.agentId).toBe('test-agent');
    expect(result.metadata?.role).toBe('generic');
  });

  it('should work inside a pipeline', async () => {
    const agent1 = createMockAgent((p) => `researched: ${p}`);
    const agent2 = createMockAgent((p) => `written: ${p}`);

    const pipeline = createPipeline({
      steps: [asStep(agent1), asStep(agent2)],
    });

    const result = await pipeline.execute({ prompt: 'quantum computing' });

    expect(result.text).toBe('written: researched: quantum computing');
  });

  it('should work inside a parallel', async () => {
    const agent1 = createMockAgent(() => 'security: OK');
    const agent2 = createMockAgent(() => 'performance: OK');

    const parallel = createParallel({
      steps: [asStep(agent1), asStep(agent2)],
      synthesize: (outputs) => ({
        text: outputs.map((o) => o.text).join('\n'),
      }),
    });

    const result = await parallel.execute({ prompt: 'analyze' });

    expect(result.text).toBe('security: OK\nperformance: OK');
  });
});

// ============================================================================
// Composition (nesting)
// ============================================================================

describe('workflow composition', () => {
  it('should nest a parallel inside a pipeline', async () => {
    const research = createMockStep((p) => `research on: ${p}`);

    const analysis = createParallel({
      name: 'analysis',
      steps: [
        createMockStep((p) => `security of ${p}`),
        createMockStep((p) => `performance of ${p}`),
      ],
      synthesize: (outputs) => ({
        text: outputs.map((o) => o.text).join(' + '),
      }),
    });

    const summary = createMockStep((p) => `SUMMARY: ${p}`);

    const pipeline = createPipeline({
      name: 'research-analyze-summarize',
      steps: [research, analysis, summary],
    });

    const result = await pipeline.execute({ prompt: 'topic' });

    expect(result.text).toBe(
      'SUMMARY: security of research on: topic + performance of research on: topic',
    );
  });

  it('should nest a pipeline inside a parallel', async () => {
    const pipeline1 = createPipeline({
      steps: [
        createMockStep((p) => `A(${p})`),
        createMockStep((p) => `B(${p})`),
      ],
    });

    const pipeline2 = createPipeline({
      steps: [
        createMockStep((p) => `X(${p})`),
        createMockStep((p) => `Y(${p})`),
      ],
    });

    const parallel = createParallel({
      steps: [pipeline1, pipeline2],
      synthesize: (outputs) => ({
        text: outputs.map((o) => o.text).join(' AND '),
      }),
    });

    const result = await parallel.execute({ prompt: 'input' });

    expect(result.text).toBe('B(A(input)) AND Y(X(input))');
  });
});
