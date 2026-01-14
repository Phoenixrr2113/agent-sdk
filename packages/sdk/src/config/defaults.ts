/**
 * @fileoverview Default configuration values.
 * These are the built-in fallbacks when no config/env is set.
 */

import type { ModelTier, Provider } from './schema';

// ============================================================================
// Default Models
// ============================================================================

export const DEFAULT_PROVIDER: Provider = 'openrouter';

export const DEFAULT_MODELS: Record<Provider, Record<ModelTier, string>> = {
  openrouter: {
    fast: 'deepseek/deepseek-chat-v3-0324:free',
    standard: 'google/gemini-2.0-flash-001',
    reasoning: 'deepseek/deepseek-r1:free',
    powerful: 'anthropic/claude-sonnet-4',
  },
  ollama: {
    fast: 'qwen3:4b',
    standard: 'qwen2.5-coder:14b',
    reasoning: 'deepseek-r1:14b',
    powerful: 'qwen2.5-coder:14b',
  },
  openai: {
    fast: 'gpt-4o-mini',
    standard: 'gpt-4o',
    reasoning: 'o3',
    powerful: 'gpt-4o',
  },
  anthropic: {
    fast: 'claude-3-haiku-20240307',
    standard: 'claude-sonnet-4-20250514',
    reasoning: 'claude-sonnet-4-20250514',
    powerful: 'claude-sonnet-4-20250514',
  },
};

// ============================================================================
// Default Agent Settings
// ============================================================================

export const DEFAULT_MAX_STEPS = 10;
export const DEFAULT_WORKSPACE_ROOT = process.cwd();
