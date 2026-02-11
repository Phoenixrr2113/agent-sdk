/**
 * QueryPort — abstract interface for graph backend operations.
 *
 * This interface decouples business logic from the graph backend.
 * Implementations: FalkorDB (current), Graphology (planned in P0-GRAPH-001).
 */

import type {
  GraphData,
  SubgraphData,
  GraphStats,
  SearchResult,
  FunctionEntity,
  NodeLabel,
  ProjectEntity,
  FileEntity,
  ClassEntity,
  InterfaceEntity,
  VariableEntity,
  TypeEntity,
  ComponentEntity,
  CommitEntity,
} from '../types';
import type { ParsedFileEntities, EntityAliasNodeProps, ContradictionNodeProps } from './schema';
import { episodeToNodeProps, experienceToNodeProps } from './schema';
import type { EpisodeRow } from './operations/episode-ops';

/**
 * QueryPort — backend-agnostic graph operations interface.
 *
 * Combines both read (query) and write (mutation) operations.
 * Graph backend implementations must satisfy this entire interface.
 */
export interface QueryPort {
  // ── Write operations ───────────────────────────────────────────────────

  /** Upsert a file node */
  upsertFile(file: FileEntity): Promise<void>;
  /** Upsert a function node (with CONTAINS edge to file) */
  upsertFunction(fn: FunctionEntity): Promise<void>;
  /** Upsert a class node */
  upsertClass(cls: ClassEntity): Promise<void>;
  /** Upsert an interface node */
  upsertInterface(iface: InterfaceEntity): Promise<void>;
  /** Upsert a variable node */
  upsertVariable(variable: VariableEntity): Promise<void>;
  /** Upsert a type node */
  upsertType(type: TypeEntity): Promise<void>;
  /** Upsert a component node */
  upsertComponent(component: ComponentEntity): Promise<void>;

  /** Create a CALLS edge */
  createCallEdge(callerName: string, callerFile: string, calleeName: string, calleeFile: string, line: number): Promise<void>;
  /** Create an IMPORTS edge */
  createImportsEdge(fromPath: string, toPath: string, specifiers?: string[]): Promise<void>;
  /** Create an EXTENDS edge */
  createExtendsEdge(childName: string, childFile: string, parentName: string, parentFile?: string): Promise<void>;
  /** Create an IMPLEMENTS edge */
  createImplementsEdge(className: string, classFile: string, interfaceName: string, interfaceFile?: string): Promise<void>;
  /** Create a RENDERS edge */
  createRendersEdge(parentName: string, parentFile: string, childName: string, line: number): Promise<void>;

  /** Delete file and all contained entities */
  deleteFileEntities(filePath: string): Promise<void>;
  /** Clear the entire graph */
  clearAll(): Promise<void>;
  /** Batch upsert a parsed file's entities */
  batchUpsert(entities: ParsedFileEntities): Promise<void>;

  // ── Project operations ─────────────────────────────────────────────────

  upsertProject(project: ProjectEntity): Promise<void>;
  getProjects(): Promise<ProjectEntity[]>;
  getProjectByRoot(rootPath: string): Promise<ProjectEntity | null>;
  deleteProject(projectId: string): Promise<void>;
  linkProjectFile(projectId: string, filePath: string): Promise<void>;

  // ── Commit operations ──────────────────────────────────────────────────

  upsertCommit(commit: CommitEntity): Promise<void>;
  createModifiedInEdge(filePath: string, commitHash: string, linesAdded?: number, linesRemoved?: number, complexityDelta?: number): Promise<void>;

  // ── Episode operations ─────────────────────────────────────────────────

  upsertEpisode(episode: Parameters<typeof episodeToNodeProps>[0]): Promise<void>;
  upsertExperience(experience: Parameters<typeof experienceToNodeProps>[0]): Promise<void>;
  linkEpisodeEntity(episodeId: string, entityName: string): Promise<void>;
  linkEpisodeExperience(episodeId: string): Promise<void>;
  getEpisodesByQuery(query: string, limit: number): Promise<EpisodeRow[]>;
  getEpisodeById(id: string): Promise<EpisodeRow[]>;
  getAllEpisodes(limit: number): Promise<EpisodeRow[]>;
  getExperiencesForEpisode(episodeId: string): Promise<unknown[]>;
  countEpisodes(): Promise<number>;
  pruneOldEpisodes(count: number): Promise<number>;

  // ── Entity resolution ──────────────────────────────────────────────────

  upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void>;
  createAliasOfEdge(aliasName: string, entityId: string): Promise<void>;
  getEntityAliases(entityId: string): Promise<unknown[]>;
  findCanonicalEntity(aliasName: string): Promise<unknown[]>;

  // ── Contradiction ──────────────────────────────────────────────────────

  upsertContradiction(contradiction: ContradictionNodeProps): Promise<void>;
  getUnresolvedContradictions(): Promise<unknown[]>;
  resolveContradiction(id: string, winner: string, reasoning: string): Promise<void>;

  // ── Read operations (queries) ──────────────────────────────────────────

  /** Get the full graph (limited) */
  getFullGraph(limit?: number, rootPath?: string): Promise<GraphData>;
  /** Get subgraph for a specific file */
  getFileSubgraph(filePath: string): Promise<SubgraphData>;
  /** Get all functions that call a given function */
  getFunctionCallers(funcName: string): Promise<FunctionEntity[]>;
  /** Get import dependency tree from a file */
  getDependencyTree(filePath: string, depth?: number): Promise<GraphData>;
  /** Get graph statistics */
  getStats(): Promise<GraphStats>;
  /** Search for entities by name */
  search(term: string, types?: NodeLabel[], limit?: number): Promise<SearchResult[]>;

  // ── Lifecycle ──────────────────────────────────────────────────────────

  /** Ensure all required indexes exist */
  ensureIndexes(): Promise<void>;
  /** Close the backend connection */
  close(): Promise<void>;
}
