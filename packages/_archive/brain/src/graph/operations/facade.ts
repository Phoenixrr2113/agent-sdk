/**
 * GraphOperations facade — composes sub-module implementations
 * into the unified interface that existing consumers expect.
 */

import type { GraphClient } from '../client';
import type {
  ParsedFileEntities,
  FileEntity,
  FunctionEntity,
  ClassEntity,
  InterfaceEntity,
  VariableEntity,
  TypeEntity,
  ComponentEntity,
  CommitEntity,
  EntityAliasNodeProps,
  ContradictionNodeProps,
} from '../schema';
import { episodeToNodeProps, experienceToNodeProps } from '../schema';
import type { ProjectEntity } from '../../types';
import type { EpisodeRow } from './episode-ops';

import { FileOpsImpl } from './file-ops';
import { EpisodeOpsImpl } from './episode-ops';
import { EntityOpsImpl } from './entity-ops';
import { QueryOpsImpl } from './query-ops';

/**
 * Graph CRUD operations interface (unchanged from original).
 */
export interface GraphOperations {
  upsertFile(file: FileEntity): Promise<void>;
  upsertFunction(fn: FunctionEntity): Promise<void>;
  upsertClass(cls: ClassEntity): Promise<void>;
  upsertInterface(iface: InterfaceEntity): Promise<void>;
  upsertVariable(variable: VariableEntity): Promise<void>;
  upsertType(type: TypeEntity): Promise<void>;
  upsertComponent(component: ComponentEntity): Promise<void>;

  createCallEdge(
    callerName: string, callerFile: string,
    calleeName: string, calleeFile: string,
    line: number
  ): Promise<void>;
  createImportsEdge(fromPath: string, toPath: string, specifiers?: string[]): Promise<void>;
  createExtendsEdge(childName: string, childFile: string, parentName: string, parentFile?: string): Promise<void>;
  createImplementsEdge(className: string, classFile: string, interfaceName: string, interfaceFile?: string): Promise<void>;
  createRendersEdge(parentName: string, parentFile: string, childName: string, line: number): Promise<void>;

  deleteFileEntities(filePath: string): Promise<void>;
  clearAll(): Promise<void>;
  batchUpsert(entities: ParsedFileEntities): Promise<void>;

  // Project operations
  upsertProject(project: ProjectEntity): Promise<void>;
  getProjects(): Promise<ProjectEntity[]>;
  getProjectByRoot(rootPath: string): Promise<ProjectEntity | null>;
  deleteProject(projectId: string): Promise<void>;
  linkProjectFile(projectId: string, filePath: string): Promise<void>;

  // Commit operations
  upsertCommit(commit: CommitEntity): Promise<void>;
  createModifiedInEdge(
    filePath: string, commitHash: string,
    linesAdded?: number, linesRemoved?: number, complexityDelta?: number
  ): Promise<void>;

  // Episode operations (episodic memory)
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

  // Entity Resolution operations
  upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void>;
  createAliasOfEdge(aliasName: string, entityId: string): Promise<void>;
  getEntityAliases(entityId: string): Promise<unknown[]>;
  findCanonicalEntity(aliasName: string): Promise<unknown[]>;

  // Contradiction operations
  upsertContradiction(contradiction: ContradictionNodeProps): Promise<void>;
  getUnresolvedContradictions(): Promise<unknown[]>;
  resolveContradiction(id: string, winner: string, reasoning: string): Promise<void>;
}

/**
 * Facade that delegates to focused sub-module implementations.
 */
class GraphOperationsFacade implements GraphOperations {
  private readonly fileOps: FileOpsImpl;
  private readonly episodeOps: EpisodeOpsImpl;
  private readonly entityOps: EntityOpsImpl;
  private readonly queryOps: QueryOpsImpl;

  constructor(client: GraphClient) {
    this.fileOps = new FileOpsImpl(client);
    this.episodeOps = new EpisodeOpsImpl(client);
    this.entityOps = new EntityOpsImpl(client);
    this.queryOps = new QueryOpsImpl(client);
  }

  // File ops
  upsertFile = (file: FileEntity) => this.fileOps.upsertFile(file);
  upsertFunction = (fn: FunctionEntity) => this.fileOps.upsertFunction(fn);
  upsertClass = (cls: ClassEntity) => this.fileOps.upsertClass(cls);
  upsertInterface = (iface: InterfaceEntity) => this.fileOps.upsertInterface(iface);
  upsertVariable = (variable: VariableEntity) => this.fileOps.upsertVariable(variable);
  upsertType = (type: TypeEntity) => this.fileOps.upsertType(type);
  upsertComponent = (component: ComponentEntity) => this.fileOps.upsertComponent(component);
  createCallEdge = (...args: Parameters<FileOpsImpl['createCallEdge']>) => this.fileOps.createCallEdge(...args);
  createImportsEdge = (...args: Parameters<FileOpsImpl['createImportsEdge']>) => this.fileOps.createImportsEdge(...args);
  createExtendsEdge = (...args: Parameters<FileOpsImpl['createExtendsEdge']>) => this.fileOps.createExtendsEdge(...args);
  createImplementsEdge = (...args: Parameters<FileOpsImpl['createImplementsEdge']>) => this.fileOps.createImplementsEdge(...args);
  createRendersEdge = (...args: Parameters<FileOpsImpl['createRendersEdge']>) => this.fileOps.createRendersEdge(...args);
  deleteFileEntities = (filePath: string) => this.fileOps.deleteFileEntities(filePath);
  clearAll = () => this.fileOps.clearAll();
  batchUpsert = (entities: ParsedFileEntities) => this.fileOps.batchUpsert(entities);

  // Project / commit ops
  upsertProject = (project: ProjectEntity) => this.queryOps.upsertProject(project);
  getProjects = () => this.queryOps.getProjects();
  getProjectByRoot = (rootPath: string) => this.queryOps.getProjectByRoot(rootPath);
  deleteProject = (projectId: string) => this.queryOps.deleteProject(projectId);
  linkProjectFile = (projectId: string, filePath: string) => this.queryOps.linkProjectFile(projectId, filePath);
  upsertCommit = (commit: CommitEntity) => this.queryOps.upsertCommit(commit);
  createModifiedInEdge = (...args: Parameters<QueryOpsImpl['createModifiedInEdge']>) => this.queryOps.createModifiedInEdge(...args);

  // Episode ops
  upsertEpisode = (episode: Parameters<typeof episodeToNodeProps>[0]) => this.episodeOps.upsertEpisode(episode);
  upsertExperience = (experience: Parameters<typeof experienceToNodeProps>[0]) => this.episodeOps.upsertExperience(experience);
  linkEpisodeEntity = (episodeId: string, entityName: string) => this.episodeOps.linkEpisodeEntity(episodeId, entityName);
  linkEpisodeExperience = (episodeId: string) => this.episodeOps.linkEpisodeExperience(episodeId);
  getEpisodesByQuery = (query: string, limit: number) => this.episodeOps.getEpisodesByQuery(query, limit);
  getEpisodeById = (id: string) => this.episodeOps.getEpisodeById(id);
  getAllEpisodes = (limit: number) => this.episodeOps.getAllEpisodes(limit);
  getExperiencesForEpisode = (episodeId: string) => this.episodeOps.getExperiencesForEpisode(episodeId);
  countEpisodes = () => this.episodeOps.countEpisodes();
  pruneOldEpisodes = (count: number) => this.episodeOps.pruneOldEpisodes(count);

  // Entity resolution ops
  upsertEntityAlias = (alias: EntityAliasNodeProps) => this.entityOps.upsertEntityAlias(alias);
  createAliasOfEdge = (aliasName: string, entityId: string) => this.entityOps.createAliasOfEdge(aliasName, entityId);
  getEntityAliases = (entityId: string) => this.entityOps.getEntityAliases(entityId);
  findCanonicalEntity = (aliasName: string) => this.entityOps.findCanonicalEntity(aliasName);

  // Contradiction ops
  upsertContradiction = (contradiction: ContradictionNodeProps) => this.entityOps.upsertContradiction(contradiction);
  getUnresolvedContradictions = () => this.entityOps.getUnresolvedContradictions();
  resolveContradiction = (id: string, winner: string, reasoning: string) => this.entityOps.resolveContradiction(id, winner, reasoning);
}

/**
 * Create graph operations instance from client
 */
export function createOperations(client: GraphClient): GraphOperations {
  return new GraphOperationsFacade(client);
}
