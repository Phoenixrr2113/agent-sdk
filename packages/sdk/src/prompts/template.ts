/**
 * @fileoverview Template engine for variable substitution in prompts.
 */

import { createLogger } from '@agntk/logger';
import { getConfig } from '../config';

const log = createLogger('@agntk/core:templates');

// ============================================================================
// Types
// ============================================================================

interface TemplateContext {
  [key: string]: string | number | boolean | undefined;
}

// ============================================================================
// Template Engine
// ============================================================================

/**
 * Apply template variables to a string.
 * Replaces {{variableName}} with the value from context.
 *
 * @example
 * applyTemplate('Hello {{name}}!', { name: 'World' })
 * // => 'Hello World!'
 */
export function applyTemplate(template: string, context: TemplateContext = {}): string {
  // Merge config variables with explicit context (explicit takes precedence)
  const config = getConfig();
  const configVars = (config as Record<string, unknown>).templates as { variables?: TemplateContext } | undefined;
  const mergedContext = { ...configVars?.variables, ...context };

  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    const value = mergedContext[varName];
    if (value === undefined) {
      log.debug('Template variable not found', { variable: varName });
      return match; // Leave unreplaced if not found
    }
    return String(value);
  });
}
