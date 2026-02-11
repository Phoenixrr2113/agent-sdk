/**
 * Query builder implementations for graph read operations.
 */

import type { GraphClient } from '../client';
import type {
  GraphData,
  GraphNode,
  GraphNodeBase,
  GraphEdge,
  SubgraphData,
  GraphStats,
  SearchResult,
  FunctionEntity,
  NodeLabel,
  EdgeLabel,
} from '../../types';
import { QUERY_CYPHER } from './cypher-templates';

// ============================================================================
// Type Guards and Helpers
// ============================================================================

function getLabelFromLabels(labels: string[]): NodeLabel {
  const validLabels: NodeLabel[] = [
    'File', 'Function', 'Class', 'Interface', 'Variable', 'Type', 'Component',
    'Import', 'Commit', 'MarkdownDocument', 'Section', 'CodeBlock', 'Link',
  ];

  const found = labels.find((l) => validLabels.includes(l as NodeLabel));
  if (found) return found as NodeLabel;

  if (labels.includes('External')) return 'Class' as NodeLabel;
  return 'File';
}

function extractNodeProps(node: Record<string, unknown>): Record<string, unknown> {
  if (node['properties'] && typeof node['properties'] === 'object') {
    return node['properties'] as Record<string, unknown>;
  }
  return node;
}

function extractLabels(node: Record<string, unknown>, providedLabels: string[]): string[] {
  if (node['labels'] && Array.isArray(node['labels'])) {
    return node['labels'] as string[];
  }
  return providedLabels;
}

function generateNodeIdFromProps(label: NodeLabel, node: Record<string, unknown>): string {
  if (label === 'File') return `File:${node['path'] ?? ''}`;
  const name = node['name'] ?? '';
  const filePath = node['filePath'] ?? '';
  const line = node['startLine'] ?? node['line'] ?? 0;
  return `${label}:${filePath}:${name}:${line}`;
}

function nodeToGraphNode(node: Record<string, unknown>, labels: string[]): GraphNode {
  const actualLabels = extractLabels(node, labels);
  const props = extractNodeProps(node);
  const label = getLabelFromLabels(actualLabels);
  const id = generateNodeIdFromProps(label, props);

  const base: GraphNodeBase & { data: Record<string, unknown> } = {
    id,
    label,
    displayName: (props['name'] as string) ?? (props['path'] as string) ?? 'unknown',
    filePath: (props['filePath'] as string) ?? (props['path'] as string),
    data: props,
  };
  return base as GraphNode;
}

function edgeToGraphEdge(
  fromNode: Record<string, unknown>,
  toNode: Record<string, unknown>,
  edgeType: string,
  edgeProps: Record<string, unknown>,
  fromLabels: string[],
  toLabels: string[]
): GraphEdge {
  const fromId = generateNodeIdFromProps(getLabelFromLabels(fromLabels), fromNode);
  const toId = generateNodeIdFromProps(getLabelFromLabels(toLabels), toNode);

  return {
    id: `${edgeType}:${fromId}->${toId}`,
    source: fromId,
    target: toId,
    label: edgeType as EdgeLabel,
    data: { type: edgeType, from: fromId, to: toId, ...edgeProps },
  } as GraphEdge;
}

// ============================================================================
// Query Operations Interface
// ============================================================================

export interface GraphQueries {
  getFullGraph(limit?: number, rootPath?: string): Promise<GraphData>;
  getFileSubgraph(filePath: string): Promise<SubgraphData>;
  getFunctionCallers(funcName: string): Promise<FunctionEntity[]>;
  getDependencyTree(filePath: string, depth?: number): Promise<GraphData>;
  getStats(): Promise<GraphStats>;
  search(term: string, types?: NodeLabel[], limit?: number): Promise<SearchResult[]>;
}

// ============================================================================
// Query Operations Implementation
// ============================================================================

class GraphQueriesImpl implements GraphQueries {
  constructor(private readonly client: GraphClient) {}

  async getFullGraph(limit = 1000, rootPath?: string): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const pathFilter = rootPath
      ? `AND (CASE WHEN n:File THEN n.path ELSE n.filePath END) STARTS WITH $rootPath`
      : '';

    const nodesQuery = `
      MATCH (n)
      WHERE (n:File OR n:Function OR n:Class OR n:Interface OR n:Variable OR n:Type OR n:Component OR n:External)
        ${pathFilter}
      RETURN n, labels(n) as labels
      LIMIT $limit
    `;

    const nodesResult = await this.client.roQuery<{
      n: Record<string, unknown>;
      labels: string[];
    }>(nodesQuery, { params: { limit, ...(rootPath && { rootPath }) } });

    for (const row of nodesResult.data ?? []) {
      const node = nodeToGraphNode(row.n, row.labels);
      if (!nodeIds.has(node.id)) {
        nodes.push(node);
        nodeIds.add(node.id);
      }
    }

    const edgesPathFilter = rootPath
      ? `AND (CASE WHEN a:File THEN a.path ELSE a.filePath END) STARTS WITH $rootPath
         AND ((CASE WHEN b:File THEN b.path ELSE b.filePath END) STARTS WITH $rootPath
              OR b.filePath = 'external'
              OR (b:File AND b.path STARTS WITH 'external:'))`
      : '';

    const edgesQuery = `
      MATCH (a)-[r]->(b)
      WHERE (a:File OR a:Function OR a:Class OR a:Interface OR a:Variable OR a:Type OR a:Component)
        AND (b:File OR b:Function OR b:Class OR b:Interface OR b:Variable OR b:Type OR b:Component OR b:External)
        ${edgesPathFilter}
      RETURN a, r, b, type(r) as edgeType, labels(b) as toLabels
      LIMIT $limit
    `;

    const edgesResult = await this.client.roQuery<{
      a: Record<string, unknown>;
      r: Record<string, unknown>;
      b: Record<string, unknown>;
      edgeType: string;
      toLabels: string[];
    }>(edgesQuery, { params: { limit, ...(rootPath && { rootPath }) } });

    for (const row of edgesResult.data ?? []) {
      const fromProps = extractNodeProps(row.a);
      const toProps = extractNodeProps(row.b);
      const fromLabels = extractLabels(row.a, []);
      const toLabels = row.toLabels ?? extractLabels(row.b, []);

      const fromNode = nodes.find((n) => {
        return (
          n.filePath === fromProps['path'] ||
          (n.displayName === fromProps['name'] && n.filePath === fromProps['filePath'])
        );
      });

      let toNode = nodes.find((n) => {
        return (
          n.filePath === toProps['path'] ||
          (n.displayName === toProps['name'] && n.filePath === toProps['filePath'])
        );
      });

      const isExternalTarget = toLabels.includes('External') ||
        (typeof toProps['path'] === 'string' && toProps['path'].startsWith('external:'));

      if (!toNode && isExternalTarget) {
        const externalNode = nodeToGraphNode(row.b, toLabels);
        if (!nodeIds.has(externalNode.id)) {
          nodes.push(externalNode);
          nodeIds.add(externalNode.id);
        }
        toNode = externalNode;
      }

      if (fromNode && toNode) {
        const edge = edgeToGraphEdge(
          fromProps, toProps, row.edgeType, row.r,
          fromLabels.length > 0 ? fromLabels : [fromNode.label],
          toLabels.length > 0 ? toLabels : [toNode.label]
        );
        edges.push(edge);
      }
    }

    return { nodes, edges };
  }

  async getFileSubgraph(filePath: string): Promise<SubgraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const result = await this.client.roQuery<{
      f: Record<string, unknown>;
      e: Record<string, unknown>;
      r: Record<string, unknown> | null;
      related: Record<string, unknown> | null;
      labels: string[];
      relatedLabels: string[] | null;
      edgeType: string | null;
    }>(QUERY_CYPHER.GET_FILE_SUBGRAPH, { params: { path: filePath } });

    let centerId: string | undefined;

    for (const row of result.data ?? []) {
      const fileNode = nodeToGraphNode(row.f, ['File']);
      if (!nodeIds.has(fileNode.id)) {
        nodes.push(fileNode);
        nodeIds.add(fileNode.id);
        centerId = fileNode.id;
      }

      if (row.e) {
        const entityNode = nodeToGraphNode(row.e, row.labels);
        if (!nodeIds.has(entityNode.id)) {
          nodes.push(entityNode);
          nodeIds.add(entityNode.id);
        }

        edges.push({
          id: `CONTAINS:${fileNode.id}->${entityNode.id}`,
          source: fileNode.id,
          target: entityNode.id,
          label: 'CONTAINS',
          data: { type: 'CONTAINS', from: fileNode.id, to: entityNode.id },
        } as GraphEdge);
      }

      if (row.related && row.relatedLabels && row.edgeType && row.r) {
        const relatedNode = nodeToGraphNode(row.related, row.relatedLabels);
        if (!nodeIds.has(relatedNode.id)) {
          nodes.push(relatedNode);
          nodeIds.add(relatedNode.id);
        }

        const edge = edgeToGraphEdge(
          row.e, row.related, row.edgeType, row.r,
          row.labels, row.relatedLabels
        );

        if (!edges.some((e) => e.id === edge.id)) {
          edges.push(edge);
        }
      }
    }

    if (centerId !== undefined) return { nodes, edges, centerId };
    return { nodes, edges };
  }

  async getFunctionCallers(funcName: string): Promise<FunctionEntity[]> {
    const result = await this.client.roQuery<{
      caller: Record<string, unknown>;
      line: number;
    }>(QUERY_CYPHER.GET_FUNCTION_CALLERS, { params: { name: funcName } });

    return (result.data ?? []).map((row): FunctionEntity => {
      const returnType = row.caller['returnType'] as string | undefined;
      const docstring = row.caller['docstring'] as string | undefined;
      const entity: FunctionEntity = {
        name: row.caller['name'] as string,
        filePath: row.caller['filePath'] as string,
        startLine: row.caller['startLine'] as number,
        endLine: row.caller['endLine'] as number,
        isExported: row.caller['isExported'] as boolean,
        isAsync: row.caller['isAsync'] as boolean,
        isArrow: row.caller['isArrow'] as boolean,
        params: JSON.parse((row.caller['params'] as string) ?? '[]') as FunctionEntity['params'],
      };
      if (returnType !== undefined) entity.returnType = returnType;
      if (docstring !== undefined) entity.docstring = docstring;
      return entity;
    });
  }

  async getDependencyTree(filePath: string, depth = 5): Promise<GraphData> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();

    const depthParam = Math.min(depth, 10);

    const result = await this.client.roQuery<{
      path: Array<Record<string, unknown>>;
    }>(QUERY_CYPHER.GET_DEPENDENCY_TREE.replace('$depth', String(depthParam)), {
      params: { path: filePath },
    });

    for (const row of result.data ?? []) {
      const pathNodes = row.path;
      for (let i = 0; i < pathNodes.length; i++) {
        const node = pathNodes[i]!;
        const graphNode = nodeToGraphNode(node, ['File']);
        if (!nodeIds.has(graphNode.id)) {
          nodes.push(graphNode);
          nodeIds.add(graphNode.id);
        }

        if (i < pathNodes.length - 1) {
          const nextNode = pathNodes[i + 1]!;
          const fromId = graphNode.id;
          const toId = generateNodeIdFromProps('File', nextNode);
          const edgeId = `IMPORTS:${fromId}->${toId}`;

          if (!edges.some((e) => e.id === edgeId)) {
            edges.push({
              id: edgeId,
              source: fromId,
              target: toId,
              label: 'IMPORTS',
              data: { type: 'IMPORTS', from: fromId, to: toId },
            } as GraphEdge);
          }
        }
      }
    }

    return { nodes, edges };
  }

  async getStats(): Promise<GraphStats> {
    const nodesResult = await this.client.roQuery<{ label: string; count: number }>(
      QUERY_CYPHER.GET_STATS_NODES
    );

    const nodesByType: Record<NodeLabel, number> = {
      File: 0, Function: 0, Class: 0, Interface: 0, Variable: 0, Type: 0,
      Component: 0, Import: 0, Commit: 0, MarkdownDocument: 0, Section: 0,
      CodeBlock: 0, Link: 0,
    };

    let totalNodes = 0;
    for (const row of nodesResult.data ?? []) {
      const label = row.label as NodeLabel;
      if (label in nodesByType) {
        nodesByType[label] = row.count;
        totalNodes += row.count;
      }
    }

    const edgesResult = await this.client.roQuery<{ label: string; count: number }>(
      QUERY_CYPHER.GET_STATS_EDGES
    );

    const edgesByType: Record<EdgeLabel, number> = {
      CONTAINS: 0, IMPORTS: 0, IMPORTS_SYMBOL: 0, CALLS: 0, EXTENDS: 0,
      IMPLEMENTS: 0, USES_TYPE: 0, RETURNS: 0, HAS_PARAM: 0, HAS_METHOD: 0,
      HAS_PROPERTY: 0, RENDERS: 0, USES_HOOK: 0, INTRODUCED_IN: 0,
      MODIFIED_IN: 0, DELETED_IN: 0, READS: 0, WRITES: 0, FLOWS_TO: 0,
      EXPORTS: 0, INSTANTIATES: 0, HAS_SECTION: 0, PARENT_SECTION: 0,
      CONTAINS_CODE: 0, LINKS_TO: 0,
    };

    let totalEdges = 0;
    for (const row of edgesResult.data ?? []) {
      const label = row.label as EdgeLabel;
      if (label in edgesByType) {
        edgesByType[label] = row.count;
        totalEdges += row.count;
      }
    }

    const largestFilesResult = await this.client.roQuery<{
      path: string;
      entityCount: number;
    }>(QUERY_CYPHER.GET_LARGEST_FILES);

    const largestFiles = (largestFilesResult.data ?? []).map((row) => ({
      path: row.path,
      entityCount: row.entityCount,
    }));

    const mostConnectedResult = await this.client.roQuery<{
      name: string;
      filePath: string;
      connectionCount: number;
    }>(QUERY_CYPHER.GET_MOST_CONNECTED);

    const mostConnected = (mostConnectedResult.data ?? []).map((row) => ({
      name: row.name,
      filePath: row.filePath,
      connectionCount: row.connectionCount,
    }));

    return {
      totalNodes, totalEdges, nodesByType, edgesByType, largestFiles, mostConnected,
    };
  }

  async search(term: string, types?: NodeLabel[], limit = 50): Promise<SearchResult[]> {
    const result = await this.client.roQuery<{
      n: Record<string, unknown>;
      labels: string[];
    }>(QUERY_CYPHER.SEARCH_BY_NAME, { params: { term, limit } });

    const results: SearchResult[] = [];

    for (const row of result.data ?? []) {
      const label = getLabelFromLabels(row.labels);
      if (types && !types.includes(label)) continue;

      results.push({
        id: generateNodeIdFromProps(label, row.n),
        name: (row.n['name'] as string) ?? (row.n['path'] as string) ?? 'unknown',
        type: label,
        filePath: (row.n['filePath'] as string) ?? (row.n['path'] as string) ?? '',
        line: (row.n['startLine'] as number) ?? (row.n['line'] as number),
      });
    }

    return results;
  }
}

/**
 * Create graph queries instance from client
 */
export function createQueries(client: GraphClient): GraphQueries {
  return new GraphQueriesImpl(client);
}
