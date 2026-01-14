/**
 * @agent/sdk - Tools Module
 *
 * Central export for tool factory, provider, and utilities.
 */

// Factory
export {
  ToolFactory,
  defaultToolFactory,
  mergeToolSets,
  filterTools,
  excludeTools,
  getToolNames,
  type ToolDependencies,
  type ToolSet,
  type ToolCreator,
} from './factory';

// Provider
export {
  createAllTools,
  createToolActivationManager,
  createToolRegistry,
  instrumentTools,
  CORE_TOOL_NAMES,
  type CoreToolName,
  type ToolProviderConfig,
  type ToolProviderResult,
  type ToolActivationManager,
  type ToolRegistry,
  type ToolRegistryEntry,
} from './provider';

// Glob Tool
export {
  globTool,
  createGlobTool,
  runRgFiles,
  formatGlobResult,
  type GlobOptions,
  type GlobResult,
  type FileMatch,
} from './glob';

// Grep Tool
export {
  grepTool,
  createGrepTool,
  runRg,
  runRgCount,
  formatGrepResult,
  formatCountResult,
  downloadAndInstallRipgrep,
  type GrepOptions,
  type GrepMatch,
  type GrepResult,
  type CountResult,
} from './grep';

// AST-Grep Tool
export {
  astGrepSearchTool,
  astGrepReplaceTool,
  createAstGrepTools,
  runSg,
  ensureAstGrepBinary,
  formatSearchResult,
  formatReplaceResult,
  type CliLanguage,
  type CliMatch,
  type SgResult,
  type SearchMatch,
} from './ast-grep';

// Shell Tool
export {
  createShellTool,
  shellTool,
  executeShellCommand,
  addToAllowlist,
  clearAllowlist,
  getAllowlist,
  SHELL_DESCRIPTION,
  DEFAULT_TIMEOUT,
  MAX_TIMEOUT,
  INTERACTIVE_COMMANDS,
  type ShellInput,
  type ShellResult,
} from './shell';

// Plan Tool
export {
  createPlanTool,
  planTool,
  validationTool,
  executePlan,
  executeValidation,
  toolGroups,
  runTypeCheck,
  runTestCommand,
  MAX_PLAN_STEPS,
  DELEGATION_THRESHOLD,
  PLAN_DESCRIPTION,
  VALIDATION_DESCRIPTION,
  AVAILABLE_AGENTS,
  type Plan,
  type PlanStep,
  type PlanToolConfig,
  type ScopeAssessment,
  type PendingDecision,
  type PlanInput,
  type ValidationInput,
  type ValidationResult,
} from './plan';

// Deep Reasoning Tool
export {
  createDeepReasoningTool,
  deepReasoningTool,
  DeepReasoningEngine,
  configureDeepReasoning,
  isDeepReasoningEnabled,
  getDeepReasoningEngine,
  resetDeepReasoningEngine,
  DEEP_REASONING_DESCRIPTION,
  UNRESTRICTED_MODE_DESCRIPTION,
  DEFAULT_MAX_HISTORY,
  DEFAULT_MAX_BRANCH_SIZE,
  type ThoughtData,
  type ReasoningResult,
  type DeepReasoningConfig,
  type DeepReasoningInput,
} from './deep-reasoning';

// Spawn Agent Tool
export { createSpawnAgentTool } from './spawn-agent';
