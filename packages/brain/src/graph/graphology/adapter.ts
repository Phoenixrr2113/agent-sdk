/**
 * Graphology Adapter — in-process graph backend implementing QueryPort.
 *
 * Replaces FalkorDB for zero-infrastructure operation.
 * All data stored in memory with JSON export/import persistence.
 */

import { DirectedGraph } from 'graphology';
import { createLogger } from '@agent/logger';
import type { QueryPort } from '../ports';
import type {
  GraphData,
  SubgraphData,
  GraphStats,
  SearchResult,
  FileEntity,
  FunctionEntity,
  NodeLabel,
  EdgeLabel,
  ProjectEntity,
  CommitEntity,
} from '../../types';
import type { ParsedFileEntities, EntityAliasNodeProps, ContradictionNodeProps } from '../schema';
import {
  fileToNodeProps,
  functionToNodeProps,
  classToNodeProps,
  interfaceToNodeProps,
  variableToNodeProps,
  typeToNodeProps,
  componentToNodeProps,
  commitToNodeProps,
  episodeToNodeProps,
  experienceToNodeProps,
  generateNodeId,
  generateFileNodeId,
} from '../schema';
import type { EpisodeRow } from '../operations/episode-ops';

const log = createLogger('@agent/brain:graphology');

// ============================================================================
// Helper Types — local aliases to avoid graphology-types dependency
// ============================================================================

type PlainAttrs = Record<string, unknown>;

interface NodeAttrs extends PlainAttrs {
  __label: string;
}

interface EdgeAttrs extends PlainAttrs {
  __type: string;
}

/** Serialized graph shape for JSON persistence */
export interface SerializedGraphData {
  attributes: PlainAttrs;
  nodes: Array<{ key: string; attributes?: PlainAttrs }>;
  edges: Array<{ key: string; source: string; target: string; attributes?: PlainAttrs }>;
  options?: { type: string; multi: boolean; allowSelfLoops: boolean };
}

// ============================================================================
// Graphology QueryPort Implementation
// ============================================================================

export class GraphologyAdapter implements QueryPort {
  readonly graph: DirectedGraph;

  constructor(serialized?: SerializedGraphData) {
    if (serialized) {
      this.graph = DirectedGraph.from(serialized as never);
    } else {
      this.graph = new DirectedGraph();
    }
  }

  // ── Write: Node Upserts ─────────────────────────────────────────────────

  async upsertFile(file: FileEntity): Promise<void> {
    const id = generateFileNodeId(file.path);
    const props = fileToNodeProps(file);
    this.upsertNode(id, 'File', { ...props });
  }

  async upsertFunction(fn: FunctionEntity): Promise<void> {
    const id = generateNodeId('Function', fn);
    const props = functionToNodeProps(fn);
    this.upsertNode(id, 'Function', { ...props });
    this.ensureContainsEdge(fn.filePath, id);
  }

  async upsertClass(cls: Parameters<QueryPort['upsertClass']>[0]): Promise<void> {
    const id = generateNodeId('Class', cls);
    const props = classToNodeProps(cls);
    this.upsertNode(id, 'Class', { ...props });
    this.ensureContainsEdge(cls.filePath, id);
  }

  async upsertInterface(iface: Parameters<QueryPort['upsertInterface']>[0]): Promise<void> {
    const id = generateNodeId('Interface', iface);
    const props = interfaceToNodeProps(iface);
    this.upsertNode(id, 'Interface', { ...props });
    this.ensureContainsEdge(iface.filePath, id);
  }

  async upsertVariable(variable: Parameters<QueryPort['upsertVariable']>[0]): Promise<void> {
    const id = generateNodeId('Variable', { name: variable.name, filePath: variable.filePath, line: variable.line });
    const props = variableToNodeProps(variable);
    this.upsertNode(id, 'Variable', { ...props });
    this.ensureContainsEdge(variable.filePath, id);
  }

  async upsertType(type: Parameters<QueryPort['upsertType']>[0]): Promise<void> {
    const id = generateNodeId('Type', type);
    const props = typeToNodeProps(type);
    this.upsertNode(id, 'Type', { ...props });
    this.ensureContainsEdge(type.filePath, id);
  }

  async upsertComponent(component: Parameters<QueryPort['upsertComponent']>[0]): Promise<void> {
    const id = generateNodeId('Component', component);
    const props = componentToNodeProps(component);
    this.upsertNode(id, 'Component', { ...props });
    this.ensureContainsEdge(component.filePath, id);
  }

  // ── Write: Edge Creation ────────────────────────────────────────────────

  async createCallEdge(
    callerName: string, callerFile: string,
    calleeName: string, calleeFile: string,
    line: number
  ): Promise<void> {
    const callerId = this.findFunctionNode(callerName, callerFile);
    const calleeId = this.findFunctionNode(calleeName, calleeFile);
    if (!callerId || !calleeId) return;

    const edgeKey = `CALLS:${callerId}->${calleeId}`;
    if (this.graph.hasEdge(edgeKey)) {
      const count = (this.graph.getEdgeAttribute(edgeKey, 'count') as number) ?? 0;
      this.graph.setEdgeAttribute(edgeKey, 'count', count + 1);
    } else {
      this.graph.addEdgeWithKey(edgeKey, callerId, calleeId, {
        __type: 'CALLS', line, count: 1,
      });
    }
  }

  async createImportsEdge(fromPath: string, toPath: string, specifiers?: string[]): Promise<void> {
    const fromId = generateFileNodeId(fromPath);
    const toId = generateFileNodeId(toPath);
    if (!this.graph.hasNode(fromId)) return;

    // Auto-create external file node if needed
    if (!this.graph.hasNode(toId)) {
      this.upsertNode(toId, 'File', { path: toPath, name: toPath.split('/').pop() ?? toPath, extension: '', loc: 0, lastModified: '', hash: '', external: true });
    }

    const edgeKey = `IMPORTS:${fromId}->${toId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, fromId, toId, {
        __type: 'IMPORTS', specifiers: specifiers ?? null,
      });
    } else {
      this.graph.setEdgeAttribute(edgeKey, 'specifiers', specifiers ?? null);
    }
  }

  async createExtendsEdge(childName: string, childFile: string, parentName: string, parentFile?: string): Promise<void> {
    const childId = this.findNodeByNameAndFile('Class', childName, childFile);
    if (!childId) return;

    const actualParentFile = parentFile ?? 'external';
    let parentId = this.findNodeByNameAndFile('Class', parentName, actualParentFile);
    if (!parentId) {
      parentId = `Class:${actualParentFile}:${parentName}:0`;
      this.upsertNode(parentId, 'Class', {
        name: parentName, filePath: actualParentFile, startLine: 0, endLine: 0,
        isExported: false, isAbstract: false, extends: null, implements: null, docstring: null,
        external: true,
      });
    }

    const edgeKey = `EXTENDS:${childId}->${parentId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, childId, parentId, { __type: 'EXTENDS' });
    }
  }

  async createImplementsEdge(className: string, classFile: string, interfaceName: string, interfaceFile?: string): Promise<void> {
    const classId = this.findNodeByNameAndFile('Class', className, classFile);
    if (!classId) return;

    const actualIfaceFile = interfaceFile ?? 'external';
    let ifaceId = this.findNodeByNameAndFile('Interface', interfaceName, actualIfaceFile);
    if (!ifaceId) {
      ifaceId = `Interface:${actualIfaceFile}:${interfaceName}:0`;
      this.upsertNode(ifaceId, 'Interface', {
        name: interfaceName, filePath: actualIfaceFile, startLine: 0, endLine: 0,
        isExported: false, extends: null, docstring: null,
        external: true,
      });
    }

    const edgeKey = `IMPLEMENTS:${classId}->${ifaceId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, classId, ifaceId, { __type: 'IMPLEMENTS' });
    }
  }

  async createRendersEdge(parentName: string, parentFile: string, childName: string, line: number): Promise<void> {
    const parentId = this.findNodeByNameAndFile('Component', parentName, parentFile);
    const childId = this.findNodeByName('Component', childName);
    if (!parentId || !childId) return;

    const edgeKey = `RENDERS:${parentId}->${childId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, parentId, childId, { __type: 'RENDERS', line });
    }
  }

  // ── Write: Delete / Clear ───────────────────────────────────────────────

  async deleteFileEntities(filePath: string): Promise<void> {
    const fileId = generateFileNodeId(filePath);
    if (!this.graph.hasNode(fileId)) return;

    // Find all CONTAINS targets
    const contained: string[] = [];
    this.graph.forEachOutEdge(fileId, (_edgeKey, attrs, _source, target) => {
      if ((attrs as EdgeAttrs).__type === 'CONTAINS') contained.push(target);
    });

    // Drop contained nodes (also removes all their edges)
    for (const nodeId of contained) {
      if (this.graph.hasNode(nodeId)) this.graph.dropNode(nodeId);
    }

    // Drop the file node
    if (this.graph.hasNode(fileId)) this.graph.dropNode(fileId);
  }

  async clearAll(): Promise<void> {
    this.graph.clear();
  }

  async batchUpsert(entities: ParsedFileEntities): Promise<void> {
    await this.upsertFile(entities.file);

    await Promise.all([
      ...entities.functions.map((fn) => this.upsertFunction(fn)),
      ...entities.classes.map((cls) => this.upsertClass(cls)),
      ...entities.interfaces.map((iface) => this.upsertInterface(iface)),
      ...entities.variables.map((v) => this.upsertVariable(v)),
      ...entities.types.map((t) => this.upsertType(t)),
      ...entities.components.map((comp) => this.upsertComponent(comp)),
    ]);

    await Promise.all([
      ...entities.callEdges.map((edge) =>
        this.createCallEdge(
          edge.callerId.split(':')[2] ?? '', edge.callerId.split(':')[1] ?? '',
          edge.calleeId.split(':')[2] ?? '', edge.calleeId.split(':')[1] ?? '',
          edge.line
        )
      ),
      ...entities.importsEdges.map((edge) =>
        this.createImportsEdge(edge.fromFilePath, edge.toFilePath, edge.specifiers)
      ),
      ...entities.extendsEdges.map((edge) => {
        const parentParts = edge.parentId.split(':');
        const parentFile = parentParts[1] !== 'external' ? parentParts[1] : undefined;
        return this.createExtendsEdge(
          edge.childId.split(':')[2] ?? '', edge.childId.split(':')[1] ?? '',
          parentParts[2] ?? parentParts[1] ?? '', parentFile
        );
      }),
      ...entities.implementsEdges.map((edge) => {
        const ifaceParts = edge.interfaceId.split(':');
        const ifaceFile = ifaceParts[1] !== 'external' ? ifaceParts[1] : undefined;
        return this.createImplementsEdge(
          edge.classId.split(':')[2] ?? '', edge.classId.split(':')[1] ?? '',
          ifaceParts[2] ?? ifaceParts[1] ?? '', ifaceFile
        );
      }),
      ...entities.rendersEdges.map((edge) =>
        this.createRendersEdge(
          edge.parentId.split(':')[2] ?? '', edge.parentId.split(':')[1] ?? '',
          edge.childId.split(':')[2] ?? '', edge.line
        )
      ),
    ]);
  }

  // ── Project Operations ──────────────────────────────────────────────────

  async upsertProject(project: ProjectEntity): Promise<void> {
    const id = `Project:${project.id}`;
    this.upsertNode(id, 'Project', {
      id: project.id, name: project.name, rootPath: project.rootPath,
      createdAt: project.createdAt, lastParsed: project.lastParsed,
      fileCount: project.fileCount ?? 0,
    });
  }

  async getProjects(): Promise<ProjectEntity[]> {
    return this.findNodesByLabel('Project')
      .map((id) => this.projectFromAttrs(this.graph.getNodeAttributes(id) as NodeAttrs))
      .sort((a, b) => (b.lastParsed ?? '').localeCompare(a.lastParsed ?? ''));
  }

  async getProjectByRoot(rootPath: string): Promise<ProjectEntity | null> {
    const all = await this.getProjects();
    return all.find((p) => p.rootPath === rootPath) ?? null;
  }

  async deleteProject(projectId: string): Promise<void> {
    const nodeId = `Project:${projectId}`;
    if (!this.graph.hasNode(nodeId)) return;

    // Cascade: find HAS_FILE edges → delete file entities → delete files → delete project
    const fileIds: string[] = [];
    this.graph.forEachOutEdge(nodeId, (_, attrs, _s, target) => {
      if ((attrs as EdgeAttrs).__type === 'HAS_FILE') fileIds.push(target);
    });

    for (const fId of fileIds) {
      const filePath = this.graph.getNodeAttribute(fId, 'path') as string;
      if (filePath) await this.deleteFileEntities(filePath);
    }

    if (this.graph.hasNode(nodeId)) this.graph.dropNode(nodeId);
  }

  async linkProjectFile(projectId: string, filePath: string): Promise<void> {
    const pId = `Project:${projectId}`;
    const fId = generateFileNodeId(filePath);
    if (!this.graph.hasNode(pId) || !this.graph.hasNode(fId)) return;

    const edgeKey = `HAS_FILE:${pId}->${fId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, pId, fId, { __type: 'HAS_FILE' });
    }
  }

  // ── Commit Operations ───────────────────────────────────────────────────

  async upsertCommit(commit: CommitEntity): Promise<void> {
    const id = `Commit:${commit.hash}`;
    const props = commitToNodeProps(commit);
    this.upsertNode(id, 'Commit', { ...props });
  }

  async createModifiedInEdge(
    filePath: string, commitHash: string,
    linesAdded?: number, linesRemoved?: number, complexityDelta?: number
  ): Promise<void> {
    const fId = generateFileNodeId(filePath);
    const cId = `Commit:${commitHash}`;
    if (!this.graph.hasNode(fId) || !this.graph.hasNode(cId)) return;

    const edgeKey = `MODIFIED_IN:${fId}->${cId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, fId, cId, {
        __type: 'MODIFIED_IN',
        linesAdded: linesAdded ?? null, linesRemoved: linesRemoved ?? null,
        complexityDelta: complexityDelta ?? null,
      });
    } else {
      if (linesAdded !== undefined) this.graph.setEdgeAttribute(edgeKey, 'linesAdded', linesAdded);
      if (linesRemoved !== undefined) this.graph.setEdgeAttribute(edgeKey, 'linesRemoved', linesRemoved);
      if (complexityDelta !== undefined) this.graph.setEdgeAttribute(edgeKey, 'complexityDelta', complexityDelta);
    }
  }

  // ── Episode Operations ──────────────────────────────────────────────────

  async upsertEpisode(episode: Parameters<typeof episodeToNodeProps>[0]): Promise<void> {
    const id = `Episode:${episode.id}`;
    const props = episodeToNodeProps(episode);
    this.upsertNode(id, 'Episode', {
      ...props,
      contextProject: props.context_project,
      contextTask: props.context_task,
      outcomeSuccess: props.outcome_success,
      outcomeResult: props.outcome_result,
      outcomeLessons: props.outcome_lessons,
    });
  }

  async upsertExperience(experience: Parameters<typeof experienceToNodeProps>[0]): Promise<void> {
    const id = `Experience:${experience.id}`;
    const props = experienceToNodeProps(experience);
    this.upsertNode(id, 'Experience', { ...props });
  }

  async linkEpisodeEntity(episodeId: string, entityName: string): Promise<void> {
    const eId = `Episode:${episodeId}`;
    if (!this.graph.hasNode(eId)) return;

    const targetId = this.findNodeByName(undefined, entityName);
    if (!targetId) return;

    const edgeKey = `MENTIONS:${eId}->${targetId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, eId, targetId, { __type: 'MENTIONS' });
    }
  }

  async linkEpisodeExperience(episodeId: string): Promise<void> {
    const eId = `Episode:${episodeId}`;
    if (!this.graph.hasNode(eId)) return;

    this.graph.forEachNode((nodeId, attrs) => {
      const a = attrs as NodeAttrs;
      if (a.__label === 'Experience' && a.episodeId === episodeId) {
        const edgeKey = `GENERATED:${eId}->${nodeId}`;
        if (!this.graph.hasEdge(edgeKey)) {
          this.graph.addEdgeWithKey(edgeKey, eId, nodeId, { __type: 'GENERATED' });
        }
      }
    });
  }

  async getEpisodesByQuery(query: string, limit: number): Promise<EpisodeRow[]> {
    const lowerQuery = query.toLowerCase();
    const results: EpisodeRow[] = [];

    this.graph.forEachNode((_nodeId, attrs) => {
      const a = attrs as NodeAttrs;
      if (a.__label !== 'Episode') return;
      const content = String(a.content ?? '').toLowerCase();
      const summary = String(a.summary ?? '').toLowerCase();
      if (content.includes(lowerQuery) || summary.includes(lowerQuery)) {
        results.push(this.episodeRowFromAttrs(a));
      }
    });

    return results
      .sort((a, b) => {
        const tsA = (a.properties?.timestamp ?? a.timestamp ?? '') as string;
        const tsB = (b.properties?.timestamp ?? b.timestamp ?? '') as string;
        return tsB.localeCompare(tsA);
      })
      .slice(0, limit);
  }

  async getEpisodeById(id: string): Promise<EpisodeRow[]> {
    const nodeId = `Episode:${id}`;
    if (!this.graph.hasNode(nodeId)) return [];
    return [this.episodeRowFromAttrs(this.graph.getNodeAttributes(nodeId) as NodeAttrs)];
  }

  async getAllEpisodes(limit: number): Promise<EpisodeRow[]> {
    const results: EpisodeRow[] = [];
    this.graph.forEachNode((_, attrs) => {
      const a = attrs as NodeAttrs;
      if (a.__label === 'Episode') results.push(this.episodeRowFromAttrs(a));
    });
    return results
      .sort((a, b) => {
        const tsA = (a.properties?.timestamp ?? a.timestamp ?? '') as string;
        const tsB = (b.properties?.timestamp ?? b.timestamp ?? '') as string;
        return tsB.localeCompare(tsA);
      })
      .slice(0, limit);
  }

  async getExperiencesForEpisode(episodeId: string): Promise<unknown[]> {
    const eId = `Episode:${episodeId}`;
    if (!this.graph.hasNode(eId)) return [];

    const results: unknown[] = [];
    this.graph.forEachOutEdge(eId, (_, attrs, _s, target) => {
      if ((attrs as EdgeAttrs).__type === 'GENERATED') {
        results.push(this.graph.getNodeAttributes(target));
      }
    });
    return results;
  }

  async countEpisodes(): Promise<number> {
    return this.findNodesByLabel('Episode').length;
  }

  async pruneOldEpisodes(count: number): Promise<number> {
    const episodes = this.findNodesByLabel('Episode')
      .map((id) => ({ id, ts: this.graph.getNodeAttribute(id, 'timestamp') as string }))
      .sort((a, b) => (a.ts ?? '').localeCompare(b.ts ?? ''));

    const toDelete = episodes.slice(0, count);
    for (const ep of toDelete) {
      if (this.graph.hasNode(ep.id)) this.graph.dropNode(ep.id);
    }
    return toDelete.length;
  }

  // ── Entity Resolution ───────────────────────────────────────────────────

  async upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void> {
    const id = `EntityAlias:${alias.name}`;
    this.upsertNode(id, 'EntityAlias', { ...alias });
  }

  async createAliasOfEdge(aliasName: string, entityId: string): Promise<void> {
    const aliasNodeId = `EntityAlias:${aliasName}`;
    if (!this.graph.hasNode(aliasNodeId)) return;

    const targetId = this.findNodeByIdOrName(entityId);
    if (!targetId) return;

    const edgeKey = `ALIAS_OF:${aliasNodeId}->${targetId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, aliasNodeId, targetId, { __type: 'ALIAS_OF' });
    }
  }

  async getEntityAliases(entityId: string): Promise<unknown[]> {
    const results: unknown[] = [];
    const targetId = this.findNodeByIdOrName(entityId);
    if (!targetId) return results;

    this.graph.forEachInEdge(targetId, (_, attrs, source) => {
      if ((attrs as EdgeAttrs).__type === 'ALIAS_OF') {
        results.push(this.graph.getNodeAttributes(source));
      }
    });
    return results;
  }

  async findCanonicalEntity(aliasName: string): Promise<unknown[]> {
    const aliasNodeId = `EntityAlias:${aliasName}`;
    if (!this.graph.hasNode(aliasNodeId)) return [];

    const results: unknown[] = [];
    this.graph.forEachOutEdge(aliasNodeId, (_, attrs, _s, target) => {
      if ((attrs as EdgeAttrs).__type === 'ALIAS_OF') {
        results.push(this.graph.getNodeAttributes(target));
      }
    });
    return results;
  }

  // ── Contradiction ───────────────────────────────────────────────────────

  async upsertContradiction(contradiction: ContradictionNodeProps): Promise<void> {
    const id = `Contradiction:${contradiction.id}`;
    this.upsertNode(id, 'Contradiction', { ...contradiction });
  }

  async getUnresolvedContradictions(): Promise<unknown[]> {
    const results: unknown[] = [];
    this.graph.forEachNode((_, attrs) => {
      const a = attrs as NodeAttrs;
      if (a.__label === 'Contradiction' && a.resolution_winner == null) {
        results.push(attrs);
      }
    });
    return results;
  }

  async resolveContradiction(id: string, winner: string, reasoning: string): Promise<void> {
    const nodeId = `Contradiction:${id}`;
    if (!this.graph.hasNode(nodeId)) return;
    this.graph.setNodeAttribute(nodeId, 'resolution_winner', winner);
    this.graph.setNodeAttribute(nodeId, 'resolution_reasoning', reasoning);
  }

  // ── Read: Queries ───────────────────────────────────────────────────────

  async getFullGraph(limit = 1000, rootPath?: string): Promise<GraphData> {
    const codeLabels = new Set(['File', 'Function', 'Class', 'Interface', 'Variable', 'Type', 'Component']);
    const nodes: GraphData['nodes'] = [];
    const edges: GraphData['edges'] = [];
    const nodeIds = new Set<string>();

    this.graph.forEachNode((nodeId, attrs) => {
      const a = attrs as NodeAttrs;
      if (!codeLabels.has(a.__label)) return;
      if (rootPath) {
        const fp = (a.path ?? a.filePath ?? '') as string;
        if (!fp.startsWith(rootPath)) return;
      }
      if (nodes.length >= limit) return;

      nodes.push(this.toGraphNode(nodeId, a));
      nodeIds.add(nodeId);
    });

    this.graph.forEachEdge((edgeKey, attrs, source, target) => {
      if (edges.length >= limit) return;
      if (nodeIds.has(source) && nodeIds.has(target)) {
        const a = attrs as EdgeAttrs;
        edges.push({
          id: edgeKey,
          source,
          target,
          label: a.__type as EdgeLabel,
          data: { type: a.__type, from: source, to: target, ...a },
        } as GraphData['edges'][number]);
      }
    });

    return { nodes, edges };
  }

  async getFileSubgraph(filePath: string): Promise<SubgraphData> {
    const fileId = generateFileNodeId(filePath);
    if (!this.graph.hasNode(fileId)) return { nodes: [], edges: [] };

    const nodes: GraphData['nodes'] = [];
    const edges: GraphData['edges'] = [];
    const nodeIds = new Set<string>();

    const fileAttrs = this.graph.getNodeAttributes(fileId) as NodeAttrs;
    nodes.push(this.toGraphNode(fileId, fileAttrs));
    nodeIds.add(fileId);

    // Add contained entities
    this.graph.forEachOutEdge(fileId, (edgeKey, attrs, _s, target) => {
      const a = attrs as EdgeAttrs;
      if (a.__type === 'CONTAINS') {
        const targetAttrs = this.graph.getNodeAttributes(target) as NodeAttrs;
        if (!nodeIds.has(target)) {
          nodes.push(this.toGraphNode(target, targetAttrs));
          nodeIds.add(target);
        }
        edges.push({
          id: edgeKey, source: fileId, target,
          label: 'CONTAINS' as EdgeLabel,
          data: { type: 'CONTAINS', from: fileId, to: target },
        } as GraphData['edges'][number]);

        // Add related nodes (edges from/to contained entities)
        this.graph.forEachEdge(target, (relEdgeKey, relAttrs, relSource, relTarget) => {
          const ra = relAttrs as EdgeAttrs;
          if (ra.__type === 'CONTAINS') return;
          const relatedId = relSource === target ? relTarget : relSource;
          if (!this.graph.hasNode(relatedId)) return;
          if (!nodeIds.has(relatedId)) {
            nodes.push(this.toGraphNode(relatedId, this.graph.getNodeAttributes(relatedId) as NodeAttrs));
            nodeIds.add(relatedId);
          }
          if (!edges.some((e) => e.id === relEdgeKey)) {
            edges.push({
              id: relEdgeKey, source: relSource, target: relTarget,
              label: ra.__type as EdgeLabel,
              data: { type: ra.__type, from: relSource, to: relTarget },
            } as GraphData['edges'][number]);
          }
        });
      }
    });

    return { nodes, edges, centerId: fileId };
  }

  async getFunctionCallers(funcName: string): Promise<FunctionEntity[]> {
    const callers: FunctionEntity[] = [];

    this.graph.forEachEdge((_, attrs, source, target) => {
      const a = attrs as EdgeAttrs;
      if (a.__type !== 'CALLS') return;
      const targetAttrs = this.graph.getNodeAttributes(target) as NodeAttrs;
      if (targetAttrs.name !== funcName) return;

      const sourceAttrs = this.graph.getNodeAttributes(source) as NodeAttrs;
      if (sourceAttrs.__label !== 'Function') return;

      callers.push({
        name: sourceAttrs.name as string,
        filePath: sourceAttrs.filePath as string,
        startLine: sourceAttrs.startLine as number,
        endLine: sourceAttrs.endLine as number,
        isExported: sourceAttrs.isExported as boolean,
        isAsync: sourceAttrs.isAsync as boolean,
        isArrow: sourceAttrs.isArrow as boolean,
        params: JSON.parse((sourceAttrs.params as string) ?? '[]'),
        ...(sourceAttrs.returnType != null ? { returnType: sourceAttrs.returnType as string } : {}),
        ...(sourceAttrs.docstring != null ? { docstring: sourceAttrs.docstring as string } : {}),
      });
    });

    return callers;
  }

  async getDependencyTree(filePath: string, depth = 5): Promise<GraphData> {
    const nodes: GraphData['nodes'] = [];
    const edges: GraphData['edges'] = [];
    const nodeIds = new Set<string>();
    const maxDepth = Math.min(depth, 10);

    const rootId = generateFileNodeId(filePath);
    if (!this.graph.hasNode(rootId)) return { nodes, edges };

    // BFS through IMPORTS edges
    const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current.id)) continue;
      visited.add(current.id);

      if (!nodeIds.has(current.id)) {
        const attrs = this.graph.getNodeAttributes(current.id) as NodeAttrs;
        nodes.push(this.toGraphNode(current.id, attrs));
        nodeIds.add(current.id);
      }

      if (current.depth >= maxDepth) continue;

      this.graph.forEachOutEdge(current.id, (edgeKey, attrs, source, target) => {
        const a = attrs as EdgeAttrs;
        if (a.__type !== 'IMPORTS') return;
        if (!this.graph.hasNode(target)) return;

        if (!edges.some((e) => e.id === edgeKey)) {
          edges.push({
            id: edgeKey, source, target,
            label: 'IMPORTS' as EdgeLabel,
            data: { type: 'IMPORTS', from: source, to: target },
          } as GraphData['edges'][number]);
        }

        if (!visited.has(target)) {
          queue.push({ id: target, depth: current.depth + 1 });
        }
      });
    }

    return { nodes, edges };
  }

  async getStats(): Promise<GraphStats> {
    const nodesByType: Record<NodeLabel, number> = {
      File: 0, Function: 0, Class: 0, Interface: 0, Variable: 0, Type: 0,
      Component: 0, Import: 0, Commit: 0, MarkdownDocument: 0, Section: 0,
      CodeBlock: 0, Link: 0,
    };
    const edgesByType: Record<EdgeLabel, number> = {
      CONTAINS: 0, IMPORTS: 0, IMPORTS_SYMBOL: 0, CALLS: 0, EXTENDS: 0,
      IMPLEMENTS: 0, USES_TYPE: 0, RETURNS: 0, HAS_PARAM: 0, HAS_METHOD: 0,
      HAS_PROPERTY: 0, RENDERS: 0, USES_HOOK: 0, INTRODUCED_IN: 0,
      MODIFIED_IN: 0, DELETED_IN: 0, READS: 0, WRITES: 0, FLOWS_TO: 0,
      EXPORTS: 0, INSTANTIATES: 0, HAS_SECTION: 0, PARENT_SECTION: 0,
      CONTAINS_CODE: 0, LINKS_TO: 0,
    };

    let totalNodes = 0;
    this.graph.forEachNode((_, attrs) => {
      const label = (attrs as NodeAttrs).__label as NodeLabel;
      if (label in nodesByType) {
        nodesByType[label]++;
        totalNodes++;
      }
    });

    let totalEdges = 0;
    this.graph.forEachEdge((_, attrs) => {
      const type = (attrs as EdgeAttrs).__type as EdgeLabel;
      if (type in edgesByType) {
        edgesByType[type]++;
        totalEdges++;
      }
    });

    // Largest files
    const fileCounts = new Map<string, number>();
    this.graph.forEachEdge((_, attrs, source) => {
      if ((attrs as EdgeAttrs).__type === 'CONTAINS') {
        const path = this.graph.getNodeAttribute(source, 'path') as string;
        if (path) fileCounts.set(path, (fileCounts.get(path) ?? 0) + 1);
      }
    });
    const largestFiles = Array.from(fileCounts.entries())
      .map(([path, entityCount]) => ({ path, entityCount }))
      .sort((a, b) => b.entityCount - a.entityCount)
      .slice(0, 10);

    // Most connected
    const connectionCounts = new Map<string, { name: string; filePath: string; count: number }>();
    this.graph.forEachNode((nodeId, attrs) => {
      const label = (attrs as NodeAttrs).__label;
      if (!['Function', 'Class', 'Component'].includes(label)) return;
      const degree = this.graph.degree(nodeId);
      connectionCounts.set(nodeId, {
        name: (attrs as NodeAttrs).name as string,
        filePath: (attrs as NodeAttrs).filePath as string,
        count: degree,
      });
    });
    const mostConnected = Array.from(connectionCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((entry) => ({ name: entry.name, filePath: entry.filePath, connectionCount: entry.count }));

    return { totalNodes, totalEdges, nodesByType, edgesByType, largestFiles, mostConnected };
  }

  async search(term: string, types?: NodeLabel[], limit = 50): Promise<SearchResult[]> {
    const lowerTerm = term.toLowerCase();
    const results: SearchResult[] = [];
    const searchLabels = new Set(['Function', 'Class', 'Interface', 'Component', 'Variable', 'Type']);

    this.graph.forEachNode((nodeId, attrs) => {
      if (results.length >= limit) return;
      const a = attrs as NodeAttrs;
      const label = a.__label as NodeLabel;
      if (!searchLabels.has(label)) return;
      if (types && !types.includes(label)) return;

      const name = String(a.name ?? '').toLowerCase();
      if (name.includes(lowerTerm)) {
        results.push({
          id: nodeId,
          name: (a.name as string) ?? 'unknown',
          type: label,
          filePath: (a.filePath as string) ?? (a.path as string) ?? '',
          line: (a.startLine as number) ?? (a.line as number),
        });
      }
    });

    return results;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async ensureIndexes(): Promise<void> {
    log.debug('Graphology: ensureIndexes is a no-op');
  }

  async close(): Promise<void> {
    log.debug('Graphology: close is a no-op');
  }

  // ── Persistence ─────────────────────────────────────────────────────────

  exportGraph(): SerializedGraphData {
    return this.graph.export() as unknown as SerializedGraphData;
  }

  importGraph(data: SerializedGraphData): void {
    this.graph.import(data as never);
  }

  // ── Internal Helpers ────────────────────────────────────────────────────

  private upsertNode(id: string, label: string, props: PlainAttrs): void {
    if (this.graph.hasNode(id)) {
      const existing = this.graph.getNodeAttributes(id);
      this.graph.replaceNodeAttributes(id, { ...existing, __label: label, ...props });
    } else {
      this.graph.addNode(id, { __label: label, ...props });
    }
  }

  private ensureContainsEdge(filePath: string, entityId: string): void {
    const fileId = generateFileNodeId(filePath);
    if (!this.graph.hasNode(fileId)) return;
    const edgeKey = `CONTAINS:${fileId}->${entityId}`;
    if (!this.graph.hasEdge(edgeKey)) {
      this.graph.addEdgeWithKey(edgeKey, fileId, entityId, { __type: 'CONTAINS' });
    }
  }

  private findFunctionNode(name: string, filePath: string): string | null {
    let found: string | null = null;
    this.graph.forEachNode((nodeId, attrs) => {
      if (found) return;
      const a = attrs as NodeAttrs;
      if (a.__label === 'Function' && a.name === name && a.filePath === filePath) {
        found = nodeId;
      }
    });
    return found;
  }

  private findNodeByNameAndFile(label: string, name: string, filePath: string): string | null {
    let found: string | null = null;
    this.graph.forEachNode((nodeId, attrs) => {
      if (found) return;
      const a = attrs as NodeAttrs;
      if (a.__label === label && a.name === name && a.filePath === filePath) {
        found = nodeId;
      }
    });
    return found;
  }

  private findNodeByName(label: string | undefined, name: string): string | null {
    let found: string | null = null;
    this.graph.forEachNode((nodeId, attrs) => {
      if (found) return;
      const a = attrs as NodeAttrs;
      if (label && a.__label !== label) return;
      if (a.name === name) found = nodeId;
    });
    return found;
  }

  private findNodeByIdOrName(idOrName: string): string | null {
    if (this.graph.hasNode(idOrName)) return idOrName;

    let found: string | null = null;
    this.graph.forEachNode((nodeId, attrs) => {
      if (found) return;
      const a = attrs as NodeAttrs;
      if (a.id === idOrName || a.name === idOrName) found = nodeId;
    });
    return found;
  }

  private findNodesByLabel(label: string): string[] {
    const ids: string[] = [];
    this.graph.forEachNode((nodeId, attrs) => {
      if ((attrs as NodeAttrs).__label === label) ids.push(nodeId);
    });
    return ids;
  }

  private toGraphNode(nodeId: string, attrs: NodeAttrs): GraphData['nodes'][number] {
    const label = attrs.__label as NodeLabel;
    return {
      id: nodeId,
      label,
      displayName: (attrs.name as string) ?? (attrs.path as string) ?? 'unknown',
      filePath: (attrs.filePath as string) ?? (attrs.path as string),
      data: attrs as unknown,
    } as unknown as GraphData['nodes'][number];
  }

  private projectFromAttrs(attrs: NodeAttrs): ProjectEntity {
    return {
      id: attrs.id as string,
      name: attrs.name as string,
      rootPath: attrs.rootPath as string,
      createdAt: attrs.createdAt as string,
      lastParsed: attrs.lastParsed as string,
      fileCount: (attrs.fileCount as number) ?? 0,
    };
  }

  private episodeRowFromAttrs(attrs: NodeAttrs): EpisodeRow {
    return {
      properties: {
        id: attrs.id as string,
        timestamp: attrs.timestamp as string,
        type: attrs.type as string,
        summary: attrs.summary as string,
        content: attrs.content as string,
      },
      id: attrs.id as string,
      timestamp: attrs.timestamp as string,
      type: attrs.type as string,
      summary: attrs.summary as string,
      content: attrs.content as string,
    } as EpisodeRow;
  }
}
