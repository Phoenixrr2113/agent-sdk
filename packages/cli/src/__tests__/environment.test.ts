import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectEnvironment, formatEnvironmentPrompt, type EnvironmentContext } from '../environment';
import { existsSync } from 'node:fs';

// We mock existsSync to control what files appear to exist
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => false),
  };
});

// Mock child_process to avoid actually running commands in tests
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('not found');
  }),
}));

describe('detectEnvironment', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('detects OS from process.platform', () => {
    const ctx = detectEnvironment('/tmp/test');
    // On macOS, should be 'macos'
    // We can't easily mock process.platform, but we can verify the shape
    expect(['macos', 'linux', 'windows', 'unknown']).toContain(ctx.os);
  });

  it('detects shell from SHELL env var', () => {
    process.env['SHELL'] = '/bin/zsh';
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.shell).toBe('zsh');
  });

  it('detects project type from package.json', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('package.json');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.projectType).toBe('node');
  });

  it('detects Rust project type', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('Cargo.toml');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.projectType).toBe('rust');
  });

  it('detects Python project type', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('pyproject.toml');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.projectType).toBe('python');
  });

  it('detects package manager from lock files', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('pnpm-lock.yaml');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.packageManager).toBe('pnpm');
  });

  it('detects npm from package-lock.json', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('package-lock.json');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.packageManager).toBe('npm');
  });

  it('detects git repo from .git directory', () => {
    vi.mocked(existsSync).mockImplementation((path) => {
      return String(path).endsWith('.git');
    });
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.isGitRepo).toBe(true);
  });

  it('reports no git repo when .git missing', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.isGitRepo).toBe(false);
  });

  it('detects CI environment', () => {
    process.env['CI'] = 'true';
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.isCI).toBe(true);
  });

  it('detects GitHub Actions', () => {
    process.env['GITHUB_ACTIONS'] = 'true';
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.isCI).toBe(true);
  });

  it('reports no CI when env vars absent', () => {
    delete process.env['CI'];
    delete process.env['GITHUB_ACTIONS'];
    delete process.env['GITLAB_CI'];
    delete process.env['CIRCLECI'];
    delete process.env['JENKINS_URL'];
    delete process.env['BUILDKITE'];
    delete process.env['TRAVIS'];
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.isCI).toBe(false);
  });

  it('includes nodeVersion', () => {
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.nodeVersion).toBe(process.version);
  });

  it('returns empty availableCommands when commands not found', () => {
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.availableCommands).toEqual([]);
  });

  it('returns null projectType when no manifest found', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.projectType).toBeNull();
  });

  it('returns null packageManager when no lockfile found', () => {
    vi.mocked(existsSync).mockReturnValue(false);
    const ctx = detectEnvironment('/tmp/test');
    expect(ctx.packageManager).toBeNull();
  });
});

describe('formatEnvironmentPrompt', () => {
  it('formats basic environment', () => {
    const ctx: EnvironmentContext = {
      os: 'macos',
      shell: 'zsh',
      projectType: null,
      packageManager: null,
      isGitRepo: false,
      isTTY: true,
      isCI: false,
      isDocker: false,
      nodeVersion: 'v20.0.0',
      availableCommands: [],
    };

    const result = formatEnvironmentPrompt(ctx);
    expect(result).toContain('## Environment');
    expect(result).toContain('OS: macos');
    expect(result).toContain('Shell: zsh');
    expect(result).toContain('Node: v20.0.0');
    expect(result).toContain('Terminal: interactive');
  });

  it('includes project type when detected', () => {
    const ctx: EnvironmentContext = {
      os: 'linux',
      shell: 'bash',
      projectType: 'node',
      packageManager: 'pnpm',
      isGitRepo: true,
      isTTY: false,
      isCI: false,
      isDocker: false,
      nodeVersion: 'v20.0.0',
      availableCommands: ['git', 'node', 'pnpm'],
    };

    const result = formatEnvironmentPrompt(ctx);
    expect(result).toContain('Project type: node');
    expect(result).toContain('Package manager: pnpm');
    expect(result).toContain('Git repository: yes');
    expect(result).toContain('non-interactive (piped)');
    expect(result).toContain('Available commands: git, node, pnpm');
  });

  it('includes CI and Docker flags when set', () => {
    const ctx: EnvironmentContext = {
      os: 'linux',
      shell: 'sh',
      projectType: null,
      packageManager: null,
      isGitRepo: false,
      isTTY: false,
      isCI: true,
      isDocker: true,
      nodeVersion: 'v20.0.0',
      availableCommands: [],
    };

    const result = formatEnvironmentPrompt(ctx);
    expect(result).toContain('Running in CI');
    expect(result).toContain('Running in Docker');
  });
});
