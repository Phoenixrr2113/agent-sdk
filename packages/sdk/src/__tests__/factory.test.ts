/**
 * @fileoverview Tests for ToolFactory, mergeToolSets, filterTools, excludeTools.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolFactory,
  mergeToolSets,
  filterTools,
  excludeTools,
  getToolNames,
  type ToolSet,
  type ToolDependencies,
} from '../tools/factory';

// Stub tools for testing
const stubTool = (name: string) => ({ description: name, execute: async () => name }) as unknown as ToolSet[string];

describe('ToolFactory', () => {
  let factory: ToolFactory;

  beforeEach(() => {
    factory = new ToolFactory();
  });

  describe('register / has / unregister', () => {
    it('should register a creator and report it via has()', () => {
      factory.register('search', () => ({ glob: stubTool('glob') }));
      expect(factory.has('search')).toBe(true);
      expect(factory.has('other')).toBe(false);
    });

    it('should unregister a creator', () => {
      factory.register('search', () => ({ glob: stubTool('glob') }));
      expect(factory.unregister('search')).toBe(true);
      expect(factory.has('search')).toBe(false);
    });

    it('should return false when unregistering a non-existent creator', () => {
      expect(factory.unregister('nope')).toBe(false);
    });
  });

  describe('getRegisteredNames', () => {
    it('should return empty array for fresh factory', () => {
      expect(factory.getRegisteredNames()).toEqual([]);
    });

    it('should list registered creator names', () => {
      factory.register('a', () => ({}));
      factory.register('b', () => ({}));
      expect(factory.getRegisteredNames()).toEqual(['a', 'b']);
    });
  });

  describe('create', () => {
    it('should create tools from a single registered creator', () => {
      factory.register('search', () => ({
        glob: stubTool('glob'),
        grep: stubTool('grep'),
      }));

      const tools = factory.create('search', {});
      expect(tools).not.toBeNull();
      expect(Object.keys(tools!)).toEqual(['glob', 'grep']);
    });

    it('should return null for unregistered creator', () => {
      expect(factory.create('unknown', {})).toBeNull();
    });

    it('should pass dependencies to creator', () => {
      let capturedDeps: ToolDependencies | undefined;
      factory.register('dep-check', (deps) => {
        capturedDeps = deps;
        return {};
      });

      factory.create('dep-check', { workspaceRoot: '/test' });
      expect(capturedDeps?.workspaceRoot).toBe('/test');
    });

    it('should capture errors and return null on throw', () => {
      factory.register('bad', () => {
        throw new Error('boom');
      });

      const result = factory.create('bad', {});
      expect(result).toBeNull();

      const errors = factory.getLastErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].name).toBe('bad');
      expect(errors[0].error).toContain('boom');
    });
  });

  describe('createAll', () => {
    it('should merge tools from all creators', () => {
      factory.register('search', () => ({ glob: stubTool('glob') }));
      factory.register('edit', () => ({ shell: stubTool('shell') }));

      const tools = factory.createAll({});
      expect(Object.keys(tools).sort()).toEqual(['glob', 'shell']);
    });

    it('should skip failing creators and continue', () => {
      factory.register('good', () => ({ ok: stubTool('ok') }));
      factory.register('bad', () => {
        throw new Error('fail');
      });
      factory.register('also-good', () => ({ also: stubTool('also') }));

      const tools = factory.createAll({});
      expect(Object.keys(tools).sort()).toEqual(['also', 'ok']);
      expect(factory.getLastErrors()).toHaveLength(1);
    });

    it('should reset errors on each call', () => {
      factory.register('bad', () => {
        throw new Error('fail');
      });

      factory.createAll({});
      expect(factory.getLastErrors()).toHaveLength(1);

      factory.unregister('bad');
      factory.createAll({});
      expect(factory.getLastErrors()).toHaveLength(0);
    });
  });

  describe('createSelected', () => {
    it('should only create selected creators', () => {
      factory.register('a', () => ({ toolA: stubTool('a') }));
      factory.register('b', () => ({ toolB: stubTool('b') }));
      factory.register('c', () => ({ toolC: stubTool('c') }));

      const tools = factory.createSelected(['a', 'c'], {});
      expect(Object.keys(tools).sort()).toEqual(['toolA', 'toolC']);
    });

    it('should silently skip unregistered names', () => {
      factory.register('a', () => ({ toolA: stubTool('a') }));

      const tools = factory.createSelected(['a', 'missing'], {});
      expect(Object.keys(tools)).toEqual(['toolA']);
    });
  });

  describe('clear', () => {
    it('should remove all factories and errors', () => {
      factory.register('a', () => ({}));
      factory.register('bad', () => {
        throw new Error('x');
      });
      factory.createAll({});

      factory.clear();
      expect(factory.getRegisteredNames()).toEqual([]);
      expect(factory.getLastErrors()).toEqual([]);
    });
  });
});

describe('mergeToolSets', () => {
  it('should merge multiple tool sets', () => {
    const a: ToolSet = { x: stubTool('x') };
    const b: ToolSet = { y: stubTool('y') };
    const merged = mergeToolSets(a, b);
    expect(Object.keys(merged).sort()).toEqual(['x', 'y']);
  });

  it('should override with later sets', () => {
    const a: ToolSet = { x: stubTool('first') };
    const b: ToolSet = { x: stubTool('second') };
    const merged = mergeToolSets(a, b);
    expect((merged.x as { description: string }).description).toBe('second');
  });

  it('should handle empty sets', () => {
    expect(Object.keys(mergeToolSets())).toHaveLength(0);
    expect(Object.keys(mergeToolSets({}))).toHaveLength(0);
  });
});

describe('filterTools', () => {
  it('should keep only included tools', () => {
    const tools: ToolSet = {
      a: stubTool('a'),
      b: stubTool('b'),
      c: stubTool('c'),
    };
    const filtered = filterTools(tools, ['a', 'c']);
    expect(Object.keys(filtered).sort()).toEqual(['a', 'c']);
  });

  it('should return empty if none match', () => {
    const tools: ToolSet = { a: stubTool('a') };
    expect(Object.keys(filterTools(tools, ['z']))).toHaveLength(0);
  });
});

describe('excludeTools', () => {
  it('should remove excluded tools', () => {
    const tools: ToolSet = {
      a: stubTool('a'),
      b: stubTool('b'),
      c: stubTool('c'),
    };
    const result = excludeTools(tools, ['b']);
    expect(Object.keys(result).sort()).toEqual(['a', 'c']);
  });

  it('should return all if none excluded', () => {
    const tools: ToolSet = { a: stubTool('a'), b: stubTool('b') };
    expect(Object.keys(excludeTools(tools, []))).toHaveLength(2);
  });
});

describe('getToolNames', () => {
  it('should return keys of a tool set', () => {
    const tools: ToolSet = { alpha: stubTool('alpha'), beta: stubTool('beta') };
    expect(getToolNames(tools).sort()).toEqual(['alpha', 'beta']);
  });

  it('should return empty for empty set', () => {
    expect(getToolNames({})).toEqual([]);
  });
});
