import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectApiKey, loadDotenvFallback } from '../config';
import { existsSync, readFileSync } from 'node:fs';

// Mock node:fs to control file existence and content
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  };
});

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

describe('loadDotenvFallback', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Reset the module-level loaded flag by re-importing
    vi.resetModules();
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(readFileSync).mockReturnValue('');
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('loads API key from ~/.agntk/.env when not in env', async () => {
    delete process.env['OPENROUTER_API_KEY'];

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('OPENROUTER_API_KEY=sk-or-from-file\n');

    // Fresh import to reset the loaded flag
    const { loadDotenvFallback: freshLoad, detectApiKey: freshDetect } = await import('../config');
    freshLoad();

    expect(process.env['OPENROUTER_API_KEY']).toBe('sk-or-from-file');
    const result = freshDetect();
    expect(result).toEqual({ provider: 'openrouter', apiKey: 'sk-or-from-file' });
  });

  it('does not override existing env vars', async () => {
    process.env['OPENROUTER_API_KEY'] = 'sk-or-from-export';

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue('OPENROUTER_API_KEY=sk-or-from-file\n');

    const { loadDotenvFallback: freshLoad } = await import('../config');
    freshLoad();

    expect(process.env['OPENROUTER_API_KEY']).toBe('sk-or-from-export');
  });

  it('skips comments and blank lines', async () => {
    delete process.env['OPENROUTER_API_KEY'];

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(
      '# Comment line\n\nOPENROUTER_API_KEY=sk-or-parsed\n',
    );

    const { loadDotenvFallback: freshLoad } = await import('../config');
    freshLoad();

    expect(process.env['OPENROUTER_API_KEY']).toBe('sk-or-parsed');
  });
});
