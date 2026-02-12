import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PassThrough, Writable } from 'node:stream';
import { runRepl, type ReplOptions } from '../repl';
import type { ResolvedCLIConfig } from '../config';
import type { EnvironmentContext } from '../environment';

// Helper to create a mock StreamTextResult
function createMockStreamResult(prompt: string) {
  const lastLine = prompt.split('\n').pop()?.replace('User: ', '') ?? prompt;
  const responseText = `REPL response to: ${lastLine}`;
  return {
    fullStream: (async function* () {
      yield { type: 'text-delta' as const, text: responseText };
    })(),
    text: Promise.resolve(responseText),
    steps: Promise.resolve([{ toolCalls: [], toolResults: [] }]),
    totalUsage: Promise.resolve({ inputTokens: 50, outputTokens: 25, totalTokens: 75 }),
  };
}

// Mock @agntk/core
vi.mock('@agntk/core', () => ({
  createAgent: vi.fn(() => ({
    agentId: 'repl-agent-123',
    role: 'generic',
    generate: vi.fn(),
    stream: vi.fn(async ({ prompt }: { prompt: string }) => createMockStreamResult(prompt)),
    getToolLoopAgent: vi.fn(),
    getSystemPrompt: vi.fn(() => 'test prompt'),
  })),
}));

function makeConfig(overrides: Partial<ResolvedCLIConfig> = {}): ResolvedCLIConfig {
  return {
    prompt: null,
    interactive: true,
    role: 'generic',
    model: null,
    provider: 'anthropic',
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

function makeEnvironment(): EnvironmentContext {
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
    availableCommands: ['git', 'node'],
  };
}

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

/**
 * Helper to simulate REPL interaction.
 * Sends lines with small delays, then closes the input.
 */
function simulateInput(lines: string[]): PassThrough {
  const input = new PassThrough();

  // Send lines with small delays to simulate typing
  let i = 0;
  const sendNext = () => {
    if (i < lines.length) {
      input.write(lines[i] + '\n');
      i++;
      setTimeout(sendNext, 10);
    } else {
      // Close after last line
      setTimeout(() => input.end(), 20);
    }
  };
  setTimeout(sendNext, 10);

  return input;
}

describe('runRepl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns error when no API key', async () => {
    const capture = createCapture();
    const input = simulateInput(['/exit']);

    const result = await runRepl({
      config: makeConfig({ apiKey: null }),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No API key');
    expect(capture.output()).toContain('No API key found');
  });

  it('prints welcome banner', async () => {
    const capture = createCapture();
    const input = simulateInput(['/exit']);

    await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    const out = capture.output();
    expect(out).toContain('agntk v');
    expect(out).toContain('interactive mode');
    expect(out).toContain('Role: generic');
  });

  it('handles /exit command', async () => {
    const capture = createCapture();
    const input = simulateInput(['/exit']);

    const result = await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(result.success).toBe(true);
    expect(result.exchanges).toBe(0);
    expect(capture.output()).toContain('Goodbye!');
  });

  it('handles /help command', async () => {
    const capture = createCapture();
    const input = simulateInput(['/help', '/exit']);

    await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    const out = capture.output();
    expect(out).toContain('Available commands');
    expect(out).toContain('/help');
    expect(out).toContain('/clear');
    expect(out).toContain('/exit');
  });

  it('handles /role command', async () => {
    const capture = createCapture();
    const input = simulateInput(['/role', '/exit']);

    await runRepl({
      config: makeConfig({ role: 'coder' }),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(capture.output()).toContain('Current role: coder');
  });

  it('handles /env command', async () => {
    const capture = createCapture();
    const input = simulateInput(['/env', '/exit']);

    await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    const out = capture.output();
    expect(out).toContain('## Environment');
    expect(out).toContain('OS: macos');
  });

  it('sends prompt to agent and displays response', async () => {
    const capture = createCapture();
    const input = simulateInput(['hello agent', '/exit']);

    const result = await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(result.exchanges).toBe(1);
    expect(capture.output()).toContain('REPL response to: hello agent');
  });

  it('handles /clear command to reset history', async () => {
    const capture = createCapture();
    const input = simulateInput(['hello', '/clear', '/exit']);

    const result = await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(capture.output()).toContain('Conversation cleared');
    expect(result.exchanges).toBe(1);
  });

  it('ignores empty lines', async () => {
    const capture = createCapture();
    const input = simulateInput(['', '', '/exit']);

    const result = await runRepl({
      config: makeConfig(),
      environment: makeEnvironment(),
      input,
      output: capture.stream,
    });

    expect(result.exchanges).toBe(0);
  });
});
