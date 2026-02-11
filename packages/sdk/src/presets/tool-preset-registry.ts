/**
 * @fileoverview Tool Preset Registry - manages built-in and custom presets.
 */

import { createLogger } from '@agntk/logger';
import { getConfig } from '../config';

const log = createLogger('@agntk/core:presets');

// ============================================================================
// Types
// ============================================================================

export interface ToolPresetDefinition {
  /** Tools to include */
  include?: string[];
  /** Tools to exclude (applied after include) */
  exclude?: string[];
  /** Description of this preset */
  description?: string;
}

// ============================================================================
// Registry State
// ============================================================================

const presetRegistry = new Map<string, ToolPresetDefinition>();
let configPresetsLoaded = false;

// ============================================================================
// Built-in Presets
// ============================================================================

const BUILT_IN_PRESETS: Record<string, ToolPresetDefinition> = {
  none: {
    include: [],
    description: 'No tools',
  },
  minimal: {
    include: ['glob'],
    description: 'Glob for file search only',
  },
  standard: {
    include: ['glob', 'grep', 'shell', 'plan', 'deep_reasoning'],
    description: 'Glob, grep, shell, plan, deep_reasoning',
  },
  full: {
    include: ['glob', 'grep', 'shell', 'plan', 'deep_reasoning', 'ast_grep_search', 'ast_grep_replace'],
    description: 'All standard tools plus AST-grep',
  },
  readonly: {
    include: ['glob', 'grep', 'deep_reasoning'],
    exclude: ['shell'],
    description: 'Read-only tools without shell access',
  },
};

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Register a preset in the registry.
 */
export function registerPreset(name: string, definition: ToolPresetDefinition): void {
  log.debug('Registering preset', { name, include: definition.include?.length ?? 0 });
  presetRegistry.set(name, definition);
}

/**
 * Get a preset from the registry.
 */
export function getPreset(name: string): ToolPresetDefinition {
  loadConfigPresets();
  
  // Check registry first
  if (presetRegistry.has(name)) {
    return presetRegistry.get(name)!;
  }
  
  // Fall back to built-in
  if (name in BUILT_IN_PRESETS) {
    return BUILT_IN_PRESETS[name];
  }
  
  // Default to standard
  log.warn('Unknown preset, using standard', { preset: name });
  return BUILT_IN_PRESETS.standard;
}

/**
 * Get all registered preset names.
 */
export function getAllPresetNames(): string[] {
  loadConfigPresets();
  const builtIn = Object.keys(BUILT_IN_PRESETS);
  const custom = Array.from(presetRegistry.keys());
  return [...new Set([...builtIn, ...custom])];
}

/**
 * Check if a preset exists.
 */
export function hasPreset(name: string): boolean {
  loadConfigPresets();
  return presetRegistry.has(name) || name in BUILT_IN_PRESETS;
}

// ============================================================================
// Config Loading
// ============================================================================

function loadConfigPresets(): void {
  if (configPresetsLoaded) return;
  configPresetsLoaded = true;
  
  const config = getConfig();
  const presets = (config as Record<string, unknown>).toolPresets as Record<string, ToolPresetDefinition> | undefined;
  
  if (!presets) return;
  
  for (const [name, presetConfig] of Object.entries(presets)) {
    if (!presetConfig) continue;
    
    log.info('Loading preset from config', { name });
    registerPreset(name, presetConfig);
  }
}

/**
 * Reset the registry (for testing).
 */
export function resetPresetRegistry(): void {
  presetRegistry.clear();
  configPresetsLoaded = false;
}

export { BUILT_IN_PRESETS };
