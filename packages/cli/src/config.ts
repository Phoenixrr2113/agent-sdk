/**
 * @fileoverview Config utilities for agntk CLI.
 * API key detection and config file loading.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ============================================================================
// API Key Detection
// ============================================================================

interface ApiKeyResult {
  provider: string;
  apiKey: string;
}

const API_KEY_ENV_VARS: Array<{ env: string; provider: string }> = [
  { env: 'OPENROUTER_API_KEY', provider: 'openrouter' },
  { env: 'OPENAI_API_KEY', provider: 'openai' },
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
  name?: string;
  instructions?: string;
  model?: string;
  maxSteps?: number;
  workspace?: string;
}

const CONFIG_FILENAMES = [
  'agntk.config.json',
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
        return JSON.parse(content) as ConfigFileData;
      } catch {
        // Silently skip unparseable files
      }
    }
  }

  return {};
}
