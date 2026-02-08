import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter();

export type ModelTier = 'fast' | 'standard' | 'reasoning' | 'powerful';

const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: 'deepseek/deepseek-chat-v3-0324:free',
  standard: 'google/gemini-2.0-flash-001',
  reasoning: 'deepseek/deepseek-r1:free',
  powerful: 'anthropic/claude-sonnet-4',
};

export function getModel(tier: ModelTier = 'standard') {
  const envKey = `MODEL_${tier.toUpperCase()}`;
  const modelName = process.env[envKey] ?? DEFAULT_MODELS[tier];
  return openrouter.chat(modelName);
}

export function getPlanningModel() {
  return getModel('powerful');
}

export function getExecutionModel() {
  return getModel('standard');
}

export function getFastModel() {
  return getModel('fast');
}

export function getReasoningModel() {
  return getModel('reasoning');
}

export function getChatModel() {
  return getModel('standard');
}
