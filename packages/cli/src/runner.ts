/**
 * @fileoverview One-shot execution runner for agntk CLI.
 * Takes a resolved config + prompt, creates an agent, and streams output progressively to stdout.
 *
 * This is the "happy path": npx agntk "organize this folder by date"
 */

import { createAgent } from '@agntk/core';
import type { AgentOptions } from '@agntk/core';
import type { ToolPresetLevel } from '@agntk/core';
import type { ResolvedCLIConfig } from './config.js';
import type { EnvironmentContext } from './environment.js';
import { formatEnvironmentPrompt } from './environment.js';

// ============================================================================
// Types
// ============================================================================

export interface RunResult {
  /** Final text output from the agent */
  text: string;
  /** Number of tool steps executed */
  steps: number;
  /** Whether the run completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

export interface RunOptions {
  /** Resolved CLI config */
  config: ResolvedCLIConfig;
  /** Environment context (for system prompt injection) */
  environment: EnvironmentContext;
  /** Where to write streaming output. Default: process.stdout */
  output?: NodeJS.WritableStream;
  /** Where to write status messages. Default: process.stderr */
  statusOutput?: NodeJS.WritableStream;
}

// ============================================================================
// Config → AgentOptions mapping
// ============================================================================

function buildAgentOptions(
  config: ResolvedCLIConfig,
  environment: EnvironmentContext,
): AgentOptions {
  const agentOptions: AgentOptions = {
    role: config.role as AgentOptions['role'],
    maxSteps: config.maxSteps,
    toolPreset: config.toolPreset as ToolPresetLevel,
    workspaceRoot: config.workspace,
    enableMemory: config.memory,
    systemPromptPrefix: formatEnvironmentPrompt(environment),
  };

  // If user provided a model string, pass it through
  if (config.model && config.provider) {
    agentOptions.modelProvider = config.provider as AgentOptions['modelProvider'];
    agentOptions.modelName = config.model;
  }

  return agentOptions;
}

// ============================================================================
// One-Shot Runner
// ============================================================================

/**
 * Run the agent in one-shot mode.
 * Creates an agent, sends the prompt, streams output to stdout.
 */
export async function runOneShot(
  prompt: string,
  options: RunOptions,
): Promise<RunResult> {
  const { config, environment } = options;
  const output = options.output ?? process.stdout;
  const statusOutput = options.statusOutput ?? process.stderr;

  // Validate
  if (!prompt || prompt.trim().length === 0) {
    return {
      text: '',
      steps: 0,
      success: false,
      error: 'No prompt provided. Use: agntk "your prompt here" or agntk -i for interactive mode.',
    };
  }

  if (config.verbose) {
    statusOutput.write(`[agntk] Role: ${config.role}\n`);
    statusOutput.write(`[agntk] Provider: ${config.provider ?? 'auto-detect'}\n`);
    statusOutput.write(`[agntk] Model: ${config.model ?? 'default'}\n`);
    statusOutput.write(`[agntk] Workspace: ${config.workspace}\n`);
    statusOutput.write(`[agntk] Max steps: ${config.maxSteps}\n`);
    statusOutput.write(`[agntk] Tool preset: ${config.toolPreset}\n`);
    statusOutput.write(`[agntk] Memory: ${config.memory ? 'enabled' : 'disabled'}\n`);
  }

  // Dry run — show what would happen without executing (no API key needed)
  if (config.dryRun) {
    const dryOutput = [
      `[dry-run] Would create agent:`,
      `  Role: ${config.role}`,
      `  Provider: ${config.provider}`,
      `  Model: ${config.model ?? 'default'}`,
      `  Workspace: ${config.workspace}`,
      `  Max steps: ${config.maxSteps}`,
      `  Tool preset: ${config.toolPreset}`,
      `  Memory: ${config.memory ? 'enabled' : 'disabled'}`,
      `  Prompt: "${prompt}"`,
      ``,
    ].join('\n');
    output.write(dryOutput);
    return {
      text: dryOutput,
      steps: 0,
      success: true,
    };
  }

  // API key required for actual execution
  if (!config.apiKey) {
    return {
      text: '',
      steps: 0,
      success: false,
      error:
        'No API key found. Set one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or GOOGLE_API_KEY.',
    };
  }

  // Build agent options
  const agentOptions = buildAgentOptions(config, environment);

  try {
    // Create the agent
    const agent = createAgent(agentOptions);

    if (config.verbose) {
      statusOutput.write(`[agntk] Agent created (${agent.agentId})\n`);
      statusOutput.write(`[agntk] Sending prompt...\n`);
    }

    // Stream output progressively so text appears as the model generates it
    const streamResult = await agent.stream({ prompt });

    // Track whether we need a leading newline before text (after tool output)
    let afterToolResult = false;

    // Write text chunks and tool activity as they arrive
    for await (const chunk of streamResult.fullStream) {
      if (chunk.type === 'tool-call') {
        const toolChunk = chunk as Record<string, unknown>;
        const argsStr = toolChunk.input ? JSON.stringify(toolChunk.input) : '';
        statusOutput.write(`\n⚡ ${toolChunk.toolName as string}(${argsStr})\n`);
        afterToolResult = false;
      } else if (chunk.type === 'tool-result') {
        const resultChunk = chunk as Record<string, unknown>;
        const raw = typeof resultChunk.output === 'string'
          ? resultChunk.output
          : JSON.stringify(resultChunk.output);
        // Parse tool output — tools return JSON with { success, output }
        let displayOutput = raw;
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.output === 'string') {
            displayOutput = parsed.output;
          }
        } catch {
          // Use raw output as-is
        }
        // Truncate very long output for display
        const maxLen = 2000;
        if (displayOutput.length > maxLen) {
          displayOutput = displayOutput.slice(0, maxLen) + `\n... (${displayOutput.length} chars total)`;
        }
        statusOutput.write(`${displayOutput}\n`);
        afterToolResult = true;
      } else if (chunk.type === 'text-delta') {
        const textChunk = chunk as Record<string, unknown>;
        if (afterToolResult) {
          output.write('\n');
          afterToolResult = false;
        }
        output.write(textChunk.text as string);
      }
    }

    // Get final results (already resolved since we consumed the full stream)
    const finalText = await streamResult.text;
    const steps = await streamResult.steps;
    const stepCount = steps?.length ?? 0;

    // Ensure trailing newline
    if (finalText && !finalText.endsWith('\n')) {
      output.write('\n');
    }

    if (config.verbose) {
      statusOutput.write(`[agntk] Completed in ${stepCount} step(s)\n`);
      const totalUsage = await streamResult.totalUsage;
      if (totalUsage) {
        const usage = totalUsage as Record<string, unknown>;
        statusOutput.write(
          `[agntk] Tokens: ${usage.inputTokens ?? 0} in / ${usage.outputTokens ?? 0} out\n`,
        );
      }
    }

    return {
      text: finalText ?? '',
      steps: stepCount,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (config.verbose) {
      statusOutput.write(`[agntk] Error: ${message}\n`);
      if (error instanceof Error && error.stack) {
        statusOutput.write(`[agntk] ${error.stack}\n`);
      }
    }

    return {
      text: '',
      steps: 0,
      success: false,
      error: message,
    };
  }
}

// ============================================================================
// Piped Input Handler
// ============================================================================

/**
 * Read piped stdin (e.g., `cat file.log | agntk "explain this"`)
 */
export async function readStdin(timeoutMs: number = 100): Promise<string | null> {
  // If stdin is a TTY (interactive terminal), there's no piped input
  if (process.stdin.isTTY) {
    return null;
  }

  return new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (chunks.length === 0) {
        resolve(null);
      } else {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      }
    };

    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', finish);
    process.stdin.on('error', () => finish());

    // Safety timeout for edge cases
    setTimeout(finish, timeoutMs);

    process.stdin.resume();
  });
}
