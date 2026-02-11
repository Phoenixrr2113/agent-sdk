/**
 * @agntk/brain - Graph Types
 * Types for graph visualization and queries
 */

import type {
  NodeLabel,
  FileEntity,
  ClassEntity,
  InterfaceEntity,
  FunctionEntity,
  VariableEntity,
  ImportEntity,
  TypeEntity,
  ComponentEntity,
} from './nodes';
import type { Edge, EdgeLabel } from './edges';

export type GraphNodeBase = {
  id: string;
  label: NodeLabel;
  displayName: string;
  filePath?: string;
};

export type FileGraphNode = GraphNodeBase & {
  label: 'File';
  data: FileEntity;
};

export type ClassGraphNode = GraphNodeBase & {
  label: 'Class';
  data: ClassEntity;
};

export type InterfaceGraphNode = GraphNodeBase & {
  label: 'Interface';
  data: InterfaceEntity;
};

export type FunctionGraphNode = GraphNodeBase & {
  label: 'Function';
  data: FunctionEntity;
};

export type VariableGraphNode = GraphNodeBase & {
  label: 'Variable';
  data: VariableEntity;
};

export type ImportGraphNode = GraphNodeBase & {
  label: 'Import';
  data: ImportEntity;
};

export type TypeGraphNode = GraphNodeBase & {
  label: 'Type';
  data: TypeEntity;
};

export type ComponentGraphNode = GraphNodeBase & {
  label: 'Component';
  data: ComponentEntity;
};

export type GraphNode =
  | FileGraphNode
  | ClassGraphNode
  | InterfaceGraphNode
  | FunctionGraphNode
  | VariableGraphNode
  | ImportGraphNode
  | TypeGraphNode
  | ComponentGraphNode;

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label: EdgeLabel;
  data: Edge;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SubgraphData = GraphData & {
  centerId?: string;
};

export type GraphStats = {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<NodeLabel, number>;
  edgesByType: Record<EdgeLabel, number>;
  largestFiles: Array<{ path: string; entityCount: number }>;
  mostConnected: Array<{ name: string; filePath: string; connectionCount: number }>;
};

export type SearchResult = {
  id: string;
  name: string;
  type: NodeLabel;
  filePath: string;
  line?: number;
  score?: number;
};

export type ParseStats = {
  files: number;
  entities: number;
  edges: number;
  durationMs: number;
};

export type ParseResult = {
  status: 'processing' | 'complete' | 'error';
  stats?: ParseStats;
  error?: string;
};
