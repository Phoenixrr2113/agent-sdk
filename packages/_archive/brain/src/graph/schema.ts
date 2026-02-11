/**
 * @codegraph/graph - Schema Types
 * Cypher-compatible types and mappers for graph operations
 */

import type {
  FileEntity,
  FunctionEntity,
  ClassEntity,
  InterfaceEntity,
  VariableEntity,
  TypeEntity,
  ComponentEntity,
  ImportEntity,
  CommitEntity,
  NodeLabel,
  EdgeLabel,
} from '../types';

// ============================================================================
// Node Property Types (for Cypher MERGE statements)
// ============================================================================

/**
 * File node properties for Cypher operations
 */
export interface FileNodeProps {
  path: string;
  name: string;
  extension: string;
  loc: number;
  lastModified: string;
  hash: string;
}

/**
 * Function node properties for Cypher operations
 */
export interface FunctionNodeProps {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAsync: boolean;
  isArrow: boolean;
  params: string; // JSON serialized params
  returnType: string | null;
  docstring: string | null;
  complexity: number | null;
  cognitiveComplexity: number | null;
  nestingDepth: number | null;
}

/**
 * Class node properties for Cypher operations
 */
export interface ClassNodeProps {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  isAbstract: boolean;
  extends: string | null;
  implements: string | null; // JSON serialized array
  docstring: string | null;
}

/**
 * Interface node properties for Cypher operations
 */
export interface InterfaceNodeProps {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  extends: string | null; // JSON serialized array
  docstring: string | null;
}

/**
 * Variable node properties for Cypher operations
 */
export interface VariableNodeProps {
  name: string;
  filePath: string;
  line: number;
  kind: string;
  isExported: boolean;
  type: string | null;
}

/**
 * Type node properties for Cypher operations
 */
export interface TypeNodeProps {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  kind: string;
  docstring: string | null;
}

/**
 * Component node properties for Cypher operations
 */
export interface ComponentNodeProps {
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  isExported: boolean;
  props: string | null; // JSON serialized props
  propsType: string | null;
}

/**
 * Commit node properties for Cypher operations
 */
export interface CommitNodeProps {
  hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
}

/**
 * Episode node properties for Cypher operations (episodic memory)
 */
export interface EpisodeNodeProps {
  id: string;
  timestamp: string;
  type: 'conversation' | 'observation' | 'action' | 'decision' | 'learning';
  summary: string;
  content: string;
  context_project: string | null;
  context_task: string | null;
  entities: string;
  relationships: string;
  outcome_success: boolean | null;
  outcome_result: string | null;
  outcome_lessons: string | null;
}

/**
 * Experience node properties for Cypher operations (episodic memory)
 */
export interface ExperienceNodeProps {
  id: string;
  episodeId: string;
  timestamp: string;
  situation: string;
  action: string;
  result: string;
  evaluation: 'positive' | 'negative' | 'neutral';
  lessonsLearned: string;
  applicableContexts: string;
}

/**
 * EntityAlias node properties for Cypher operations
 */
export interface EntityAliasNodeProps {
  name: string; // The alias name
  source: string;
  confidence: number;
  lastUpdated: string;
}

/**
 * Contradiction node properties for Cypher operations
 */
export interface ContradictionNodeProps {
  id: string;
  detectedAt: string;
  resolution_winner: string | null;
  resolution_reasoning: string | null;
  factA_id: string;
  factA_statement: string;
  factA_source: string;
  factA_timestamp: string;
  factB_id: string;
  factB_statement: string;
  factB_source: string;
  factB_timestamp: string;
}

// ============================================================================
// Entity to Node Property Mappers
// ============================================================================

/**
 * Convert FileEntity to Cypher-compatible node properties
 */
export function fileToNodeProps(entity: FileEntity): FileNodeProps {
  return {
    path: entity.path,
    name: entity.name,
    extension: entity.extension,
    loc: entity.loc,
    lastModified: entity.lastModified,
    hash: entity.hash,
  };
}

/**
 * Convert FunctionEntity to Cypher-compatible node properties
 */
export function functionToNodeProps(entity: FunctionEntity): FunctionNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    startLine: entity.startLine,
    endLine: entity.endLine,
    isExported: entity.isExported,
    isAsync: entity.isAsync,
    isArrow: entity.isArrow,
    params: JSON.stringify(entity.params),
    returnType: entity.returnType ?? null,
    docstring: entity.docstring ?? null,
    complexity: entity.complexity ?? null,
    cognitiveComplexity: entity.cognitiveComplexity ?? null,
    nestingDepth: entity.nestingDepth ?? null,
  };
}

/**
 * Convert ClassEntity to Cypher-compatible node properties
 */
export function classToNodeProps(entity: ClassEntity): ClassNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    startLine: entity.startLine,
    endLine: entity.endLine,
    isExported: entity.isExported,
    isAbstract: entity.isAbstract,
    extends: entity.extends ?? null,
    implements: entity.implements ? JSON.stringify(entity.implements) : null,
    docstring: entity.docstring ?? null,
  };
}

/**
 * Convert InterfaceEntity to Cypher-compatible node properties
 */
export function interfaceToNodeProps(entity: InterfaceEntity): InterfaceNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    startLine: entity.startLine,
    endLine: entity.endLine,
    isExported: entity.isExported,
    extends: entity.extends ? JSON.stringify(entity.extends) : null,
    docstring: entity.docstring ?? null,
  };
}

/**
 * Convert VariableEntity to Cypher-compatible node properties
 */
export function variableToNodeProps(entity: VariableEntity): VariableNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    line: entity.line,
    kind: entity.kind,
    isExported: entity.isExported,
    type: entity.type ?? null,
  };
}

/**
 * Convert TypeEntity to Cypher-compatible node properties
 */
export function typeToNodeProps(entity: TypeEntity): TypeNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    startLine: entity.startLine,
    endLine: entity.endLine,
    isExported: entity.isExported,
    kind: entity.kind,
    docstring: entity.docstring ?? null,
  };
}

/**
 * Convert ComponentEntity to Cypher-compatible node properties
 */
export function componentToNodeProps(entity: ComponentEntity): ComponentNodeProps {
  return {
    name: entity.name,
    filePath: entity.filePath,
    startLine: entity.startLine,
    endLine: entity.endLine,
    isExported: entity.isExported,
    props: entity.props ? JSON.stringify(entity.props) : null,
    propsType: entity.propsType ?? null,
  };
}

/**
 * Convert CommitEntity to Cypher-compatible node properties
 */
export function commitToNodeProps(entity: CommitEntity): CommitNodeProps {
  return {
    hash: entity.hash,
    message: entity.message,
    author: entity.author,
    email: entity.email,
    date: entity.date,
  };
}

/**
 * Convert Episode to Cypher-compatible node properties
 */
export function episodeToNodeProps(episode: {
  id: string;
  timestamp: string;
  type: 'conversation' | 'observation' | 'action' | 'decision' | 'learning';
  summary: string;
  content: string;
  context?: {
    participants?: string[];
    location?: string;
    project?: string;
    task?: string;
  };
  entities: string[];
  relationships: string[];
  outcome?: {
    success?: boolean;
    result?: string;
    lessons?: string[];
  };
}): EpisodeNodeProps {
  return {
    id: episode.id,
    timestamp: episode.timestamp,
    type: episode.type,
    summary: episode.summary,
    content: episode.content,
    context_project: episode.context?.project ?? null,
    context_task: episode.context?.task ?? null,
    entities: JSON.stringify(episode.entities),
    relationships: JSON.stringify(episode.relationships),
    outcome_success: episode.outcome?.success ?? null,
    outcome_result: episode.outcome?.result ?? null,
    outcome_lessons: episode.outcome?.lessons ? JSON.stringify(episode.outcome.lessons) : null,
  };
}

/**
 * Convert Experience to Cypher-compatible node properties
 */
export function experienceToNodeProps(experience: {
  id: string;
  episodeId: string;
  timestamp: string;
  situation: string;
  action: string;
  result: string;
  evaluation: 'positive' | 'negative' | 'neutral';
  lessonsLearned: string[];
  applicableContexts: string[];
}): ExperienceNodeProps {
  return {
    id: experience.id,
    episodeId: experience.episodeId,
    timestamp: experience.timestamp,
    situation: experience.situation,
    action: experience.action,
    result: experience.result,
    evaluation: experience.evaluation,
    lessonsLearned: JSON.stringify(experience.lessonsLearned),
    applicableContexts: JSON.stringify(experience.applicableContexts),
  };
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate a unique node ID for graph operations
 * Uses a deterministic format based on entity properties
 */
export function generateNodeId(label: NodeLabel, entity: { name: string; filePath: string; startLine?: number; line?: number }): string {
  const line = 'startLine' in entity ? entity.startLine : ('line' in entity ? entity.line : 0);
  return `${label}:${entity.filePath}:${entity.name}:${line}`;
}

/**
 * Generate a File node ID
 */
export function generateFileNodeId(path: string): string {
  return `File:${path}`;
}

/**
 * Generate an edge ID
 */
export function generateEdgeId(label: EdgeLabel, fromId: string, toId: string): string {
  return `${label}:${fromId}->${toId}`;
}

// ============================================================================
// Parsed File Result Type (for batch operations)
// ============================================================================

/**
 * Result of parsing a single file - all entities and edges
 */
export interface ParsedFileEntities {
  file: FileEntity;
  functions: FunctionEntity[];
  classes: ClassEntity[];
  interfaces: InterfaceEntity[];
  variables: VariableEntity[];
  types: TypeEntity[];
  components: ComponentEntity[];
  imports: ImportEntity[];
  callEdges: Array<{ callerId: string; calleeId: string; line: number }>;
  importsEdges: Array<{ fromFilePath: string; toFilePath: string; specifiers?: string[] }>;
  extendsEdges: Array<{ childId: string; parentId: string }>;
  implementsEdges: Array<{ classId: string; interfaceId: string }>;
  rendersEdges: Array<{ parentId: string; childId: string; line: number }>;
}

// ============================================================================
// Type Re-exports
// ============================================================================

export type {
  FileEntity,
  FunctionEntity,
  ClassEntity,
  InterfaceEntity,
  VariableEntity,
  TypeEntity,
  ComponentEntity,
  ImportEntity,
  CommitEntity,
  NodeLabel,
  EdgeLabel,
};
