/**
 * @fileoverview Configuration exports.
 */

export {
  // Schema types
  type AgentConfig,
  type PartialAgentConfig,
  type ModelsConfig,
  type RoleConfig,
  type ModelTier,
  type Provider,
  type CustomProvider,
  AgentConfigSchema,
  PartialAgentConfigSchema,
  ModelsConfigSchema,
  ModelTierSchema,
  ProviderSchema,
  CustomProviderSchema,
} from './schema';

export {
  // Loader functions
  loadConfig,
  getConfig,
  configure,
  resetConfig,
  getModelForTier,
  defineConfig,
  getToolConfig,
  getServerConfig,
  getClientConfig,
} from './loader';

export {
  // Defaults
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  DEFAULT_MAX_STEPS,
  DEFAULT_WORKSPACE_ROOT,
} from './defaults';
