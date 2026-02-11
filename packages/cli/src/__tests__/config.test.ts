import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveConfig, detectApiKey } from '../config';
import type { ParsedArgs } from '../args';

function makeArgs(overrides: Partial<ParsedArgs> = {}): ParsedArgs {
  return {
    prompt: null,
    interactive: false,
    role: null,
    model: null,
    memory: false,
    init: false,
    tools: null,
    workspace: null,
    dryRun: false,
    verbose: false,
    config: null,
    maxSteps: null,
    version: false,
    help: false,
    ...overrides,
  };
}

describe('detectApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('detects ANTHROPIC_API_KEY', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant-test';
    const result = detectApiKey();
    expect(result).toEqual({ provider: 'anthropic', apiKey: 'sk-ant-test' });
  });

  it('detects OPENAI_API_KEY', () => {
    process.env['OPENAI_API_KEY'] = 'sk-openai-test';
    const result = detectApiKey();
    expect(result).toEqual({ provider: 'openai', apiKey: 'sk-openai-test' });
  });

  it('prefers ANTHROPIC over OPENAI when both set', () => {
    process.env['ANTHROPIC_API_KEY'] = 'sk-ant';
    process.env['OPENAI_API_KEY'] = 'sk-oai';
    const result = detectApiKey();
    expect(result?.provider).toBe('anthropic');
  });

  it('returns null when no API keys are set', () => {
    delete process.env['ANTHROPIC_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    delete process.env['OPENROUTER_API_KEY'];
    delete process.env['GOOGLE_API_KEY'];
    const result = detectApiKey();
    expect(result).toBeNull();
  });

  it('ignores empty API keys', () => {
    process.env['ANTHROPIC_API_KEY'] = '';
    const result = detectApiKey();
    expect(result).toBeNull();
  });
});

describe('resolveConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env['ANTHROPIC_API_KEY'] = 'sk-test';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves defaults when no args given', () => {
    const config = resolveConfig(makeArgs());
    expect(config.role).toBe('generic');
    expect(config.toolPreset).toBe('standard');
    expect(config.maxSteps).toBe(10);
    expect(config.memory).toBe(false);
    expect(config.interactive).toBe(false);
    expect(config.dryRun).toBe(false);
  });

  it('CLI flags override defaults', () => {
    const config = resolveConfig(makeArgs({
      role: 'coder',
      memory: true,
      maxSteps: 25,
      tools: 'full',
    }));
    expect(config.role).toBe('coder');
    expect(config.memory).toBe(true);
    expect(config.maxSteps).toBe(25);
    expect(config.toolPreset).toBe('full');
  });

  it('parses provider:model format', () => {
    const config = resolveConfig(makeArgs({
      model: 'anthropic:claude-sonnet-4',
    }));
    expect(config.provider).toBe('anthropic');
    expect(config.model).toBe('claude-sonnet-4');
  });

  it('detects API key from env', () => {
    const config = resolveConfig(makeArgs());
    expect(config.apiKey).toBe('sk-test');
    expect(config.provider).toBe('anthropic');
  });

  it('uses cwd as default workspace', () => {
    const config = resolveConfig(makeArgs());
    expect(config.workspace).toBe(process.cwd());
  });

  it('respects --workspace flag', () => {
    const config = resolveConfig(makeArgs({
      workspace: '/tmp/test',
    }));
    expect(config.workspace).toBe('/tmp/test');
  });
});
