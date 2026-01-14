/**
 * @fileoverview Namespace matching for debug filtering.
 * Supports wildcards and exclusions like the `debug` npm package.
 */

import type { DebugConfig } from './types';

/**
 * Parse DEBUG environment variable into patterns.
 */
export function parseDebugEnv(debug: string | undefined): {
  enabled: string[];
  excluded: string[];
} {
  if (!debug) {
    return { enabled: [], excluded: [] };
  }

  const enabled: string[] = [];
  const excluded: string[] = [];

  const patterns = debug.split(/[\s,]+/).filter(Boolean);
  
  for (const pattern of patterns) {
    if (pattern.startsWith('-')) {
      excluded.push(pattern.slice(1));
    } else {
      enabled.push(pattern);
    }
  }

  return { enabled, excluded };
}

/**
 * Convert a glob-like pattern to a RegExp.
 */
function patternToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Check if a namespace matches any of the given patterns.
 */
export function matchesPattern(namespace: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  return patterns.some(pattern => patternToRegex(pattern).test(namespace));
}

/**
 * Check if a namespace is enabled based on config.
 */
export function isNamespaceEnabled(
  namespace: string,
  config: Pick<DebugConfig, 'enabledPatterns' | 'excludedPatterns'>
): boolean {
  if (config.enabledPatterns.length === 0) return false;
  if (matchesPattern(namespace, config.excludedPatterns)) return false;
  return matchesPattern(namespace, config.enabledPatterns);
}

/**
 * Create a child namespace.
 */
export function childNamespace(parent: string, child: string): string {
  return `${parent}:${child}`;
}
