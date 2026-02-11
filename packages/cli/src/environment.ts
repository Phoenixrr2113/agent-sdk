/**
 * @fileoverview Environment detection for agntk.
 * Detects OS, shell, project type, git repo, available commands, TTY, CI, etc.
 * This is the "invisible awareness" from PLAN.md Section 3.3.
 */

import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface EnvironmentContext {
  /** Operating system */
  os: 'macos' | 'linux' | 'windows' | 'unknown';
  /** Shell type */
  shell: string;
  /** Detected project type from manifest files */
  projectType: string | null;
  /** Detected package manager */
  packageManager: string | null;
  /** Whether cwd is inside a git repository */
  isGitRepo: boolean;
  /** Whether stdout is a terminal (interactive) */
  isTTY: boolean;
  /** Whether running in a CI environment */
  isCI: boolean;
  /** Whether running inside Docker */
  isDocker: boolean;
  /** Node.js version */
  nodeVersion: string;
  /** List of commonly useful commands that are available */
  availableCommands: string[];
}

// ============================================================================
// Detection Functions
// ============================================================================

function detectOS(): EnvironmentContext['os'] {
  switch (process.platform) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return 'unknown';
  }
}

function detectShell(): string {
  // Check SHELL env var (Unix)
  const shellEnv = process.env['SHELL'];
  if (shellEnv) {
    const shellName = shellEnv.split('/').pop();
    if (shellName) return shellName;
  }

  // Check ComSpec (Windows)
  const comspec = process.env['ComSpec'];
  if (comspec) {
    if (comspec.toLowerCase().includes('powershell')) return 'powershell';
    if (comspec.toLowerCase().includes('cmd')) return 'cmd';
  }

  // Fallback
  return process.platform === 'win32' ? 'cmd' : 'sh';
}

interface ManifestMapping {
  file: string;
  type: string;
  packageManager?: string;
}

const MANIFEST_FILES: ManifestMapping[] = [
  { file: 'package.json', type: 'node' },
  { file: 'Cargo.toml', type: 'rust' },
  { file: 'pyproject.toml', type: 'python' },
  { file: 'go.mod', type: 'go' },
  { file: 'Gemfile', type: 'ruby' },
  { file: 'build.gradle', type: 'java' },
  { file: 'pom.xml', type: 'java' },
  { file: 'composer.json', type: 'php' },
  { file: 'mix.exs', type: 'elixir' },
  { file: 'Makefile', type: 'make' },
];

function detectProjectType(workspace: string): string | null {
  for (const { file, type } of MANIFEST_FILES) {
    if (existsSync(join(workspace, file))) {
      return type;
    }
  }
  return null;
}

const LOCKFILE_TO_PM: Array<{ file: string; pm: string }> = [
  { file: 'pnpm-lock.yaml', pm: 'pnpm' },
  { file: 'bun.lockb', pm: 'bun' },
  { file: 'yarn.lock', pm: 'yarn' },
  { file: 'package-lock.json', pm: 'npm' },
];

function detectPackageManager(workspace: string): string | null {
  for (const { file, pm } of LOCKFILE_TO_PM) {
    if (existsSync(join(workspace, file))) {
      return pm;
    }
  }
  return null;
}

function detectGitRepo(workspace: string): boolean {
  return existsSync(join(workspace, '.git'));
}

function detectCI(): boolean {
  return !!(
    process.env['CI'] ||
    process.env['GITHUB_ACTIONS'] ||
    process.env['GITLAB_CI'] ||
    process.env['CIRCLECI'] ||
    process.env['JENKINS_URL'] ||
    process.env['BUILDKITE'] ||
    process.env['TRAVIS']
  );
}

function detectDocker(): boolean {
  if (existsSync('/.dockerenv')) return true;
  try {
    const cgroup = execSync('cat /proc/1/cgroup 2>/dev/null', { encoding: 'utf-8', timeout: 1000 });
    return cgroup.includes('docker') || cgroup.includes('containerd');
  } catch {
    return false;
  }
}

const USEFUL_COMMANDS = ['git', 'node', 'npm', 'pnpm', 'bun', 'python3', 'pip3', 'docker', 'curl', 'jq', 'at', 'crontab'];

function detectAvailableCommands(): string[] {
  const available: string[] = [];
  const whichCmd = process.platform === 'win32' ? 'where' : 'which';

  for (const cmd of USEFUL_COMMANDS) {
    try {
      execSync(`${whichCmd} ${cmd} 2>/dev/null`, { encoding: 'utf-8', timeout: 2000 });
      available.push(cmd);
    } catch {
      // Not available
    }
  }

  return available;
}

// ============================================================================
// Main Detection
// ============================================================================

/**
 * Detect the current environment context.
 * All detection is synchronous and fast (<500ms typical).
 */
export function detectEnvironment(workspace: string = process.cwd()): EnvironmentContext {
  return {
    os: detectOS(),
    shell: detectShell(),
    projectType: detectProjectType(workspace),
    packageManager: detectPackageManager(workspace),
    isGitRepo: detectGitRepo(workspace),
    isTTY: !!process.stdout.isTTY,
    isCI: detectCI(),
    isDocker: detectDocker(),
    nodeVersion: process.version,
    availableCommands: detectAvailableCommands(),
  };
}

// ============================================================================
// System Prompt Formatting
// ============================================================================

/**
 * Format environment context as a string to inject into the agent's system prompt.
 */
export function formatEnvironmentPrompt(ctx: EnvironmentContext): string {
  const lines: string[] = ['## Environment'];

  lines.push(`- OS: ${ctx.os}`);
  lines.push(`- Shell: ${ctx.shell}`);
  lines.push(`- Node: ${ctx.nodeVersion}`);
  lines.push(`- Terminal: ${ctx.isTTY ? 'interactive' : 'non-interactive (piped)'}`);

  if (ctx.projectType) {
    lines.push(`- Project type: ${ctx.projectType}`);
  }
  if (ctx.packageManager) {
    lines.push(`- Package manager: ${ctx.packageManager}`);
  }
  if (ctx.isGitRepo) {
    lines.push(`- Git repository: yes`);
  }
  if (ctx.isCI) {
    lines.push(`- Running in CI`);
  }
  if (ctx.isDocker) {
    lines.push(`- Running in Docker`);
  }
  if (ctx.availableCommands.length > 0) {
    lines.push(`- Available commands: ${ctx.availableCommands.join(', ')}`);
  }

  return lines.join('\n');
}
