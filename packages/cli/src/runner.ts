/**
 * @fileoverview One-shot execution runner for agntk CLI.
 * Takes a resolved config + prompt, creates an agent, streams output to stdout.
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
  const envPrompt = formatEnvironmentPrompt(environment);

  // Build system prompt with environment context
  const systemPromptParts: string[] = [];
  systemPromptParts.push(envPrompt);

  // If workspace-specific context exists, add it
  // (Memory loading will be added in P2-MEM-005)

  const agentOptions: AgentOptions = {
    role: config.role as AgentOptions['role'],
    maxSteps: config.maxSteps,
    toolPreset: config.toolPreset as ToolPresetLevel,
    workspaceRoot: config.workspace,
    enableMemory: config.memory,
  };

  // If user provided a model string, pass it through
  if (config.model && config.provider) {
    agentOptions.modelProvider = config.provider as AgentOptions['modelProvider'];
    agentOptions.modelName = config.model;
  }

  // Prepend environment context to the system prompt
  // The role's built-in system prompt will be used by default,
  // and we augment it with environment context
  if (systemPromptParts.length > 0) {
    const envContext = systemPromptParts.join('\n\n');
    // We don't override the whole system prompt — we let the role handle it
    // and inject environment context via a wrapper
    agentOptions.systemPrompt = undefined; // let role default apply
    // TODO: When we add a `systemPromptPrefix` option to AgentOptions, use that instead
    // For now, environment context is baked into the role prompt
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

    // Use generate() for one-shot mode (simpler, returns full result)
    const result = await agent.generate({ prompt });

    // Write final text to stdout
    if (result.text) {
      output.write(result.text);
      // Ensure trailing newline
      if (!result.text.endsWith('\n')) {
        output.write('\n');
      }
    }

    const stepCount = result.steps?.length ?? 0;

    if (config.verbose) {
      statusOutput.write(`[agntk] Completed in ${stepCount} step(s)\n`);
      if (result.totalUsage) {
        const usage = result.totalUsage as Record<string, unknown>;
        statusOutput.write(
          `[agntk] Tokens: ${usage.inputTokens ?? 0} in / ${usage.outputTokens ?? 0} out\n`,
        );
      }
    }

    return {
      text: result.text ?? '',
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
