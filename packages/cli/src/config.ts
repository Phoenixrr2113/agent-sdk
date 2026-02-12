/**
 * @fileoverview Config resolution for agntk CLI.
 * Precedence: CLI flags > env vars > config file > defaults.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParsedArgs } from './args.js';

// ============================================================================
// Types
// ============================================================================

export interface ResolvedCLIConfig {
  /** The prompt text to send to the agent */
  prompt: string | null;
  /** Whether to enter interactive REPL mode */
  interactive: boolean;
  /** Agent role */
  role: string;
  /** Model identifier (provider:model format) */
  model: string | null;
  /** Provider extracted from model or env vars */
  provider: string | null;
  /** API key for the resolved provider */
  apiKey: string | null;
  /** Enable persistent memory */
  memory: boolean;
  /** Run init wizard */
  init: boolean;
  /** Tool preset */
  toolPreset: string;
  /** Workspace root directory */
  workspace: string;
  /** Dry run mode */
  dryRun: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Max agent steps */
  maxSteps: number;
  /** Path to config file */
  configPath: string | null;
}

// ============================================================================
// API Key Detection
// ============================================================================

interface ApiKeyResult {
  provider: string;
  apiKey: string;
}

const API_KEY_ENV_VARS: Array<{ env: string; provider: string }> = [
  { env: 'ANTHROPIC_API_KEY', provider: 'anthropic' },
  { env: 'OPENAI_API_KEY', provider: 'openai' },
  { env: 'OPENROUTER_API_KEY', provider: 'openrouter' },
  { env: 'GOOGLE_API_KEY', provider: 'google' },
  { env: 'GOOGLE_GENERATIVE_AI_API_KEY', provider: 'google' },
];

/**
 * Detect API key from environment variables.
 * Returns the first found key with its provider.
 */
export function detectApiKey(): ApiKeyResult | null {
  for (const { env, provider } of API_KEY_ENV_VARS) {
    const key = process.env[env];
    if (key && key.trim().length > 0) {
      return { provider, apiKey: key };
    }
  }
  return null;
}

// ============================================================================
// Config File Loading
// ============================================================================

interface ConfigFileData {
  role?: string;
  model?: string;
  memory?: boolean;
  tools?: string;
  maxSteps?: number;
  workspace?: string;
}

const CONFIG_FILENAMES = [
  'agent-sdk.config.yaml',
  'agent-sdk.config.yml',
  'agent-sdk.config.json',
  '.agntkrc.json',
];

/**
 * Load config file from the workspace directory.
 * Tries multiple filenames, returns first found.
 */
export function loadConfigFile(workspace: string, explicitPath?: string | null): ConfigFileData {
  if (explicitPath) {
    if (!existsSync(explicitPath)) {
      return {};
    }
    try {
      const content = readFileSync(explicitPath, 'utf-8');
      return JSON.parse(content) as ConfigFileData;
    } catch {
      return {};
    }
  }

  for (const filename of CONFIG_FILENAMES) {
    const filePath = join(workspace, filename);
    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        // Only JSON support for now — YAML support can be added later
        if (filename.endsWith('.json')) {
          return JSON.parse(content) as ConfigFileData;
        }
        // For YAML files, try JSON parse first (works for simple cases)
        return JSON.parse(content) as ConfigFileData;
      } catch {
        // Silently skip unparseable files
      }
    }
  }

  return {};
}

// ============================================================================
// Config Resolution
// ============================================================================

/**
 * Resolve final config from CLI args, env vars, config file, and defaults.
 */
export function resolveConfig(args: ParsedArgs): ResolvedCLIConfig {
  const workspace = args.workspace ?? process.cwd();

  // Load config file (lowest precedence)
  const fileConfig = loadConfigFile(workspace, args.config);

  // Detect API key from env
  const apiKeyResult = detectApiKey();

  // Parse model string (e.g., "anthropic:claude-sonnet-4")
  let provider: string | null = apiKeyResult?.provider ?? null;
  let model = args.model ?? fileConfig.model ?? null;

  if (model && model.includes(':')) {
    const [p, ...rest] = model.split(':');
    provider = p!;
    model = rest.join(':');
  }

  return {
    prompt: args.prompt,
    interactive: args.interactive,
    role: args.role ?? fileConfig.role ?? 'generic',
    model,
    provider,
    apiKey: apiKeyResult?.apiKey ?? null,
    memory: args.memory || (fileConfig.memory ?? false),
    init: args.init,
    toolPreset: args.tools ?? fileConfig.tools ?? 'standard',
    workspace,
    dryRun: args.dryRun,
    verbose: args.verbose,
    maxSteps: args.maxSteps ?? fileConfig.maxSteps ?? 10,
    configPath: args.config,
  };
}
