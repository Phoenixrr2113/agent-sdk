/**
 * @agent/sdk - Model Configuration
 *
 * Model tier definitions supporting multiple providers.
 * Now uses config system for customizable model mappings.
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { createOllama } from 'ollama-ai-provider-v2';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createLogger } from '@agent/logger';
import { getModelForTier, getConfig, DEFAULT_MODELS, DEFAULT_PROVIDER } from './config';
import type { LanguageModel } from 'ai';

const log = createLogger('@agent/sdk:models');

// Re-export defaults for backward compatibility
export { DEFAULT_MODELS as defaultModels };

// ============================================================================
// Provider Instances (Lazy Initialization)
// ============================================================================

let _openrouter: ReturnType<typeof createOpenRouter> | null = null;
let _ollama: ReturnType<typeof createOllama> | null = null;
let _openai: ReturnType<typeof createOpenAI> | null = null;
let _anthropic: ReturnType<typeof createAnthropic> | null = null;

function getOpenRouter() {
  if (!_openrouter) {
    log.debug('Initializing OpenRouter provider');
    _openrouter = createOpenRouter();
  }
  return _openrouter;
}

function getOllama() {
  if (!_ollama) {
    const baseURL = process.env['OLLAMA_BASE_URL'] || 'http://localhost:11434/api';
    log.debug('Initializing Ollama provider', { baseURL });
    _ollama = createOllama({ baseURL });
  }
  return _ollama;
}

function getOpenAI() {
  if (!_openai) {
    log.debug('Initializing OpenAI provider');
    _openai = createOpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }
  return _openai;
}

function getAnthropic() {
  if (!_anthropic) {
    log.debug('Initializing Anthropic provider');
    _anthropic = createAnthropic({
      apiKey: process.env['ANTHROPIC_API_KEY'],
    });
  }
  return _anthropic;
}

// ============================================================================
// Model Tier Types
// ============================================================================

export type ModelTier = 'fast' | 'standard' | 'reasoning' | 'powerful';
export type ModelProvider = 'openrouter' | 'ollama' | 'openai' | 'anthropic';

export interface ModelConfig {
  provider: ModelProvider;
  name: string;
}

// NOTE: Default model mappings are now in config/defaults.ts
// Re-exported as 'defaultModels' above for backward compatibility

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

// Note: Type assertion needed due to version mismatch between stable providers
// and AI SDK 6.0.0-beta. Provider packages use @ai-sdk/provider@3.0.2 while
// beta uses @ai-sdk/provider@3.0.0-beta.20. The runtime behavior is compatible.
function createModelForProvider(
  provider: ModelProvider,
  modelName: string
): LanguageModel {
  switch (provider) {
    case 'openrouter':
      return getOpenRouter().chat(modelName) as unknown as LanguageModel;
    case 'ollama':
      return getOllama()(modelName) as unknown as LanguageModel;
    case 'openai':
      return getOpenAI()(modelName) as unknown as LanguageModel;
    case 'anthropic':
      return getAnthropic()(modelName) as unknown as LanguageModel;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// ============================================================================
// Model Tier Functions
// ============================================================================

export const models = {
  fast: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('fast') || DEFAULT_MODELS.ollama.fast;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('fast') || DEFAULT_MODELS.openrouter.fast;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  standard: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('standard') || DEFAULT_MODELS.ollama.standard;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('standard') || DEFAULT_MODELS.openrouter.standard;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  reasoning: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('reasoning') || DEFAULT_MODELS.ollama.reasoning;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('reasoning') || DEFAULT_MODELS.openrouter.reasoning;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
  },

  powerful: (): LanguageModel => {
    if (process.env['OLLAMA_ENABLED'] === 'true') {
      const modelName = getOllamaEnvModel('powerful') || DEFAULT_MODELS.ollama.powerful;
      return getOllama()(modelName) as unknown as LanguageModel;
    }
    const modelName = getEnvModel('powerful') || DEFAULT_MODELS.openrouter.powerful;
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
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

  // If modelName looks like "provider/model"
  if (modelName && modelName.includes('/')) {
    log.info('Resolving model (OpenRouter format)', { modelName });
    return getOpenRouter().chat(modelName) as unknown as LanguageModel;
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

export function listAvailableProviders(): ModelProvider[] {
  return ['openrouter', 'ollama', 'openai', 'anthropic'];
}
