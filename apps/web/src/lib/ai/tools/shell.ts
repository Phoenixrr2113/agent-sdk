import { spawn } from 'node:child_process';
import { tool } from 'ai';
import { z } from 'zod';

const DANGEROUS_PATTERNS = [
  /rm\s+(-rf?|--recursive)?\s*[\/~]/i,
  />\s*\/dev\/sd[a-z]/i,
  /mkfs\./i,
  /dd\s+if=/i,
  /:(){ :|:& };:/,
  /\b(sudo|su)\b/i,
  /\b(shutdown|reboot|halt|poweroff)\b/i,
  /\b(curl|wget)\b.*\|\s*(bash|sh|zsh)\b/i,
  /\beval\b/i,
  /\bchmod\s+(-R\s+)?(777|755)\b/i,
];

const INTERACTIVE_COMMANDS = [
  'vi',
  'vim',
  'nvim',
  'nano',
  'emacs',
  'pico',
  'htop',
  'top',
  'less',
  'more',
  'man',
  'screen',
  'tmux',
  'ssh',
  'telnet',
  'ftp',
];

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function isInteractiveCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return firstWord ? INTERACTIVE_COMMANDS.includes(firstWord) : false;
}

type ShellOptions = {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
};

type ShellResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  killed: boolean;
  durationMs: number;
  error?: string;
};

async function executeCommand(
  command: string,
  options: ShellOptions = {}
): Promise<ShellResult> {
  const {
    cwd = process.cwd(),
    timeout = 30000,
    maxBuffer = 1024 * 1024,
    env,
  } = options;

  const startTime = performance.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let killed = false;

    const proc = spawn('bash', ['-c', command], {
      cwd,
      env: { ...process.env, ...env, TERM: 'dumb' },
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill('SIGTERM');

      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch {
          // Process already terminated
        }
      }, 5000);
    }, timeout);

    proc.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= maxBuffer) {
        stdout += chunk;
      }
    });

    proc.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= maxBuffer) {
        stderr += chunk;
      }
    });

    proc.stdout.on('error', () => {
      // Ignore stream errors
    });

    proc.stderr.on('error', () => {
      // Ignore stream errors
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code ?? 1,
        killed,
        durationMs: performance.now() - startTime,
      });
    });

    proc.on('error', (err: Error) => {
      clearTimeout(timer);
      resolve({
        stdout: '',
        stderr: '',
        exitCode: 1,
        killed: false,
        durationMs: performance.now() - startTime,
        error: err.message,
      });
    });
  });
}

const shellInputSchema = z.object({
  command: z.string().max(10000).describe('Bash command to execute'),
  cwd: z.string().max(1000).optional().describe('Working directory'),
  timeout: z
    .number()
    .min(100)
    .max(300000)
    .optional()
    .describe('Timeout in ms (default: 30000)'),
});

type ShellInput = z.infer<typeof shellInputSchema>;

const DESCRIPTION = `Execute shell commands for tasks that specialized tools cannot accomplish.
This tool runs bash commands with safety checks.

When to use this tool:
- Running build commands (npm run build, make, cargo build)
- Installing packages (npm install, pip install)
- Running scripts (./scripts/deploy.sh)
- Git operations (git stash, git cherry-pick)
- System inspection (ls, find, df, du)
- Development servers (npm run dev, python -m http.server)

When NOT to use this tool:
- Reading/writing files → use filesystem tool
- Searching code → use filesystem tool with grep action
- Any task where a specialized tool exists

Safety features:
- Dangerous command patterns are blocked (rm -rf /, sudo, etc.)
- Interactive commands are rejected (vim, nano, htop)
- Timeout protection (default 30s, max 5min)

Parameters:
- command: Required. The bash command to execute.
- cwd: Working directory (default: project root).
- timeout: Timeout in milliseconds (default: 30000, max: 300000).`;

export function createShellTool(workspaceRoot: string) {
  return tool({
    description: DESCRIPTION,
    inputSchema: shellInputSchema,
    execute: async (input: ShellInput) => {
      const { command, cwd, timeout = 30000 } = input;

      if (isDangerousCommand(command)) {
        return {
          success: false,
          error: 'Command blocked for safety. This command pattern is potentially destructive.',
          command: command.slice(0, 100),
        };
      }

      if (isInteractiveCommand(command)) {
        const firstWord = command.trim().split(/\s+/)[0];
        return {
          success: false,
          error: `Interactive command '${firstWord}' not supported`,
          suggestion: 'Use non-interactive alternatives or specialized tools.',
        };
      }

      const effectiveCwd = cwd ?? workspaceRoot;

      const result = await executeCommand(command, {
        cwd: effectiveCwd,
        timeout,
        maxBuffer: 1024 * 1024,
      });

      if (result.error) {
        return {
          success: false,
          error: result.error,
          command: command.slice(0, 100),
          cwd: effectiveCwd,
        };
      }

      if (result.killed) {
        return {
          success: false,
          error: 'Command timed out',
          timeout,
          durationMs: result.durationMs,
          stdoutPreview: result.stdout.slice(0, 500),
          stderrPreview: result.stderr.slice(0, 500),
          hint: 'Increase timeout for long-running commands.',
        };
      }

      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Math.round(result.durationMs),
        status: result.exitCode === 0 ? 'success' : 'failed',
      };
    },
  });
}
