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
    fast: 'x-ai/grok-4.1-fast',
    standard: 'google/gemini-3-flash-preview',
    reasoning: 'deepseek/deepseek-r1',
    powerful: 'z-ai/glm-4.7',
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
    fast: 'anthropic/claude-haiku-4.5',
    standard: 'anthropic/claude-sonnet-4.5',
    reasoning: 'anthropic/claude-opus-4.6',
    powerful: 'anthropic/claude-opus-4.6',
  },
};

// ============================================================================
// Default Agent Settings
// ============================================================================

export const DEFAULT_MAX_STEPS = 10;
export const DEFAULT_WORKSPACE_ROOT = process.cwd();
