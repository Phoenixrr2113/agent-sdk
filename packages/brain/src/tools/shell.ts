import { tool } from 'ai';
import { z } from 'zod';
import { spawn, type ChildProcess } from 'node:child_process';

const DEFAULT_TIMEOUT = 30000;
const MAX_TIMEOUT = 300000;
const MAX_COMMAND_LENGTH = 10000;
const MAX_CWD_LENGTH = 1000;

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
  'vi', 'vim', 'nvim', 'nano', 'emacs', 'pico',
  'htop', 'top', 'less', 'more', 'man',
  'screen', 'tmux', 'ssh', 'telnet', 'ftp',
] as const;

function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function isInteractiveCommand(command: string): boolean {
  const firstWord = command.trim().split(/\s+/)[0];
  return INTERACTIVE_COMMANDS.includes(firstWord as typeof INTERACTIVE_COMMANDS[number]);
}

interface ShellOptions {
  cwd?: string;
  timeout?: number;
  maxBuffer?: number;
  env?: Record<string, string>;
}

interface ShellResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  killed: boolean;
  durationMs: number;
  error?: string;
}

interface BackgroundSession {
  id: string;
  command: string;
  process: ChildProcess;
  stdout: string;
  stderr: string;
  startedAt: number;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  exitCode?: number;
  cwd?: string;
}

const backgroundSessions = new Map<string, BackgroundSession>();

function generateSessionId(): string {
  return `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function executeCommand(
  command: string,
  options: ShellOptions = {}
): Promise<ShellResult> {
  const {
    cwd = process.cwd(),
    timeout = DEFAULT_TIMEOUT,
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
        }
      }, 5000);
    }, timeout);

    proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      if (stdout.length + chunk.length <= maxBuffer) {
        stdout += chunk;
      }
    });

    proc.stderr.on('data', (data) => {
      const chunk = data.toString();
      if (stderr.length + chunk.length <= maxBuffer) {
        stderr += chunk;
      }
    });

    proc.stdout.on('error', () => {
    });

    proc.stderr.on('error', () => {
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

    proc.on('error', (err) => {
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

function startBackgroundProcess(
  command: string,
  options: { cwd?: string; env?: Record<string, string> } = {}
): BackgroundSession {
  const sessionId = generateSessionId();
  const { cwd = process.cwd(), env } = options;

  const proc = spawn('bash', ['-c', command], {
    cwd,
    env: { ...process.env, ...env, TERM: 'dumb' },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const session: BackgroundSession = {
    id: sessionId,
    command,
    process: proc,
    stdout: '',
    stderr: '',
    startedAt: Date.now(),
    status: 'running',
    cwd,
  };

  proc.stdout?.on('data', (data) => {
    session.stdout += data.toString();
    if (session.stdout.length > 1024 * 1024) {
      session.stdout = session.stdout.slice(-512 * 1024);
    }
  });

  proc.stderr?.on('data', (data) => {
    session.stderr += data.toString();
    if (session.stderr.length > 1024 * 1024) {
      session.stderr = session.stderr.slice(-512 * 1024);
    }
  });

  proc.on('close', (code) => {
    session.status = code === 0 ? 'completed' : 'failed';
    session.exitCode = code ?? 1;
  });

  proc.on('error', () => {
    session.status = 'failed';
    session.exitCode = 1;
  });

  backgroundSessions.set(sessionId, session);
  return session;
}

export function createShellTools() {
  const executeInputSchema = z.object({
    command: z.string().max(MAX_COMMAND_LENGTH).describe('Bash command to execute'),
    cwd: z.string().max(MAX_CWD_LENGTH).optional().describe('Working directory'),
    timeout: z.number().min(100).max(MAX_TIMEOUT).optional().describe('Timeout in ms (default: 30000)'),
    env: z.record(z.string()).optional().describe('Environment variables to set'),
  });

  const executeTool = tool({
    description: `Execute a bash shell command for tasks that specialized tools cannot accomplish.

Use this tool for:
- Running build commands (npm run build, make build)
- Installing packages (npm install, pip install)
- Running scripts (./scripts/deploy.sh)
- Git operations (git log, git diff, git stash)
- System inspection (ls, find, df, du)
- Development servers (npm run dev, python -m http.server)

When NOT to use this tool:
- Reading/writing files → use queryKnowledge or read file directly
- Interactive commands (vim, nano, htop) → these are blocked

Safety features:
- Dangerous command patterns are blocked (rm -rf /, sudo, etc.)
- Interactive commands are rejected (vim, nano, htop)
- Timeout protection (default 30s, max 5min)

Parameters:
- command: Required. The bash command to execute.
- cwd: Working directory (default: current working directory).
- timeout: Timeout in milliseconds (default: 30000).
- env: Environment variables to set for the command.`,
    inputSchema: executeInputSchema,
    execute: async ({ command, cwd, timeout = DEFAULT_TIMEOUT, env }) => {
      if (isDangerousCommand(command)) {
        return JSON.stringify({
          success: false,
          error: 'Command blocked for safety. This command pattern is potentially destructive.',
          blocked: true,
          patterns: 'rm -rf, sudo, shutdown, etc.',
        });
      }

      if (isInteractiveCommand(command)) {
        const firstWord = command.trim().split(/\s+/)[0];
        return JSON.stringify({
          success: false,
          error: `Interactive command '${firstWord}' not supported`,
          hint: 'Use non-interactive alternatives for file operations.',
        });
      }

      const result = await executeCommand(command, {
        cwd,
        timeout,
        env,
      });

      if (result.error) {
        return JSON.stringify({
          success: false,
          error: result.error,
          command: command.slice(0, 100),
          cwd,
        });
      }

      if (result.killed) {
        return JSON.stringify({
          success: false,
          error: 'Command timed out',
          timeout,
          durationMs: result.durationMs,
          stdoutPreview: result.stdout.slice(0, 500),
          stderrPreview: result.stderr.slice(0, 500),
          hint: 'Increase timeout for long-running commands.',
        });
      }

      const output = {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        durationMs: Math.round(result.durationMs),
      };

      if (result.exitCode !== 0) {
        return JSON.stringify({
          ...output,
          success: false,
          status: 'failed',
          hint: 'Non-zero exit code indicates command failure. Check stderr for details.',
        });
      }

      return JSON.stringify({
        ...output,
        success: true,
        status: 'success',
      });
    },
  });

  const backgroundInputSchema = z.object({
    operation: z.enum(['start', 'status', 'output', 'stop', 'list']).describe('Operation to perform'),
    command: z.string().max(MAX_COMMAND_LENGTH).optional().describe('Command to run (required for start)'),
    sessionId: z.string().optional().describe('Session ID (required for status/output/stop)'),
    cwd: z.string().max(MAX_CWD_LENGTH).optional().describe('Working directory (for start)'),
    env: z.record(z.string()).optional().describe('Environment variables (for start)'),
  });

  const backgroundTool = tool({
    description: `Run long-running processes in the background without blocking.

Operations:
- start: Start a new background process, returns session ID
- status: Check if a process is still running
- output: Get stdout/stderr from a running or completed process
- stop: Terminate a background process
- list: List all active background sessions

Use this tool for:
- Development servers (npm run dev, python -m http.server)
- Long-running builds or tests
- Watch commands (npm run watch)
- Database servers or other daemons

Examples:
- { "operation": "start", "command": "npm run dev" }
- { "operation": "status", "sessionId": "bg-123-abc" }
- { "operation": "output", "sessionId": "bg-123-abc" }
- { "operation": "stop", "sessionId": "bg-123-abc" }
- { "operation": "list" }`,
    inputSchema: backgroundInputSchema,
    execute: async ({ operation, command, sessionId, cwd, env }) => {
      switch (operation) {
        case 'start': {
          if (!command) {
            return JSON.stringify({
              success: false,
              error: 'Command is required for start operation',
            });
          }

          if (isDangerousCommand(command)) {
            return JSON.stringify({
              success: false,
              error: 'Command blocked for safety',
              blocked: true,
            });
          }

          const session = startBackgroundProcess(command, { cwd, env });
          return JSON.stringify({
            success: true,
            sessionId: session.id,
            command: command.slice(0, 100),
            status: 'running',
            message: 'Process started in background. Use status/output to monitor.',
          });
        }

        case 'status': {
          if (!sessionId) {
            return JSON.stringify({
              success: false,
              error: 'Session ID is required for status operation',
            });
          }

          const session = backgroundSessions.get(sessionId);
          if (!session) {
            return JSON.stringify({
              success: false,
              error: `Session not found: ${sessionId}`,
            });
          }

          return JSON.stringify({
            success: true,
            sessionId: session.id,
            status: session.status,
            exitCode: session.exitCode,
            runningFor: session.status === 'running' 
              ? Math.round((Date.now() - session.startedAt) / 1000) + 's'
              : undefined,
            command: session.command.slice(0, 100),
          });
        }

        case 'output': {
          if (!sessionId) {
            return JSON.stringify({
              success: false,
              error: 'Session ID is required for output operation',
            });
          }

          const session = backgroundSessions.get(sessionId);
          if (!session) {
            return JSON.stringify({
              success: false,
              error: `Session not found: ${sessionId}`,
            });
          }

          return JSON.stringify({
            success: true,
            sessionId: session.id,
            status: session.status,
            stdout: session.stdout.slice(-10000),
            stderr: session.stderr.slice(-5000),
            exitCode: session.exitCode,
          });
        }

        case 'stop': {
          if (!sessionId) {
            return JSON.stringify({
              success: false,
              error: 'Session ID is required for stop operation',
            });
          }

          const session = backgroundSessions.get(sessionId);
          if (!session) {
            return JSON.stringify({
              success: false,
              error: `Session not found: ${sessionId}`,
            });
          }

          if (session.status !== 'running') {
            return JSON.stringify({
              success: true,
              message: `Session already ${session.status}`,
              exitCode: session.exitCode,
            });
          }

          try {
            session.process.kill('SIGTERM');
            session.status = 'stopped';
            
            setTimeout(() => {
              try {
                if (session.status === 'running') {
                  session.process.kill('SIGKILL');
                }
              } catch {
              }
            }, 5000);

            return JSON.stringify({
              success: true,
              message: 'Process terminated',
              sessionId: session.id,
            });
          } catch (error) {
            return JSON.stringify({
              success: false,
              error: `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }

        case 'list': {
          const sessions = Array.from(backgroundSessions.values()).map((s) => ({
            sessionId: s.id,
            command: s.command.slice(0, 50),
            status: s.status,
            startedAt: new Date(s.startedAt).toISOString(),
            exitCode: s.exitCode,
          }));

          return JSON.stringify({
            success: true,
            count: sessions.length,
            sessions,
          });
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown operation: ${operation}`,
          });
      }
    },
  });

  return {
    execute: executeTool,
    background: backgroundTool,
  };
}

export type ShellTools = ReturnType<typeof createShellTools>;
