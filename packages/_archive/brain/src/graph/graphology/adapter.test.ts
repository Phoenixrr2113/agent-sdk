/**
 * @fileoverview Tests for GraphologyAdapter — QueryPort implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GraphologyAdapter } from './adapter';
import type { FileEntity, FunctionEntity, ClassEntity, InterfaceEntity, VariableEntity, TypeEntity, ComponentEntity, CommitEntity, ProjectEntity } from '../../types';

// Helper factories
function makeFile(path: string): FileEntity {
  return { path, name: path.split('/').pop()!, extension: '.ts', loc: 100, lastModified: '2025-01-01', hash: 'abc123' };
}

function makeFunction(name: string, filePath: string, opts: Partial<FunctionEntity> = {}): FunctionEntity {
  return {
    name, filePath, startLine: 1, endLine: 10, isExported: true, isAsync: false, isArrow: false,
    params: [], ...opts,
  };
}

function makeClass(name: string, filePath: string): ClassEntity {
  return { name, filePath, startLine: 1, endLine: 50, isExported: true, isAbstract: false };
}

function makeInterface(name: string, filePath: string): InterfaceEntity {
  return { name, filePath, startLine: 1, endLine: 20, isExported: true };
}

function makeVariable(name: string, filePath: string): VariableEntity {
  return { name, filePath, line: 1, kind: 'const', isExported: true };
}

function makeType(name: string, filePath: string): TypeEntity {
  return { name, filePath, startLine: 1, endLine: 5, isExported: true, kind: 'type' };
}

function makeComponent(name: string, filePath: string): ComponentEntity {
  return { name, filePath, startLine: 1, endLine: 30, isExported: true };
}

describe('GraphologyAdapter', () => {
  let adapter: GraphologyAdapter;

  beforeEach(() => {
    adapter = new GraphologyAdapter();
  });

  // ── Node Upserts ──────────────────────────────────────────────────────

  describe('upsertFile', () => {
    it('should add a file node to the graph', async () => {
      await adapter.upsertFile(makeFile('/src/index.ts'));
      expect(adapter.graph.order).toBe(1);
      expect(adapter.graph.hasNode('File:/src/index.ts')).toBe(true);
    });

    it('should update an existing file node', async () => {
      await adapter.upsertFile(makeFile('/src/index.ts'));
      await adapter.upsertFile({ ...makeFile('/src/index.ts'), loc: 200 });
      expect(adapter.graph.order).toBe(1);
      expect(adapter.graph.getNodeAttribute('File:/src/index.ts', 'loc')).toBe(200);
    });
  });

  describe('upsertFunction', () => {
    it('should add a function and CONTAINS edge', async () => {
      await adapter.upsertFile(makeFile('/src/app.ts'));
      await adapter.upsertFunction(makeFunction('greet', '/src/app.ts'));
      expect(adapter.graph.order).toBe(2);
      expect(adapter.graph.size).toBeGreaterThanOrEqual(1); // CONTAINS edge
    });
  });

  describe('upsertClass / upsertInterface / upsertVariable / upsertType / upsertComponent', () => {
    it('should add each entity type with CONTAINS edge', async () => {
      await adapter.upsertFile(makeFile('/src/mod.ts'));
      await adapter.upsertClass(makeClass('Foo', '/src/mod.ts'));
      await adapter.upsertInterface(makeInterface('IBar', '/src/mod.ts'));
      await adapter.upsertVariable(makeVariable('MAX', '/src/mod.ts'));
      await adapter.upsertType(makeType('Config', '/src/mod.ts'));
      await adapter.upsertComponent(makeComponent('Button', '/src/mod.ts'));
      // 1 file + 5 entities = 6 nodes
      expect(adapter.graph.order).toBe(6);
      // 5 CONTAINS edges
      expect(adapter.graph.size).toBe(5);
    });
  });

  // ── Edge Creation ─────────────────────────────────────────────────────

  describe('createCallEdge', () => {
    it('should create a CALLS edge between functions', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('caller', '/src/a.ts'));
      await adapter.upsertFunction(makeFunction('callee', '/src/a.ts'));
      await adapter.createCallEdge('caller', '/src/a.ts', 'callee', '/src/a.ts', 5);

      // 1 file + 2 functions = 3 nodes, 2 CONTAINS + 1 CALLS = 3 edges
      expect(adapter.graph.size).toBe(3);
    });

    it('should increment count on duplicate call edges', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('a', '/src/a.ts'));
      await adapter.upsertFunction(makeFunction('b', '/src/a.ts'));
      await adapter.createCallEdge('a', '/src/a.ts', 'b', '/src/a.ts', 1);
      await adapter.createCallEdge('a', '/src/a.ts', 'b', '/src/a.ts', 2);

      const edges = adapter.graph.edges();
      const callEdge = edges.find((e) => adapter.graph.getEdgeAttribute(e, '__type') === 'CALLS');
      expect(callEdge).toBeTruthy();
      expect(adapter.graph.getEdgeAttribute(callEdge!, 'count')).toBe(2);
    });
  });

  describe('createImportsEdge', () => {
    it('should create IMPORTS edge and auto-create external file', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.createImportsEdge('/src/a.ts', '/src/b.ts', ['foo']);

      expect(adapter.graph.hasNode('File:/src/b.ts')).toBe(true);
      expect(adapter.graph.getNodeAttribute('File:/src/b.ts', 'external')).toBe(true);
      expect(adapter.graph.size).toBe(1); // 1 IMPORTS edge
    });
  });

  describe('createExtendsEdge', () => {
    it('should create EXTENDS edge', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertClass(makeClass('Child', '/src/a.ts'));
      await adapter.upsertClass(makeClass('Parent', '/src/a.ts'));
      await adapter.createExtendsEdge('Child', '/src/a.ts', 'Parent', '/src/a.ts');

      const edges = adapter.graph.edges();
      const extendsEdge = edges.find((e) => adapter.graph.getEdgeAttribute(e, '__type') === 'EXTENDS');
      expect(extendsEdge).toBeTruthy();
    });

    it('should auto-create external parent', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertClass(makeClass('Child', '/src/a.ts'));
      await adapter.createExtendsEdge('Child', '/src/a.ts', 'ExternalBase');

      // External parent should be created
      const nodes = adapter.graph.nodes();
      const external = nodes.find((n) => adapter.graph.getNodeAttribute(n, 'external') === true);
      expect(external).toBeTruthy();
    });
  });

  describe('createImplementsEdge', () => {
    it('should create IMPLEMENTS edge', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertClass(makeClass('MyClass', '/src/a.ts'));
      await adapter.upsertInterface(makeInterface('MyInterface', '/src/a.ts'));
      await adapter.createImplementsEdge('MyClass', '/src/a.ts', 'MyInterface', '/src/a.ts');

      const edges = adapter.graph.edges();
      const implEdge = edges.find((e) => adapter.graph.getEdgeAttribute(e, '__type') === 'IMPLEMENTS');
      expect(implEdge).toBeTruthy();
    });
  });

  // ── Delete / Clear ────────────────────────────────────────────────────

  describe('deleteFileEntities', () => {
    it('should remove file and all contained entities', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn2', '/src/a.ts'));
      expect(adapter.graph.order).toBe(3);

      await adapter.deleteFileEntities('/src/a.ts');
      expect(adapter.graph.order).toBe(0);
    });

    it('should be a no-op for non-existent file', async () => {
      await adapter.deleteFileEntities('/nonexistent.ts');
      expect(adapter.graph.order).toBe(0);
    });
  });

  describe('clearAll', () => {
    it('should remove everything', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.clearAll();
      expect(adapter.graph.order).toBe(0);
      expect(adapter.graph.size).toBe(0);
    });
  });

  // ── Batch Upsert ──────────────────────────────────────────────────────

  describe('batchUpsert', () => {
    it('should upsert all entities and edges from a parsed file', async () => {
      await adapter.batchUpsert({
        file: makeFile('/src/batch.ts'),
        functions: [makeFunction('fn1', '/src/batch.ts')],
        classes: [makeClass('Cls1', '/src/batch.ts')],
        interfaces: [],
        variables: [makeVariable('VAR1', '/src/batch.ts')],
        types: [],
        components: [],
        imports: [],
        callEdges: [],
        importsEdges: [{ fromFilePath: '/src/batch.ts', toFilePath: '/src/dep.ts' }],
        extendsEdges: [],
        implementsEdges: [],
        rendersEdges: [],
      });

      // 1 file + 1 function + 1 class + 1 variable + 1 external dep = 5 nodes
      expect(adapter.graph.order).toBe(5);
    });
  });

  // ── Project Operations ────────────────────────────────────────────────

  describe('project operations', () => {
    const project: ProjectEntity = {
      id: 'proj-1', name: 'Test Project', rootPath: '/src',
      createdAt: '2025-01-01', lastParsed: '2025-01-02', fileCount: 5,
    };

    it('should upsert and retrieve projects', async () => {
      await adapter.upsertProject(project);
      const projects = await adapter.getProjects();
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Test Project');
    });

    it('should find project by root', async () => {
      await adapter.upsertProject(project);
      const found = await adapter.getProjectByRoot('/src');
      expect(found).not.toBeNull();
      expect(found!.id).toBe('proj-1');
    });

    it('should return null for unknown root', async () => {
      const found = await adapter.getProjectByRoot('/unknown');
      expect(found).toBeNull();
    });

    it('should delete project and cascade to files', async () => {
      await adapter.upsertProject(project);
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.linkProjectFile('proj-1', '/src/a.ts');
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));

      await adapter.deleteProject('proj-1');
      // Project node, file node, function node should all be gone
      expect(adapter.graph.order).toBe(0);
    });
  });

  // ── Commit Operations ─────────────────────────────────────────────────

  describe('commit operations', () => {
    it('should upsert commit and create MODIFIED_IN edge', async () => {
      const commit: CommitEntity = { hash: 'abc123', message: 'fix bug', author: 'dev', email: 'dev@test.com', date: '2025-01-01' };
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertCommit(commit);
      await adapter.createModifiedInEdge('/src/a.ts', 'abc123', 10, 5, 2);

      const edges = adapter.graph.edges();
      const modEdge = edges.find((e) => adapter.graph.getEdgeAttribute(e, '__type') === 'MODIFIED_IN');
      expect(modEdge).toBeTruthy();
      expect(adapter.graph.getEdgeAttribute(modEdge!, 'linesAdded')).toBe(10);
    });
  });

  // ── Episode Operations ────────────────────────────────────────────────

  describe('episode operations', () => {
    const episode = {
      id: 'ep-1', timestamp: '2025-01-01T00:00:00Z', type: 'observation' as const,
      summary: 'Found a bug', content: 'Detailed bug description',
      entities: ['FileA'], relationships: ['CONTAINS'],
    };

    it('should upsert and query episodes', async () => {
      await adapter.upsertEpisode(episode);
      const results = await adapter.getEpisodesByQuery('bug', 10);
      expect(results).toHaveLength(1);
      expect(results[0].summary).toBe('Found a bug');
    });

    it('should get episode by id', async () => {
      await adapter.upsertEpisode(episode);
      const results = await adapter.getEpisodeById('ep-1');
      expect(results).toHaveLength(1);
    });

    it('should return empty for unknown episode', async () => {
      const results = await adapter.getEpisodeById('unknown');
      expect(results).toHaveLength(0);
    });

    it('should count episodes', async () => {
      await adapter.upsertEpisode(episode);
      await adapter.upsertEpisode({ ...episode, id: 'ep-2', timestamp: '2025-01-02T00:00:00Z', summary: 'Another' });
      expect(await adapter.countEpisodes()).toBe(2);
    });

    it('should prune old episodes', async () => {
      await adapter.upsertEpisode({ ...episode, id: 'ep-old', timestamp: '2024-01-01T00:00:00Z' });
      await adapter.upsertEpisode({ ...episode, id: 'ep-new', timestamp: '2025-06-01T00:00:00Z' });
      const pruned = await adapter.pruneOldEpisodes(1);
      expect(pruned).toBe(1);
      expect(await adapter.countEpisodes()).toBe(1);
    });
  });

  // ── Entity Resolution ─────────────────────────────────────────────────

  describe('entity resolution', () => {
    it('should upsert alias and create ALIAS_OF edge', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('myFunc', '/src/a.ts'));
      await adapter.upsertEntityAlias({ name: 'my_func', source: 'test', confidence: 0.9, lastUpdated: '2025-01-01' });
      await adapter.createAliasOfEdge('my_func', 'myFunc');

      const aliases = await adapter.getEntityAliases('myFunc');
      expect(aliases).toHaveLength(1);
    });

    it('should find canonical entity from alias', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('myFunc', '/src/a.ts'));
      await adapter.upsertEntityAlias({ name: 'alias1', source: 'test', confidence: 0.9, lastUpdated: '2025-01-01' });
      await adapter.createAliasOfEdge('alias1', 'myFunc');

      const canonical = await adapter.findCanonicalEntity('alias1');
      expect(canonical).toHaveLength(1);
    });
  });

  // ── Contradiction ─────────────────────────────────────────────────────

  describe('contradiction', () => {
    it('should track and resolve contradictions', async () => {
      await adapter.upsertContradiction({
        id: 'c1', detectedAt: '2025-01-01',
        resolution_winner: null, resolution_reasoning: null,
        factA_id: 'f1', factA_statement: 'X is true', factA_source: 's1', factA_timestamp: '2025-01-01',
        factB_id: 'f2', factB_statement: 'X is false', factB_source: 's2', factB_timestamp: '2025-01-01',
      });

      let unresolved = await adapter.getUnresolvedContradictions();
      expect(unresolved).toHaveLength(1);

      await adapter.resolveContradiction('c1', 'factA', 'More recent source');
      unresolved = await adapter.getUnresolvedContradictions();
      expect(unresolved).toHaveLength(0);
    });
  });

  // ── Read Queries ──────────────────────────────────────────────────────

  describe('getFullGraph', () => {
    it('should return all code entities', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.upsertClass(makeClass('Cls1', '/src/a.ts'));

      const graph = await adapter.getFullGraph();
      expect(graph.nodes.length).toBe(3);
      expect(graph.edges.length).toBeGreaterThan(0);
    });

    it('should filter by rootPath', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFile(makeFile('/lib/b.ts'));

      const graph = await adapter.getFullGraph(100, '/src');
      expect(graph.nodes.length).toBe(1);
    });

    it('should respect limit', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFile(makeFile('/src/b.ts'));
      await adapter.upsertFile(makeFile('/src/c.ts'));

      const graph = await adapter.getFullGraph(2);
      expect(graph.nodes.length).toBeLessThanOrEqual(2);
    });
  });

  describe('getFileSubgraph', () => {
    it('should return file and contained entities', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.upsertClass(makeClass('Cls1', '/src/a.ts'));

      const subgraph = await adapter.getFileSubgraph('/src/a.ts');
      expect(subgraph.nodes.length).toBe(3);
      expect(subgraph.centerId).toBe('File:/src/a.ts');
    });

    it('should return empty for non-existent file', async () => {
      const subgraph = await adapter.getFileSubgraph('/nonexistent.ts');
      expect(subgraph.nodes).toHaveLength(0);
    });
  });

  describe('getFunctionCallers', () => {
    it('should find functions that call a given function', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('caller', '/src/a.ts'));
      await adapter.upsertFunction(makeFunction('target', '/src/a.ts'));
      await adapter.createCallEdge('caller', '/src/a.ts', 'target', '/src/a.ts', 5);

      const callers = await adapter.getFunctionCallers('target');
      expect(callers).toHaveLength(1);
      expect(callers[0].name).toBe('caller');
    });
  });

  describe('getDependencyTree', () => {
    it('should return BFS import tree', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFile(makeFile('/src/b.ts'));
      await adapter.upsertFile(makeFile('/src/c.ts'));
      await adapter.createImportsEdge('/src/a.ts', '/src/b.ts');
      await adapter.createImportsEdge('/src/b.ts', '/src/c.ts');

      const tree = await adapter.getDependencyTree('/src/a.ts');
      expect(tree.nodes.length).toBe(3);
      expect(tree.edges.length).toBe(2);
    });

    it('should respect depth limit', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFile(makeFile('/src/b.ts'));
      await adapter.upsertFile(makeFile('/src/c.ts'));
      await adapter.createImportsEdge('/src/a.ts', '/src/b.ts');
      await adapter.createImportsEdge('/src/b.ts', '/src/c.ts');

      const tree = await adapter.getDependencyTree('/src/a.ts', 1);
      expect(tree.nodes.length).toBe(2); // a and b only
    });
  });

  describe('getStats', () => {
    it('should return correct counts', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.upsertClass(makeClass('Cls1', '/src/a.ts'));

      const stats = await adapter.getStats();
      expect(stats.totalNodes).toBe(3);
      expect(stats.nodesByType.File).toBe(1);
      expect(stats.nodesByType.Function).toBe(1);
      expect(stats.nodesByType.Class).toBe(1);
      expect(stats.totalEdges).toBeGreaterThan(0);
    });
  });

  describe('search', () => {
    it('should find entities by name substring', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('handleClick', '/src/a.ts'));
      await adapter.upsertFunction(makeFunction('handleSubmit', '/src/a.ts'));
      await adapter.upsertClass(makeClass('UserService', '/src/a.ts'));

      const results = await adapter.search('handle');
      expect(results).toHaveLength(2);
    });

    it('should filter by types', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('myFunc', '/src/a.ts'));
      await adapter.upsertClass(makeClass('myClass', '/src/a.ts'));

      const results = await adapter.search('my', ['Function']);
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('Function');
    });

    it('should respect limit', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      for (let i = 0; i < 10; i++) {
        await adapter.upsertFunction(makeFunction(`fn${i}`, '/src/a.ts', { startLine: i * 10, endLine: i * 10 + 5 }));
      }

      const results = await adapter.search('fn', undefined, 3);
      expect(results).toHaveLength(3);
    });
  });

  // ── Persistence ───────────────────────────────────────────────────────

  describe('export / import', () => {
    it('should roundtrip graph data through JSON', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));
      await adapter.createImportsEdge('/src/a.ts', '/src/b.ts');

      const exported = adapter.exportGraph();
      const restored = new GraphologyAdapter(exported);

      expect(restored.graph.order).toBe(adapter.graph.order);
      expect(restored.graph.size).toBe(adapter.graph.size);
      expect(restored.graph.hasNode('File:/src/a.ts')).toBe(true);
    });

    it('should survive JSON serialization', async () => {
      await adapter.upsertFile(makeFile('/src/a.ts'));
      await adapter.upsertFunction(makeFunction('fn1', '/src/a.ts'));

      const json = JSON.stringify(adapter.exportGraph());
      const parsed = JSON.parse(json);
      const restored = new GraphologyAdapter(parsed);

      expect(restored.graph.order).toBe(adapter.graph.order);
    });
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────

  describe('lifecycle', () => {
    it('ensureIndexes should be a no-op', async () => {
      await expect(adapter.ensureIndexes()).resolves.toBeUndefined();
    });

    it('close should be a no-op', async () => {
      await expect(adapter.close()).resolves.toBeUndefined();
    });
  });
});
