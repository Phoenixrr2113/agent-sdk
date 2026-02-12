/**
 * @fileoverview Interactive REPL mode for agntk.
 * Provides a readline-based conversational loop with the agent.
 *
 * Usage: npx agntk -i [--memory] [--role coder]
 */

import { createInterface, type Interface } from 'node:readline';
import { createAgent } from '@agntk/core';
import type { AgentOptions } from '@agntk/core';
import type { ToolPresetLevel } from '@agntk/core';
import type { ResolvedCLIConfig } from './config.js';
import type { EnvironmentContext } from './environment.js';
import { formatEnvironmentPrompt } from './environment.js';
import { getVersion } from './version.js';

// ============================================================================
// Types
// ============================================================================

export interface ReplOptions {
  /** Resolved CLI config */
  config: ResolvedCLIConfig;
  /** Environment context */
  environment: EnvironmentContext;
  /** Input stream (for testing). Default: process.stdin */
  input?: NodeJS.ReadableStream;
  /** Output stream (for testing). Default: process.stdout */
  output?: NodeJS.WritableStream;
}

export interface ReplResult {
  /** Total number of exchanges in the session */
  exchanges: number;
  /** Whether the session ended normally */
  success: boolean;
  /** Error if session crashed */
  error?: string;
}

// ============================================================================
// REPL Commands
// ============================================================================

const REPL_COMMANDS: Record<string, { description: string; handler: (ctx: ReplContext) => void }> = {
  '/help': {
    description: 'Show available commands',
    handler: (ctx) => {
      ctx.output.write('\nAvailable commands:\n');
      for (const [cmd, { description }] of Object.entries(REPL_COMMANDS)) {
        ctx.output.write(`  ${cmd.padEnd(12)} ${description}\n`);
      }
      ctx.output.write('\n');
    },
  },
  '/clear': {
    description: 'Clear conversation history',
    handler: (ctx) => {
      ctx.history = [];
      ctx.output.write('Conversation cleared.\n');
    },
  },
  '/role': {
    description: 'Show current agent role',
    handler: (ctx) => {
      ctx.output.write(`Current role: ${ctx.config.role}\n`);
    },
  },
  '/env': {
    description: 'Show detected environment',
    handler: (ctx) => {
      ctx.output.write(formatEnvironmentPrompt(ctx.environment) + '\n');
    },
  },
  '/exit': {
    description: 'Exit the REPL',
    handler: (ctx) => {
      ctx.shouldExit = true;
    },
  },
};

// ============================================================================
// REPL Context
// ============================================================================

interface ReplContext {
  config: ResolvedCLIConfig;
  environment: EnvironmentContext;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  output: NodeJS.WritableStream;
  shouldExit: boolean;
}

// ============================================================================
// Interactive REPL
// ============================================================================

/**
 * Run the interactive REPL.
 */
export async function runRepl(options: ReplOptions): Promise<ReplResult> {
  const { config, environment } = options;
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  // Validate API key
  if (!config.apiKey) {
    output.write(
      'Error: No API key found. Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or GOOGLE_API_KEY.\n',
    );
    return { exchanges: 0, success: false, error: 'No API key' };
  }

  // Build agent options
  const envPrompt = formatEnvironmentPrompt(environment);
  const agentOptions: AgentOptions = {
    role: config.role as AgentOptions['role'],
    maxSteps: config.maxSteps,
    toolPreset: config.toolPreset as ToolPresetLevel,
    workspaceRoot: config.workspace,
    enableMemory: config.memory,
  };

  if (config.model && config.provider) {
    agentOptions.modelProvider = config.provider as AgentOptions['modelProvider'];
    agentOptions.modelName = config.model;
  }

  // Create agent
  const agent = createAgent(agentOptions);

  // Print welcome banner
  const version = getVersion();
  output.write(`\nagntk v${version} — interactive mode\n`);
  output.write(`Role: ${config.role} | Model: ${config.model ?? 'default'} | Memory: ${config.memory ? 'on' : 'off'}\n`);
  output.write(`Type /help for commands, /exit or Ctrl+C to quit.\n\n`);

  // Create readline interface
  const rl: Interface = createInterface({
    input: input as NodeJS.ReadableStream,
    output: output as NodeJS.WritableStream,
    prompt: '> ',
    terminal: true,
  });

  const ctx: ReplContext = {
    config,
    environment,
    history: [],
    output,
    shouldExit: false,
  };

  let exchanges = 0;

  return new Promise<ReplResult>((resolve) => {
    rl.prompt();

    rl.on('line', async (line: string) => {
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        rl.prompt();
        return;
      }

      // Check for REPL commands
      const cmdKey = trimmed.split(' ')[0]!.toLowerCase();
      if (REPL_COMMANDS[cmdKey]) {
        REPL_COMMANDS[cmdKey]!.handler(ctx);
        if (ctx.shouldExit) {
          rl.close();
          return;
        }
        rl.prompt();
        return;
      }

      // Send to agent
      ctx.history.push({ role: 'user', content: trimmed });

      // Build prompt with context (include recent history for multi-turn)
      const contextPrompt = ctx.history
        .map((h) => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`)
        .join('\n\n');

      try {
        output.write('\n');

        // Stream output progressively
        const streamResult = await agent.stream({ prompt: contextPrompt });

        for await (const chunk of streamResult.fullStream) {
          if (chunk.type === 'text-delta') {
            output.write(chunk.text);
          }
        }

        const responseText = (await streamResult.text) ?? '';
        if (responseText && !responseText.endsWith('\n')) {
          output.write('\n');
        }

        ctx.history.push({ role: 'assistant', content: responseText });
        exchanges++;

        if (config.verbose) {
          const totalUsage = await streamResult.totalUsage;
          const steps = await streamResult.steps;
          if (totalUsage) {
            const usage = totalUsage as Record<string, unknown>;
            output.write(
              `\n[${usage.inputTokens ?? 0} in / ${usage.outputTokens ?? 0} out | ${steps?.length ?? 0} step(s)]\n`,
            );
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        output.write(`\nError: ${msg}\n`);
      }

      output.write('\n');
      rl.prompt();
    });

    rl.on('close', () => {
      output.write('\nGoodbye!\n');
      resolve({
        exchanges,
        success: true,
      });
    });

    rl.on('SIGINT', () => {
      output.write('\n');
      rl.close();
    });
  });
}
