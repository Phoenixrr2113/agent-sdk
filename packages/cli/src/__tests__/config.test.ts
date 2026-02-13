import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectApiKey } from '../config';

describe('detectApiKey', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('detects OPENROUTER_API_KEY', () => {
    process.env['OPENROUTER_API_KEY'] = 'sk-or-test';
    const result = detectApiKey();
    expect(result).toEqual({ provider: 'openrouter', apiKey: 'sk-or-test' });
  });

  it('detects OPENAI_API_KEY', () => {
    process.env['OPENAI_API_KEY'] = 'sk-openai-test';
    const result = detectApiKey();
    expect(result).toEqual({ provider: 'openai', apiKey: 'sk-openai-test' });
  });

  it('prefers OPENROUTER over OPENAI when both set', () => {
    process.env['OPENROUTER_API_KEY'] = 'sk-or';
    process.env['OPENAI_API_KEY'] = 'sk-oai';
    const result = detectApiKey();
    expect(result?.provider).toBe('openrouter');
  });

  it('returns null when no API keys are set', () => {
    delete process.env['OPENAI_API_KEY'];
    delete process.env['OPENROUTER_API_KEY'];
    const result = detectApiKey();
    expect(result).toBeNull();
  });

  it('ignores empty API keys', () => {
    process.env['OPENROUTER_API_KEY'] = '';
    const result = detectApiKey();
    expect(result).toBeNull();
  });
});
