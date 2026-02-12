import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import { runOneShot, type RunOptions } from '../runner';
import type { ResolvedCLIConfig } from '../config';
import type { EnvironmentContext } from '../environment';

// Helper to create a mock StreamTextResult
function createMockStreamResult(prompt: string) {
  const responseText = `Response to: ${prompt}`;
  return {
    fullStream: (async function* () {
      yield { type: 'text-delta' as const, text: responseText };
    })(),
    text: Promise.resolve(responseText),
    steps: Promise.resolve([{ toolCalls: [], toolResults: [] }]),
    totalUsage: Promise.resolve({ inputTokens: 100, outputTokens: 50, totalTokens: 150 }),
  };
}

// Mock @agntk/core
vi.mock('@agntk/core', () => ({
  createAgent: vi.fn(() => ({
    agentId: 'test-agent-123',
    role: 'generic',
    generate: vi.fn(),
    stream: vi.fn(async ({ prompt }: { prompt: string }) => createMockStreamResult(prompt)),
    getToolLoopAgent: vi.fn(),
    getSystemPrompt: vi.fn(() => 'test prompt'),
  })),
}));

// Helper to create a test writable stream that captures output
function createCapture(): { stream: Writable; output: () => string } {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    output: () => chunks.join(''),
  };
}

function makeConfig(overrides: Partial<ResolvedCLIConfig> = {}): ResolvedCLIConfig {
  return {
    prompt: 'test prompt',
    interactive: false,
    role: 'generic',
    model: null,
    provider: 'openrouter',
    apiKey: 'sk-test-key',
    memory: false,
    init: false,
    toolPreset: 'standard',
    workspace: '/tmp/test',
    dryRun: false,
    verbose: false,
    maxSteps: 10,
    configPath: null,
    ...overrides,
  };
}

function makeEnvironment(overrides: Partial<EnvironmentContext> = {}): EnvironmentContext {
  return {
    os: 'macos',
    shell: 'zsh',
    projectType: 'node',
    packageManager: 'pnpm',
    isGitRepo: true,
    isTTY: true,
    isCI: false,
    isDocker: false,
    nodeVersion: 'v20.0.0',
    availableCommands: ['git', 'node', 'pnpm'],
    ...overrides,
  };
}

describe('runOneShot', () => {
  it('returns error when no prompt provided', async () => {
    const result = await runOneShot('', {
      config: makeConfig(),
      environment: makeEnvironment(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No prompt provided');
  });

  it('returns error when no API key', async () => {
    const result = await runOneShot('test prompt', {
      config: makeConfig({ apiKey: null }),
      environment: makeEnvironment(),
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No API key found');
  });

  it('runs agent and writes output', async () => {
    const capture = createCapture();
    const statusCapture = createCapture();

    const result = await runOneShot('hello world', {
      config: makeConfig(),
      environment: makeEnvironment(),
      output: capture.stream,
      statusOutput: statusCapture.stream,
    });

    expect(result.success).toBe(true);
    expect(result.text).toContain('Response to: hello world');
    expect(result.steps).toBe(1);
    expect(capture.output()).toContain('Response to: hello world');
  });

  it('shows verbose output when enabled', async () => {
    const capture = createCapture();
    const statusCapture = createCapture();

    await runOneShot('hello world', {
      config: makeConfig({ verbose: true }),
      environment: makeEnvironment(),
      output: capture.stream,
      statusOutput: statusCapture.stream,
    });

    const status = statusCapture.output();
    expect(status).toContain('[agntk] Role: generic');
    expect(status).toContain('[agntk] Provider: openrouter');
    expect(status).toContain('[agntk] Agent created');
    expect(status).toContain('[agntk] Completed in 1 step(s)');
  });

  it('dry-run shows config without executing', async () => {
    const capture = createCapture();

    const result = await runOneShot('hello world', {
      config: makeConfig({ dryRun: true }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toBe(0);
    const output = capture.output();
    expect(output).toContain('[dry-run]');
    expect(output).toContain('Role: generic');
    expect(output).toContain('Prompt: "hello world"');
  });

  it('dry-run works without API key', async () => {
    const capture = createCapture();

    const result = await runOneShot('hello world', {
      config: makeConfig({ dryRun: true, apiKey: null }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(result.success).toBe(true);
    expect(result.steps).toBe(0);
    expect(capture.output()).toContain('[dry-run]');
  });

  it('handles agent errors gracefully', async () => {
    const { createAgent } = await import('@agntk/core');
    vi.mocked(createAgent).mockReturnValueOnce({
      agentId: 'test-err',
      role: 'generic' as const,
      generate: vi.fn(),
      stream: vi.fn(async () => {
        throw new Error('Model rate limited');
      }),
      getToolLoopAgent: vi.fn(),
      getSystemPrompt: vi.fn(() => ''),
    } as any);

    const capture = createCapture();
    const statusCapture = createCapture();

    const result = await runOneShot('test', {
      config: makeConfig(),
      environment: makeEnvironment(),
      output: capture.stream,
      statusOutput: statusCapture.stream,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Model rate limited');
  });

  it('passes model and provider to agent options', async () => {
    const { createAgent } = await import('@agntk/core');
    const capture = createCapture();

    await runOneShot('test', {
      config: makeConfig({
        model: 'anthropic/claude-sonnet-4',
        provider: 'openrouter',
      }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        modelProvider: 'openrouter',
        modelName: 'anthropic/claude-sonnet-4',
      }),
    );
  });

  it('passes workspace as workspaceRoot', async () => {
    const { createAgent } = await import('@agntk/core');
    const capture = createCapture();

    await runOneShot('test', {
      config: makeConfig({ workspace: '/my/project' }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceRoot: '/my/project',
      }),
    );
  });

  it('passes maxSteps to agent options', async () => {
    const { createAgent } = await import('@agntk/core');
    const capture = createCapture();

    await runOneShot('test', {
      config: makeConfig({ maxSteps: 25 }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        maxSteps: 25,
      }),
    );
  });

  it('passes role to agent options', async () => {
    const { createAgent } = await import('@agntk/core');
    const capture = createCapture();

    await runOneShot('test', {
      config: makeConfig({ role: 'coder' }),
      environment: makeEnvironment(),
      output: capture.stream,
    });

    expect(createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'coder',
      }),
    );
  });
});
