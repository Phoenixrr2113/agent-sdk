#!/usr/bin/env node

/**
 * @fileoverview CLI entry point for agntk — zero-config AI agent.
 *
 * Usage:
 *   npx agntk --name "my-agent" "do something"
 *   npx agntk --name "my-agent" --instructions "you are a deploy bot" "roll back staging"
 *   npx agntk --name "my-agent" -i
 *   npx agntk list
 *   npx agntk "my-agent" "what were you working on?"
 *   cat error.log | npx agntk --name "debugger" "explain these errors"
 */

// Load .env files before anything else reads process.env
import 'dotenv/config';

import { createInterface, type Interface } from 'node:readline';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { getVersion } from './version.js';
import { detectApiKey } from './config.js';

// ============================================================================
// Constants
// ============================================================================

const AGENTS_DIR = resolve(homedir(), '.agntk', 'agents');

// ============================================================================
// ANSI Colors — auto-disabled when piped
// ============================================================================

interface Colors {
  dim: (s: string) => string;
  bold: (s: string) => string;
  cyan: (s: string) => string;
  yellow: (s: string) => string;
  green: (s: string) => string;
  red: (s: string) => string;
  magenta: (s: string) => string;
  reset: string;
}

function createColors(enabled: boolean): Colors {
  if (!enabled) {
    const identity = (s: string) => s;
    return { dim: identity, bold: identity, cyan: identity, yellow: identity, green: identity, red: identity, magenta: identity, reset: '' };
  }
  return {
    dim: (s) => `\x1b[2m${s}\x1b[22m`,
    bold: (s) => `\x1b[1m${s}\x1b[22m`,
    cyan: (s) => `\x1b[36m${s}\x1b[39m`,
    yellow: (s) => `\x1b[33m${s}\x1b[39m`,
    green: (s) => `\x1b[32m${s}\x1b[39m`,
    red: (s) => `\x1b[31m${s}\x1b[39m`,
    magenta: (s) => `\x1b[35m${s}\x1b[39m`,
    reset: '\x1b[0m',
  };
}

// ============================================================================
// Arg Parsing — intentionally minimal
// ============================================================================

type OutputLevel = 'quiet' | 'normal' | 'verbose';

interface CLIArgs {
  name: string | null;
  instructions: string | null;
  prompt: string | null;
  interactive: boolean;
  workspace: string;
  outputLevel: OutputLevel;
  maxSteps: number;
  help: boolean;
  version: boolean;
  list: boolean;
}

function parseCLIArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = {
    name: null,
    instructions: null,
    prompt: null,
    interactive: false,
    workspace: process.cwd(),
    outputLevel: 'normal',
    maxSteps: 25,
    help: false,
    version: false,
    list: false,
  };

  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    switch (arg) {
      case '--name':
      case '-n':
        args.name = argv[++i] ?? null;
        break;
      case '--instructions':
        args.instructions = argv[++i] ?? null;
        break;
      case '-i':
      case '--interactive':
        args.interactive = true;
        break;
      case '--workspace':
        args.workspace = argv[++i] ?? process.cwd();
        break;
      case '--verbose':
        args.outputLevel = 'verbose';
        break;
      case '-q':
      case '--quiet':
        args.outputLevel = 'quiet';
        break;
      case '--max-steps':
        args.maxSteps = parseInt(argv[++i] ?? '25', 10);
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case 'list':
        if (positionals.length === 0) {
          args.list = true;
        } else {
          positionals.push(arg);
        }
        break;
      default:
        if (!arg.startsWith('-')) {
          positionals.push(arg);
        }
        break;
    }
  }

  // Interpret positionals:
  //   agntk "prompt"                     → name from --name flag, prompt from positional
  //   agntk "agent-name" "prompt"        → first is agent name, second is prompt
  if (positionals.length === 1 && !args.name) {
    args.prompt = positionals[0]!;
  } else if (positionals.length === 1 && args.name) {
    args.prompt = positionals[0]!;
  } else if (positionals.length === 2) {
    if (!args.name) {
      args.name = positionals[0]!;
    }
    args.prompt = positionals[1]!;
  } else if (positionals.length > 2) {
    if (!args.name) {
      args.name = positionals[0]!;
      args.prompt = positionals.slice(1).join(' ');
    } else {
      args.prompt = positionals.join(' ');
    }
  }

  return args;
}

// ============================================================================
// Help
// ============================================================================

function printHelp(): void {
  const version = getVersion();
  console.log(`
  agntk (${version}) — zero-config AI agent

  Usage:
    agntk --name <name> "prompt"
    agntk --name <name> -i
    agntk <name> "prompt"
    agntk list

  Options:
    -n, --name <name>        Agent name (required for new agents)
    --instructions <text>    What the agent does (injected as system prompt)
    -i, --interactive        Interactive REPL mode
    --workspace <path>       Workspace root (default: cwd)
    --max-steps <n>          Max tool-loop steps (default: 25)
    --verbose                Show full tool args and output
    -q, --quiet              Text output only (for piping)
    -v, --version            Show version
    -h, --help               Show help

  Commands:
    list                     List all known agents

  Examples:
    agntk --name "coder" "fix the failing tests"
    agntk --name "ops" --instructions "you manage k8s deploys" "roll back staging"
    agntk --name "coder" -i
    agntk "coder" "what were you working on?"
    agntk list
    cat error.log | agntk --name "debugger" "explain"
`);
}

// ============================================================================
// List Agents
// ============================================================================

function listAgents(): void {
  if (!existsSync(AGENTS_DIR)) {
    console.log('No agents found. Create one with: agntk --name "my-agent" "do something"');
    return;
  }

  const entries = readdirSync(AGENTS_DIR, { withFileTypes: true });
  const agents = entries.filter((e) => e.isDirectory());

  if (agents.length === 0) {
    console.log('No agents found. Create one with: agntk --name "my-agent" "do something"');
    return;
  }

  console.log(`\nKnown agents (${agents.length}):\n`);
  for (const agent of agents) {
    const memoryPath = join(AGENTS_DIR, agent.name, 'memory.md');
    const contextPath = join(AGENTS_DIR, agent.name, 'context.md');
    const hasMemory = existsSync(memoryPath);
    const hasContext = existsSync(contextPath);
    const status = hasMemory || hasContext ? '●' : '○';
    console.log(`  ${status} ${agent.name}${hasMemory ? ' (has memory)' : ''}`);
  }
  console.log('');
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/** Compact summary of tool args — show key names and short values */
function summarizeArgs(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    const display = str.length > 60 ? str.slice(0, 57) + '...' : str;
    parts.push(`${key}=${display}`);
  }
  return parts.join(' ');
}

/** Compact summary of tool output */
function summarizeOutput(output: unknown): string {
  const raw = typeof output === 'string' ? output : JSON.stringify(output);
  let display = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.output === 'string') {
      display = parsed.output;
    }
  } catch {
    // use raw
  }
  const lines = display.split('\n');
  if (lines.length > 3) {
    return lines.slice(0, 3).join('\n') + `\n  ... (${lines.length} lines total)`;
  }
  if (display.length > 200) {
    return display.slice(0, 197) + '...';
  }
  return display;
}

/** Format milliseconds into human-readable duration */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}m${secs}s`;
}

// ============================================================================
// Stream Consumer — renders agent activity to terminal
// ============================================================================

interface StreamConsumerOptions {
  output: NodeJS.WritableStream;
  status: NodeJS.WritableStream;
  level: OutputLevel;
  colors: Colors;
  maxSteps?: number;
}

interface StreamStats {
  steps: number;
  toolCalls: number;
  startTime: number;
  inputTokens: number;
  outputTokens: number;
}

async function consumeStream(
  stream: AsyncIterable<{ type: string; [key: string]: unknown }>,
  opts: StreamConsumerOptions,
): Promise<StreamStats> {
  const { output, status, level, colors } = opts;
  const quiet = level === 'quiet';
  const verbose = level === 'verbose';

  const stats: StreamStats = {
    steps: 0,
    toolCalls: 0,
    startTime: Date.now(),
    inputTokens: 0,
    outputTokens: 0,
  };

  let afterToolResult = false;
  let currentStepStart = Date.now();
  let inReasoning = false;
  let hasTextOutput = false;
  let lastToolOutput: string | null = null;

  // Reflection tag filtering state machine.
  let inReflection = false;
  let reflectionBuffer = '';
  const REFLECTION_OPEN = '<reflection>';
  const REFLECTION_CLOSE = '</reflection>';

  for await (const chunk of stream) {
    switch (chunk.type) {
      case 'start-step': {
        stats.steps++;
        currentStepStart = Date.now();
        if (!quiet) {
          status.write(`\n${colors.dim(`── step ${stats.steps} ──────────────────────────────────────`)}\n`);
        }
        break;
      }

      case 'finish-step': {
        if (reflectionBuffer && !inReflection) {
          if (reflectionBuffer.trim()) {
            if (afterToolResult && !quiet) {
              output.write('\n');
              afterToolResult = false;
            }
            hasTextOutput = true;
            output.write(reflectionBuffer);
          }
          reflectionBuffer = '';
        }
        inReflection = false;

        if (!quiet) {
          const elapsed = Date.now() - currentStepStart;
          const reason = chunk.finishReason as string ?? 'unknown';
          const usage = chunk.usage as { inputTokens?: number; outputTokens?: number } | undefined;
          const tokensIn = usage?.inputTokens ?? 0;
          const tokensOut = usage?.outputTokens ?? 0;
          stats.inputTokens += tokensIn;
          stats.outputTokens += tokensOut;

          const parts = [
            colors.dim(`  ${formatDuration(elapsed)}`),
            colors.dim(`${tokensIn}→${tokensOut} tok`),
          ];
          if (reason === 'tool-calls') {
            parts.push(colors.dim('→ tool loop'));
          } else if (reason === 'stop') {
            parts.push(colors.green('done'));
          } else {
            parts.push(colors.yellow(reason));
          }
          status.write(`${parts.join(colors.dim(' | '))}\n`);
        }
        break;
      }

      case 'reasoning-start': {
        if (!quiet) {
          inReasoning = true;
          status.write(colors.dim('\n  ... '));
        }
        break;
      }

      case 'reasoning-delta': {
        if (!quiet && inReasoning) {
          const text = (chunk.text as string) ?? '';
          const compacted = text.replace(/\n/g, ' ');
          status.write(colors.dim(compacted));
        }
        break;
      }

      case 'reasoning-end': {
        if (!quiet && inReasoning) {
          status.write('\n');
          inReasoning = false;
        }
        break;
      }

      case 'tool-call': {
        stats.toolCalls++;
        if (!quiet) {
          const toolName = chunk.toolName as string;
          if (verbose) {
            const argsStr = chunk.input ? JSON.stringify(chunk.input, null, 2) : '';
            status.write(`\n  ${colors.cyan('>')} ${colors.bold(toolName)}\n`);
            if (argsStr) {
              const indented = argsStr.split('\n').map((l) => `     ${l}`).join('\n');
              status.write(`${colors.dim(indented)}\n`);
            }
          } else {
            const argsSummary = summarizeArgs(chunk.input);
            const display = argsSummary
              ? `  ${colors.cyan('>')} ${colors.bold(toolName)} ${colors.dim(argsSummary)}`
              : `  ${colors.cyan('>')} ${colors.bold(toolName)}`;
            status.write(`${display}\n`);
          }
        }
        afterToolResult = false;
        break;
      }

      case 'tool-result': {
        const toolOutputRaw = typeof chunk.output === 'string' ? chunk.output : JSON.stringify(chunk.output);
        try {
          const parsed = JSON.parse(toolOutputRaw);
          lastToolOutput = (parsed && typeof parsed.output === 'string') ? parsed.output : toolOutputRaw;
        } catch {
          lastToolOutput = toolOutputRaw;
        }

        if (!quiet) {
          const toolName = chunk.toolName as string;
          if (verbose) {
            let displayOutput = lastToolOutput ?? '';
            const maxLen = 2000;
            if (displayOutput.length > maxLen) {
              displayOutput = displayOutput.slice(0, maxLen) + `\n... (${displayOutput.length} chars total)`;
            }
            const indented = displayOutput.split('\n').map((l) => `     ${l}`).join('\n');
            status.write(`  ${colors.green('<')} ${colors.dim(toolName)} ${colors.dim('returned')}\n`);
            status.write(`${colors.dim(indented)}\n`);
          } else {
            const summary = summarizeOutput(chunk.output);
            const firstLine = summary.split('\n')[0]!;
            const truncated = firstLine.length > 100
              ? firstLine.slice(0, 97) + '...'
              : firstLine;
            status.write(`  ${colors.green('<')} ${colors.dim(toolName + ': ' + truncated)}\n`);
          }
        }
        afterToolResult = true;
        break;
      }

      case 'tool-error': {
        if (!quiet) {
          const toolName = chunk.toolName as string;
          const error = chunk.error instanceof Error
            ? chunk.error.message
            : String(chunk.error ?? 'unknown error');
          status.write(`  ${colors.red('x')} ${colors.bold(toolName)} ${colors.red(error)}\n`);
        }
        afterToolResult = true;
        break;
      }

      case 'text-delta': {
        const rawText = (chunk.text as string) ?? '';
        if (!rawText) break;

        reflectionBuffer += rawText;

        while (reflectionBuffer.length > 0) {
          if (inReflection) {
            const closeIdx = reflectionBuffer.indexOf(REFLECTION_CLOSE);
            if (closeIdx !== -1) {
              const content = reflectionBuffer.slice(0, closeIdx);
              reflectionBuffer = reflectionBuffer.slice(closeIdx + REFLECTION_CLOSE.length);
              inReflection = false;

              if (verbose) {
                const trimmed = content.trim();
                if (trimmed) {
                  status.write(colors.dim(`  ... ${trimmed}\n`));
                }
              }
            } else {
              break;
            }
          } else {
            const openIdx = reflectionBuffer.indexOf(REFLECTION_OPEN);
            if (openIdx !== -1) {
              const before = reflectionBuffer.slice(0, openIdx);
              if (before) {
                if (afterToolResult && !quiet) {
                  output.write('\n');
                  afterToolResult = false;
                }
                if (before.trim()) hasTextOutput = true;
                output.write(before);
              }
              reflectionBuffer = reflectionBuffer.slice(openIdx + REFLECTION_OPEN.length);
              inReflection = true;
            } else {
              let partialAt = -1;
              for (let i = Math.max(0, reflectionBuffer.length - REFLECTION_OPEN.length); i < reflectionBuffer.length; i++) {
                if (reflectionBuffer[i] === '<') {
                  const partial = reflectionBuffer.slice(i);
                  if (REFLECTION_OPEN.startsWith(partial)) {
                    partialAt = i;
                    break;
                  }
                }
              }

              if (partialAt !== -1) {
                const safe = reflectionBuffer.slice(0, partialAt);
                if (safe) {
                  if (afterToolResult && !quiet) {
                    output.write('\n');
                    afterToolResult = false;
                  }
                  if (safe.trim()) hasTextOutput = true;
                  output.write(safe);
                }
                reflectionBuffer = reflectionBuffer.slice(partialAt);
                break;
              } else {
                if (afterToolResult && !quiet) {
                  output.write('\n');
                  afterToolResult = false;
                }
                if (reflectionBuffer.trim()) hasTextOutput = true;
                output.write(reflectionBuffer);
                reflectionBuffer = '';
              }
            }
          }
        }
        break;
      }

      case 'finish': {
        if (!quiet) {
          const elapsed = Date.now() - stats.startTime;
          const totalUsage = chunk.totalUsage as { inputTokens?: number; outputTokens?: number } | undefined;
          if (totalUsage) {
            stats.inputTokens = totalUsage.inputTokens ?? stats.inputTokens;
            stats.outputTokens = totalUsage.outputTokens ?? stats.outputTokens;
          }
          status.write(`\n${colors.dim(`── done ── ${stats.steps} step${stats.steps !== 1 ? 's' : ''}, ${stats.toolCalls} tool call${stats.toolCalls !== 1 ? 's' : ''}, ${stats.inputTokens}→${stats.outputTokens} tok, ${formatDuration(elapsed)} ──`)}\n`);
        }
        break;
      }

      case 'error': {
        const error = chunk.error instanceof Error
          ? chunk.error.message
          : String(chunk.error ?? 'unknown error');
        status.write(`\n${colors.red('Error:')} ${error}\n`);
        break;
      }

      default:
        break;
    }
  }

  const hitStepLimit = opts.maxSteps && stats.steps >= opts.maxSteps;

  if (hitStepLimit && !quiet) {
    status.write(`\n${colors.yellow('Warning: step limit reached')} ${colors.dim(`(${opts.maxSteps} steps). Use --max-steps to increase.`)}\n`);
  }

  if (!hasTextOutput && lastToolOutput && stats.toolCalls > 0 && !hitStepLimit) {
    if (!quiet) {
      output.write('\n');
    }
    output.write(lastToolOutput);
    if (!lastToolOutput.endsWith('\n')) {
      output.write('\n');
    }
  }

  return stats;
}

// ============================================================================
// Read piped stdin
// ============================================================================

async function readStdin(timeoutMs: number = 100): Promise<string | null> {
  if (process.stdin.isTTY) return null;

  return new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      resolve(chunks.length === 0 ? null : Buffer.concat(chunks).toString('utf-8'));
    };

    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', finish);
    process.stdin.on('error', () => finish());
    setTimeout(finish, timeoutMs);
    process.stdin.resume();
  });
}

// ============================================================================
// One-Shot Mode
// ============================================================================

async function runOneShot(
  prompt: string,
  args: CLIArgs,
): Promise<void> {
  const { createAgent } = await import('@agntk/core');
  const colors = createColors(process.stderr.isTTY ?? false);

  const agent = createAgent({
    name: args.name!,
    instructions: args.instructions ?? undefined,
    workspaceRoot: args.workspace,
    maxSteps: args.maxSteps,
  });

  if (args.outputLevel !== 'quiet') {
    const toolCount = agent.getToolNames().length;
    process.stderr.write(
      `${colors.dim(`agntk | ${args.name} | ${toolCount} tools | workspace: ${args.workspace}`)}\n`,
    );
  }

  const result = await agent.stream({ prompt });

  await consumeStream(result.fullStream, {
    output: process.stdout,
    status: process.stderr,
    level: args.outputLevel,
    colors,
    maxSteps: args.maxSteps,
  });

  const finalText = await result.text;
  if (finalText && !finalText.endsWith('\n')) {
    process.stdout.write('\n');
  }

  if (args.outputLevel === 'verbose') {
    const usage = await result.usage;
    if (usage) {
      process.stderr.write(
        colors.dim(`[usage] ${usage.inputTokens ?? 0} input + ${usage.outputTokens ?? 0} output tokens\n`),
      );
    }
  }
}

// ============================================================================
// REPL Mode
// ============================================================================

async function runRepl(args: CLIArgs): Promise<void> {
  const { createAgent } = await import('@agntk/core');
  const colors = createColors(process.stdout.isTTY ?? false);

  const agent = createAgent({
    name: args.name!,
    instructions: args.instructions ?? undefined,
    workspaceRoot: args.workspace,
    maxSteps: args.maxSteps,
  });

  const version = getVersion();
  const output = process.stdout;
  const toolCount = agent.getToolNames().length;

  output.write(`\n${colors.bold('agntk')} ${colors.dim(`(${version})`)}\n`);
  output.write(`${colors.cyan(args.name!)} ${colors.dim(`| ${toolCount} tools | memory: on`)}\n`);
  output.write(`${colors.dim('Type /help for commands, /exit or Ctrl+C to quit.')}\n\n`);

  const rl: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.cyan(args.name! + '>')} `,
    terminal: true,
  });

  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const pendingLines: string[] = [];
  let busy = false;
  let closed = false;

  async function processLine(trimmed: string): Promise<void> {
    if (trimmed === '/exit' || trimmed === '/quit') {
      rl.close();
      return;
    }
    if (trimmed === '/help') {
      output.write(`\n  ${colors.bold('/help')}    Show commands\n  ${colors.bold('/tools')}   List available tools\n  ${colors.bold('/verbose')} Toggle verbose output\n  ${colors.bold('/exit')}    Quit\n\n`);
      rl.prompt();
      return;
    }
    if (trimmed === '/tools') {
      const tools = agent.getToolNames();
      output.write(`\n${colors.bold(`Tools (${tools.length})`)}:\n  ${tools.join(', ')}\n\n`);
      rl.prompt();
      return;
    }
    if (trimmed === '/verbose') {
      if (args.outputLevel === 'verbose') {
        args.outputLevel = 'normal';
        output.write(`${colors.dim('Verbose output: off')}\n`);
      } else {
        args.outputLevel = 'verbose';
        output.write(`${colors.dim('Verbose output: on')}\n`);
      }
      rl.prompt();
      return;
    }

    busy = true;
    rl.pause();

    history.push({ role: 'user', content: trimmed });

    const maxHistoryPairs = 10;
    const recentHistory = history.length > maxHistoryPairs * 2
      ? history.slice(-maxHistoryPairs * 2)
      : history;

    const historyLines = recentHistory.map((h) =>
      h.role === 'user' ? `[User]: ${h.content}` : `[Assistant]: ${h.content}`,
    );
    const contextPrompt = [
      '<conversation_history>',
      ...historyLines.slice(0, -1),
      '</conversation_history>',
      '',
      recentHistory[recentHistory.length - 1]!.content,
    ].join('\n');

    try {
      output.write('\n');
      const result = await agent.stream({ prompt: contextPrompt });
      await consumeStream(result.fullStream, {
        output,
        status: process.stderr,
        level: args.outputLevel,
        colors,
        maxSteps: args.maxSteps,
      });

      const responseText = (await result.text) ?? '';
      if (responseText && !responseText.endsWith('\n')) {
        output.write('\n');
      }

      history.push({ role: 'assistant', content: responseText });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      output.write(`\n${colors.red('Error:')} ${msg}\n`);
    }

    output.write('\n');
    busy = false;
    rl.resume();

    while (pendingLines.length > 0) {
      const next = pendingLines.shift()!;
      if (next) {
        await processLine(next);
      }
    }

    if (!closed) {
      rl.prompt();
    }
  }

  return new Promise<void>((resolvePromise) => {
    rl.prompt();

    rl.on('line', (line: string) => {
      const trimmed = line.trim();

      if (!trimmed) {
        rl.prompt();
        return;
      }

      if (busy) {
        pendingLines.push(trimmed);
        return;
      }

      processLine(trimmed).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        output.write(`\n${colors.red('Error:')} ${msg}\n`);
        rl.prompt();
      });
    });

    rl.on('close', () => {
      closed = true;

      const finish = () => {
        output.write(`\n${colors.dim('Goodbye!')}\n`);
        resolvePromise();
      };

      if (busy) {
        const interval = setInterval(() => {
          if (!busy) {
            clearInterval(interval);
            finish();
          }
        }, 100);
      } else {
        finish();
      }
    });

    rl.on('SIGINT', () => {
      output.write('\n');
      rl.close();
    });
  });
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseCLIArgs(process.argv.slice(2));

  // Fast paths — no heavy imports
  if (args.version) {
    console.log(`agntk (${getVersion()})`);
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.list) {
    listAgents();
    process.exit(0);
  }

  // Validate: need a name
  if (!args.name) {
    if (!args.prompt && process.stdin.isTTY) {
      console.error(
        'Error: No agent name provided.\n' +
          'Usage: agntk --name "my-agent" "your prompt"\n' +
          '       agntk --name "my-agent" -i\n' +
          '       agntk list\n' +
          '       agntk -h',
      );
      process.exit(1);
    }

    // Default name if only prompt was given
    args.name = 'default';
  }

  // Check API key
  const apiKeyResult = detectApiKey();
  if (!apiKeyResult) {
    console.error(
      'Error: No API key found.\n\n' +
        '  1. Get a key at https://openrouter.ai/keys\n' +
        '  2. Add to your shell profile:\n\n' +
        '     export OPENROUTER_API_KEY=sk-or-...\n\n' +
        '  Then restart your terminal.',
    );
    process.exit(1);
  }

  // Interactive mode
  if (args.interactive) {
    await runRepl(args);
    process.exit(0);
  }

  // Build final prompt (handle piped stdin)
  let prompt = args.prompt;
  const pipedInput = await readStdin();
  if (pipedInput) {
    prompt = prompt ? `${pipedInput}\n\n${prompt}` : pipedInput;
  }

  if (!prompt) {
    console.error(
      'Error: No prompt provided.\n' +
        'Usage: agntk --name "my-agent" "your prompt"\n' +
        '       agntk --name "my-agent" -i\n' +
        '       agntk -h',
    );
    process.exit(1);
  }

  // One-shot mode
  await runOneShot(prompt, args);

  // Flush observability traces before exit
  try {
    const { shutdownObservability } = await import('@agntk/core');
    await shutdownObservability();
  } catch {
    // Observability not available — that's fine
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  if (process.env.DEBUG) {
    console.error(err instanceof Error ? err.stack : '');
  }
  process.exit(1);
});
