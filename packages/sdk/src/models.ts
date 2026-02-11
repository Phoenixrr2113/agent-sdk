/**
 * @agntk/core - Model Configuration
 *
 * Model tier definitions supporting multiple providers.
 * All providers use @ai-sdk/openai-compatible for unified access.
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createLogger } from '@agntk/logger';
import { getModelForTier, getConfig, DEFAULT_MODELS, DEFAULT_PROVIDER } from './config';
import type { LanguageModel } from 'ai';

const log = createLogger('@agntk/core:models');

// Re-export defaults for backward compatibility
export { DEFAULT_MODELS as defaultModels };

// ============================================================================
// Provider Configuration
// ============================================================================

interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKeyEnv: string;
  headers?: Record<string, string>;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  openrouter: {
    name: 'openrouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyEnv: 'OPENROUTER_API_KEY',
  },
  ollama: {
    name: 'ollama',
    baseURL: process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434/v1',
    apiKeyEnv: 'OLLAMA_API_KEY', // Ollama typically doesn't need a key, but support it
  },
  openai: {
    name: 'openai',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    name: 'anthropic',
    baseURL: 'https://api.anthropic.com/v1',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
};

// ============================================================================
// Provider Instances (Lazy Initialization)
// ============================================================================

const providerInstances = new Map<string, ReturnType<typeof createOpenAICompatible>>();

function getProvider(providerName: string): ReturnType<typeof createOpenAICompatible> {
  let instance = providerInstances.get(providerName);
  if (instance) return instance;

  // Check for custom providers in config
  const config = getConfig();
  const customProviders = config.models?.customProviders;
  const customConfig = customProviders?.[providerName];

  let providerConfig: ProviderConfig;

  if (customConfig) {
    providerConfig = {
      name: providerName,
      baseURL: customConfig.baseURL,
      apiKeyEnv: customConfig.apiKeyEnv,
      headers: customConfig.headers,
    };
  } else if (PROVIDER_CONFIGS[providerName]) {
    providerConfig = PROVIDER_CONFIGS[providerName];
  } else {
    throw new Error(`Unknown provider: ${providerName}. Configure it in models.customProviders.`);
  }

  const apiKey = process.env[providerConfig.apiKeyEnv] || '';

  log.debug('Initializing provider', { name: providerConfig.name, baseURL: providerConfig.baseURL });

  instance = createOpenAICompatible({
    name: providerConfig.name,
    baseURL: providerConfig.baseURL,
    apiKey,
    headers: providerConfig.headers,
  });

  providerInstances.set(providerName, instance);
  return instance;
}

// ============================================================================
// Model Tier Types
// ============================================================================

export type ModelTier = 'fast' | 'standard' | 'reasoning' | 'powerful';
export type ModelProvider = 'openrouter' | 'ollama' | 'openai' | 'anthropic' | (string & {});

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
}

// ============================================================================
// Environment Variable Model Overrides
// ============================================================================

function getEnvModel(tier: ModelTier): string | undefined {
  const envKey = `MODEL_${tier.toUpperCase()}`;
  return process.env[envKey];
}

function getOllamaEnvModel(tier: ModelTier): string | undefined {
  const envKey = `OLLAMA_${tier.toUpperCase()}_MODEL`;
  return process.env[envKey];
}

// ============================================================================
// Model Creation Functions
// ============================================================================

function createModelForProvider(
  provider: string,
  modelName: string
): LanguageModel {
  const providerInstance = getProvider(provider);
  return providerInstance(modelName);
}

// ============================================================================
// Model Tier Functions
// ============================================================================

export const models = {
  fast: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('fast') || DEFAULT_MODELS.ollama.fast;
      return createModelForProvider('ollama', modelName);
    }
    const modelName = getEnvModel('fast') || DEFAULT_MODELS.openrouter.fast;
    return createModelForProvider('openrouter', modelName);
  },

  standard: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('standard') || DEFAULT_MODELS.ollama.standard;
      return createModelForProvider('ollama', modelName);
    }
    const modelName = getEnvModel('standard') || DEFAULT_MODELS.openrouter.standard;
    return createModelForProvider('openrouter', modelName);
  },

  reasoning: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('reasoning') || DEFAULT_MODELS.ollama.reasoning;
      return createModelForProvider('ollama', modelName);
    }
    const modelName = getEnvModel('reasoning') || DEFAULT_MODELS.openrouter.reasoning;
    return createModelForProvider('openrouter', modelName);
  },

  powerful: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('powerful') || DEFAULT_MODELS.ollama.powerful;
      return createModelForProvider('ollama', modelName);
    }
    const modelName = getEnvModel('powerful') || DEFAULT_MODELS.openrouter.powerful;
    return createModelForProvider('openrouter', modelName);
  },
};

// ============================================================================
// Model Resolution
// ============================================================================

export interface ModelResolutionOptions {
  /** Specific model tier to use */
  tier?: ModelTier;
  /** Specific provider to use */
  provider?: ModelProvider;
  /** Specific model name (overrides tier/provider) */
  modelName?: string;
}

/**
 * Resolves a model based on options.
 *
 * Priority:
 * 1. Explicit modelName with provider
 * 2. Tier-based selection from config (env vars > config file > defaults)
 * 3. Default tier (standard) with default provider
 */
export function resolveModel(options: ModelResolutionOptions = {}): LanguageModel {
  const { tier = 'standard', provider, modelName } = options;
  const config = getConfig();

  // If explicit model name provided with provider
  if (modelName && provider) {
    log.info('Resolving model (explicit)', { provider, modelName });
    return createModelForProvider(provider, modelName);
  }

  // If modelName looks like "provider/model", route through OpenRouter
  if (modelName && modelName.includes('/')) {
    log.info('Resolving model (OpenRouter format)', { modelName });
    return createModelForProvider('openrouter', modelName);
  }

  // Use tier-based selection from config
  const effectiveProvider = provider ?? config.models?.defaultProvider ?? DEFAULT_PROVIDER;
  const effectiveModel = getModelForTier(tier, effectiveProvider);
  log.info('Resolving model (tier-based)', { tier, provider: effectiveProvider, model: effectiveModel });

  return createModelForProvider(effectiveProvider, effectiveModel);
}

// ============================================================================
// Model Info Helpers
// ============================================================================

export function getModelInfo(tier: ModelTier): { provider: ModelProvider; name: string } {
  if (process.env['OLLAMA_ENABLED'] === 'true') {
    return {
      provider: 'ollama',
      name: getOllamaEnvModel(tier) || DEFAULT_MODELS.ollama[tier],
    };
  }
  return {
    provider: 'openrouter',
    name: getEnvModel(tier) || DEFAULT_MODELS.openrouter[tier],
  };
}

export function listAvailableTiers(): ModelTier[] {
  return ['fast', 'standard', 'reasoning', 'powerful'];
}

export function listAvailableProviders(): string[] {
  const builtIn = Object.keys(PROVIDER_CONFIGS);
  const config = getConfig();
  const custom = Object.keys(config.models?.customProviders ?? {});
  return [...new Set([...builtIn, ...custom])];
}

/**
 * Reset provider instances (useful for testing).
 */
export function resetProviders(): void {
  providerInstances.clear();
}
