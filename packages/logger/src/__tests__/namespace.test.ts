/**
 * @agent/logger - Namespace Matching Tests
 */

import { describe, it, expect } from 'vitest';
import {
  parseDebugEnv,
  matchesPattern,
  isNamespaceEnabled,
  childNamespace,
} from '../namespace';

describe('parseDebugEnv', () => {
  it('should return empty arrays for undefined', () => {
    const result = parseDebugEnv(undefined);
    expect(result).toEqual({ enabled: [], excluded: [] });
  });

  it('should return empty arrays for empty string', () => {
    const result = parseDebugEnv('');
    expect(result).toEqual({ enabled: [], excluded: [] });
  });

  it('should parse single pattern', () => {
    const result = parseDebugEnv('@agent/*');
    expect(result).toEqual({ enabled: ['@agent/*'], excluded: [] });
  });

  it('should parse multiple comma-separated patterns', () => {
    const result = parseDebugEnv('@agent/sdk,@agent/logger');
    expect(result).toEqual({
      enabled: ['@agent/sdk', '@agent/logger'],
      excluded: [],
    });
  });

  it('should parse multiple space-separated patterns', () => {
    const result = parseDebugEnv('@agent/sdk @agent/logger');
    expect(result).toEqual({
      enabled: ['@agent/sdk', '@agent/logger'],
      excluded: [],
    });
  });

  it('should identify excluded patterns with - prefix', () => {
    const result = parseDebugEnv('*,-@agent/verbose');
    expect(result).toEqual({
      enabled: ['*'],
      excluded: ['@agent/verbose'],
    });
  });

  it('should handle mixed enabled and excluded', () => {
    const result = parseDebugEnv('@agent/*,-@agent/sdk:trace,-@agent/internal');
    expect(result).toEqual({
      enabled: ['@agent/*'],
      excluded: ['@agent/sdk:trace', '@agent/internal'],
    });
  });
});

describe('matchesPattern', () => {
  it('should return false for empty patterns', () => {
    expect(matchesPattern('@agent/sdk', [])).toBe(false);
  });

  it('should match exact namespace', () => {
    expect(matchesPattern('@agent/sdk', ['@agent/sdk'])).toBe(true);
    expect(matchesPattern('@agent/sdk', ['@agent/logger'])).toBe(false);
  });

  it('should match wildcard at end', () => {
    expect(matchesPattern('@agent/sdk', ['@agent/*'])).toBe(true);
    expect(matchesPattern('@agent/logger', ['@agent/*'])).toBe(true);
    expect(matchesPattern('other/module', ['@agent/*'])).toBe(false);
  });

  it('should match nested namespaces with wildcard', () => {
    expect(matchesPattern('@agent/sdk:agent', ['@agent/sdk:*'])).toBe(true);
    expect(matchesPattern('@agent/sdk:agent:tool', ['@agent/sdk:*'])).toBe(true);
  });

  it('should match global wildcard', () => {
    expect(matchesPattern('@agent/sdk', ['*'])).toBe(true);
    expect(matchesPattern('anything', ['*'])).toBe(true);
  });

  it('should match any of multiple patterns', () => {
    expect(matchesPattern('@agent/sdk', ['@agent/sdk', '@agent/logger'])).toBe(true);
    expect(matchesPattern('@agent/logger', ['@agent/sdk', '@agent/logger'])).toBe(true);
    expect(matchesPattern('@agent/other', ['@agent/sdk', '@agent/logger'])).toBe(false);
  });
});

describe('isNamespaceEnabled', () => {
  it('should return false if no enabled patterns', () => {
    const result = isNamespaceEnabled('@agent/sdk', {
      enabledPatterns: [],
      excludedPatterns: [],
    });
    expect(result).toBe(false);
  });

  it('should return true if matches enabled pattern', () => {
    const result = isNamespaceEnabled('@agent/sdk', {
      enabledPatterns: ['@agent/*'],
      excludedPatterns: [],
    });
    expect(result).toBe(true);
  });

  it('should return false if matches excluded pattern', () => {
    const result = isNamespaceEnabled('@agent/verbose', {
      enabledPatterns: ['@agent/*'],
      excludedPatterns: ['@agent/verbose'],
    });
    expect(result).toBe(false);
  });

  it('should exclude before enable', () => {
    const result = isNamespaceEnabled('@agent/sdk:trace', {
      enabledPatterns: ['*'],
      excludedPatterns: ['@agent/sdk:trace'],
    });
    expect(result).toBe(false);
  });

  it('should enable if not in excluded', () => {
    const result = isNamespaceEnabled('@agent/sdk:info', {
      enabledPatterns: ['*'],
      excludedPatterns: ['@agent/sdk:trace'],
    });
    expect(result).toBe(true);
  });
});

describe('childNamespace', () => {
  it('should join parent and child with colon', () => {
    expect(childNamespace('@agent/sdk', 'agent')).toBe('@agent/sdk:agent');
  });

  it('should support multiple levels', () => {
    const level1 = childNamespace('@agent/sdk', 'agent');
    const level2 = childNamespace(level1, 'tool');
    expect(level2).toBe('@agent/sdk:agent:tool');
  });
});
