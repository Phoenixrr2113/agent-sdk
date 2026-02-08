/**
 * @fileoverview Tool presets for different agent configurations.
 * Provides none, minimal, standard, and full tool sets.
 */

import { createGlobTool } from '../tools/glob';
import { createGrepTool } from '../tools/grep';
import { createAstGrepTools } from '../tools/ast-grep';
import { createShellTool } from '../tools/shell';
import { createPlanTool, type PlanToolConfig } from '../tools/plan';
import { createDeepReasoningTool } from '../tools/deep-reasoning';
import { createBrowserTool } from '../tools/browser';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type ToolPresetLevel = 'none' | 'minimal' | 'standard' | 'full';

export interface ToolPresetOptions {
  /** Override default workspace root */
  workspaceRoot?: string;
  /** Plan tool config */
  planConfig?: PlanToolConfig;
  /** Additional custom tools to include */
  customTools?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Definitions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create tool presets based on the selected level.
 */
export function createToolPreset(
  preset: ToolPresetLevel,
  options: ToolPresetOptions = {}
) {
  const {
    workspaceRoot = process.cwd(),
    planConfig,
    customTools = {},
  } = options;

  switch (preset) {
    case 'none':
      return { ...customTools };

    case 'minimal':
      return {
        ...createMinimalPreset(),
        ...customTools,
      };

    case 'standard':
      return {
        ...createStandardPreset(workspaceRoot, planConfig),
        ...customTools,
      };

    case 'full':
      return {
        ...createFullPreset(workspaceRoot, planConfig),
        ...customTools,
      };

    default:
      throw new Error(`Unknown tool preset: ${preset}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Preset Implementations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Minimal preset: Glob for file search.
 * Good for pure analysis tasks without mutations.
 */
function createMinimalPreset() {
  return createGlobTool();
}

/**
 * Standard preset: Glob, grep, shell, plan, deep_reasoning.
 * Good for most development tasks.
 */
function createStandardPreset(workspaceRoot: string, planConfig?: PlanToolConfig) {
  const shell = createShellTool(workspaceRoot);
  const plan = createPlanTool(planConfig ?? {});
  const deep_reasoning = createDeepReasoningTool();

  return {
    ...createGlobTool(),
    ...createGrepTool(),
    shell,
    plan,
    deep_reasoning,
  };
}

/**
 * Full preset: All standard tools + AST-grep for structural code search.
 * Good for complex, multi-agent tasks.
 */
function createFullPreset(workspaceRoot: string, planConfig?: PlanToolConfig) {
  return {
    ...createStandardPreset(workspaceRoot, planConfig),
    ...createAstGrepTools(),
    browser: createBrowserTool(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Static Presets (for quick reference)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Static preset definitions for reference.
 * Use createToolPreset() for actual tool creation.
 */
export const toolPresets = {
  none: {} as Record<string, never>,

  minimal: {
    description: 'Glob file search only',
    tools: ['glob'],
  },

  standard: {
    description: 'Glob, grep, shell, plan, deep_reasoning',
    tools: ['glob', 'grep', 'shell', 'plan', 'deep_reasoning'],
  },

  full: {
    description: 'All standard tools plus AST-grep and browser automation',
    tools: ['glob', 'grep', 'shell', 'plan', 'deep_reasoning', 'ast_grep_search', 'ast_grep_replace', 'browser'],
  },
} as const;

/**
 * Get tool names included in a preset.
 */
export function getPresetToolNames(preset: ToolPresetLevel): string[] {
  if (preset === 'none') return [];
  const presetDef = toolPresets[preset];
  return 'tools' in presetDef ? [...presetDef.tools] : [];
}
