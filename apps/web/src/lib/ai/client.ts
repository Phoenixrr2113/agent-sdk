import { resolveModel, type ModelTier } from '@agent/sdk';

export type { ModelTier } from '@agent/sdk';

export function getModel(tier: ModelTier = 'standard') {
  return resolveModel({ tier });
}

export function getPlanningModel() {
  return resolveModel({ tier: 'powerful' });
}

export function getExecutionModel() {
  return resolveModel({ tier: 'standard' });
}

export function getFastModel() {
  return resolveModel({ tier: 'fast' });
}

export function getReasoningModel() {
  return resolveModel({ tier: 'reasoning' });
}

export function getChatModel() {
  return resolveModel({ tier: 'standard' });
}
