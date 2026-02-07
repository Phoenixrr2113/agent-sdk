/**
 * @codegraph/graph - CRUD Operations
 * Graph database operations for entities and edges
 * Based on CodeGraph MVP Specification Section 6.2
 */

import type { GraphClient, QueryParams } from './client';
import { createLogger } from '@agent/logger';
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
  type ParsedFileEntities,
  type FileEntity,
  type FunctionEntity,
  type ClassEntity,
  type InterfaceEntity,
  type VariableEntity,
  type TypeEntity,
  type ComponentEntity,
  type CommitEntity,
  type EntityAliasNodeProps,
  type ContradictionNodeProps,
} from './schema';
import type { ProjectEntity } from '../types';

// ============================================================================
// Cypher Query Templates
// ============================================================================

const CYPHER = {
  // File operations
  UPSERT_FILE: `
    MERGE (f:File {path: $path})
    SET f.name = $name,
        f.extension = $extension,
        f.loc = $loc,
        f.lastModified = $lastModified,
        f.hash = $hash
    RETURN f
  `,

  // Function operations - creates CONTAINS edge to File
  UPSERT_FUNCTION: `
    MERGE (fn:Function {name: $name, filePath: $filePath, startLine: $startLine})
    SET fn.endLine = $endLine,
        fn.isExported = $isExported,
        fn.isAsync = $isAsync,
        fn.isArrow = $isArrow,
        fn.params = $params,
        fn.returnType = $returnType,
        fn.docstring = $docstring,
        fn.complexity = $complexity,
        fn.cognitiveComplexity = $cognitiveComplexity,
        fn.nestingDepth = $nestingDepth
    WITH fn
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(fn)
    RETURN fn
  `,

  // Class operations - creates CONTAINS edge to File
  UPSERT_CLASS: `
    MERGE (c:Class {name: $name, filePath: $filePath, startLine: $startLine})
    SET c.endLine = $endLine,
        c.isExported = $isExported,
        c.isAbstract = $isAbstract,
        c.extends = $extends,
        c.implements = $implements,
        c.docstring = $docstring
    WITH c
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(c)
    RETURN c
  `,

  // Interface operations - creates CONTAINS edge to File
  UPSERT_INTERFACE: `
    MERGE (i:Interface {name: $name, filePath: $filePath, startLine: $startLine})
    SET i.endLine = $endLine,
        i.isExported = $isExported,
        i.extends = $extends,
        i.docstring = $docstring
    WITH i
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(i)
    RETURN i
  `,

  // Variable operations - creates CONTAINS edge to File
  UPSERT_VARIABLE: `
    MERGE (v:Variable {name: $name, filePath: $filePath, line: $line})
    SET v.kind = $kind,
        v.isExported = $isExported,
        v.type = $type
    WITH v
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(v)
    RETURN v
  `,

  // Type operations - creates CONTAINS edge to File
  UPSERT_TYPE: `
    MERGE (t:Type {name: $name, filePath: $filePath, startLine: $startLine})
    SET t.endLine = $endLine,
        t.isExported = $isExported,
        t.kind = $kind,
        t.docstring = $docstring
    WITH t
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(t)
    RETURN t
  `,

  // Component operations - creates CONTAINS edge to File
  UPSERT_COMPONENT: `
    MERGE (comp:Component {name: $name, filePath: $filePath, startLine: $startLine})
    SET comp.endLine = $endLine,
        comp.isExported = $isExported,
        comp.props = $props,
        comp.propsType = $propsType
    WITH comp
    MATCH (f:File {path: $filePath})
    MERGE (f)-[:CONTAINS]->(comp)
    RETURN comp
  `,

  // Edge operations
  CREATE_CALLS_EDGE: `
    MATCH (caller:Function {name: $callerName, filePath: $callerFile})
    MATCH (callee:Function {name: $calleeName, filePath: $calleeFile})
    MERGE (caller)-[c:CALLS]->(callee)
    ON CREATE SET c.line = $line, c.count = 1
    ON MATCH SET c.count = c.count + 1
    RETURN c
  `,

  CREATE_IMPORTS_EDGE: `
    MATCH (from:File {path: $fromPath})
    MERGE (to:File {path: $toPath})
    ON CREATE SET to:External
    MERGE (from)-[i:IMPORTS]->(to)
    SET i.specifiers = $specifiers
    RETURN i
  `,

  CREATE_EXTENDS_EDGE: `
    MATCH (child:Class {name: $childName, filePath: $childFile})
    MERGE (parent:Class {name: $parentName, filePath: COALESCE($parentFile, 'external')})
    ON CREATE SET parent:External
    MERGE (child)-[e:EXTENDS]->(parent)
    RETURN e
  `,

  CREATE_IMPLEMENTS_EDGE: `
    MATCH (c:Class {name: $className, filePath: $classFile})
    MERGE (i:Interface {name: $interfaceName, filePath: COALESCE($interfaceFile, 'external')})
    ON CREATE SET i:External
    MERGE (c)-[impl:IMPLEMENTS]->(i)
    RETURN impl
  `,

  CREATE_RENDERS_EDGE: `
    MATCH (parent:Component {name: $parentName, filePath: $parentFile})
    MATCH (child:Component {name: $childName})
    MERGE (parent)-[r:RENDERS]->(child)
    SET r.line = $line
    RETURN r
  `,

  // Commit operations
  UPSERT_COMMIT: `
    MERGE (c:Commit {hash: $hash})
    SET c.message = $message,
        c.author = $author,
        c.email = $email,
        c.date = $date
    RETURN c
  `,

  // Temporal edge operations
  CREATE_INTRODUCED_IN_EDGE: `
    MATCH (entity) WHERE id(entity) = $entityId
    MATCH (c:Commit {hash: $commitHash})
    MERGE (entity)-[r:INTRODUCED_IN]->(c)
    RETURN r
  `,

  CREATE_MODIFIED_IN_EDGE: `
    MATCH (f:File {path: $filePath})
    MATCH (c:Commit {hash: $commitHash})
    MERGE (f)-[r:MODIFIED_IN]->(c)
    SET r.linesAdded = $linesAdded,
        r.linesRemoved = $linesRemoved,
        r.complexityDelta = $complexityDelta
    RETURN r
  `,

  CREATE_DELETED_IN_EDGE: `
    MATCH (entity) WHERE id(entity) = $entityId
    MATCH (c:Commit {hash: $commitHash})
    MERGE (entity)-[r:DELETED_IN]->(c)
    RETURN r
  `,

  // Dataflow edge operations
  CREATE_READS_EDGE: `
    MATCH (fn:Function {name: $functionName, filePath: $functionFile})
    MATCH (v:Variable {name: $variableName, filePath: $variableFile})
    MERGE (fn)-[r:READS]->(v)
    SET r.line = $line
    RETURN r
  `,

  CREATE_WRITES_EDGE: `
    MATCH (fn:Function {name: $functionName, filePath: $functionFile})
    MATCH (v:Variable {name: $variableName, filePath: $variableFile})
    MERGE (fn)-[r:WRITES]->(v)
    SET r.line = $line
    RETURN r
  `,

  CREATE_FLOWS_TO_EDGE: `
    MATCH (source) WHERE id(source) = $sourceId
    MATCH (target) WHERE id(target) = $targetId
    MERGE (source)-[r:FLOWS_TO]->(target)
    SET r.transformation = $transformation,
        r.tainted = $tainted,
        r.sanitized = $sanitized
    RETURN r
  `,

  CREATE_FLOWS_TO_EDGE_BY_NAME: `
    MATCH (source {name: $sourceName, filePath: $sourceFile})
    MATCH (target {name: $targetName, filePath: $targetFile})
    MERGE (source)-[r:FLOWS_TO]->(target)
    SET r.transformation = $transformation,
        r.tainted = $tainted,
        r.sanitized = $sanitized
    RETURN r
  `,

  // Export edge operations
  CREATE_EXPORTS_EDGE: `
    MATCH (f:File {path: $filePath})
    MATCH (symbol {name: $symbolName, filePath: $filePath})
    MERGE (f)-[r:EXPORTS]->(symbol)
    SET r.asName = $asName,
        r.isDefault = $isDefault
    RETURN r
  `,

  GET_FILE_EXPORTS: `
    MATCH (f:File {path: $filePath})-[r:EXPORTS]->(symbol)
    RETURN symbol.name as name, labels(symbol)[0] as type, r.asName as asName, r.isDefault as isDefault
  `,

  // Instantiation edge operations
  CREATE_INSTANTIATES_EDGE: `
    MATCH (fn:Function {name: $functionName, filePath: $functionFile})
    MERGE (c:Class {name: $className, filePath: COALESCE($classFile, 'external')})
    ON CREATE SET c:External
    MERGE (fn)-[r:INSTANTIATES]->(c)
    SET r.line = $line
    RETURN r
  `,

  GET_CLASS_INSTANTIATIONS: `
    MATCH (fn:Function)-[r:INSTANTIATES]->(c:Class {name: $className})
    RETURN fn.name as functionName, fn.filePath as functionFile, r.line as line
  `,

  // Delete operations - cascade delete file and all contained entities
  DELETE_FILE_ENTITIES: `
    MATCH (f:File {path: $path})-[:CONTAINS]->(e)
    DETACH DELETE e
    WITH f
    DETACH DELETE f
  `,

  // Count nodes for a file
  COUNT_FILE_ENTITIES: `
    MATCH (f:File {path: $path})-[:CONTAINS]->(e)
    RETURN count(e) as count
  `,

  // Clear all nodes and edges from the graph
  CLEAR_ALL: `
    MATCH (n)
    DETACH DELETE n
  `,

  // Project operations
  UPSERT_PROJECT: `
    MERGE (p:Project {id: $id})
    SET p.name = $name,
        p.rootPath = $rootPath,
        p.createdAt = $createdAt,
        p.lastParsed = $lastParsed,
        p.fileCount = $fileCount
    RETURN p
  `,

  GET_ALL_PROJECTS: `
    MATCH (p:Project)
    RETURN p
    ORDER BY p.lastParsed DESC
  `,

  GET_PROJECT_BY_ROOT: `
    MATCH (p:Project {rootPath: $rootPath})
    RETURN p
  `,

  DELETE_PROJECT: `
    MATCH (p:Project {id: $id})
    OPTIONAL MATCH (p)-[:HAS_FILE]->(f:File)-[:CONTAINS]->(e)
    DETACH DELETE e
    WITH p, f
    DETACH DELETE f
    WITH p
    DETACH DELETE p
  `,

  LINK_PROJECT_FILE: `
    MATCH (p:Project {id: $projectId})
    MATCH (f:File {path: $filePath})
    MERGE (p)-[:HAS_FILE]->(f)
  `,

  // Episode operations for episodic memory
  UPSERT_EPISODE: `
    MERGE (e:Episode {id: $id})
    SET e.timestamp = $timestamp,
        e.type = $type,
        e.summary = $summary,
        e.content = $content,
        e.context_project = $contextProject,
        e.context_task = $contextTask,
        e.entities = $entities,
        e.relationships = $relationships,
        e.outcome_success = $outcomeSuccess,
        e.outcome_result = $outcomeResult,
        e.outcome_lessons = $outcomeLessons
    RETURN e
  `,

  UPSERT_EXPERIENCE: `
    MERGE (ex:Experience {id: $id})
    SET ex.episodeId = $episodeId,
        ex.timestamp = $timestamp,
        ex.situation = $situation,
        ex.action = $action,
        ex.result = $result,
        ex.evaluation = $evaluation,
        ex.lessonsLearned = $lessonsLearned,
        ex.applicableContexts = $applicableContexts
    RETURN ex
  `,

  LINK_EPISODE_ENTITY: `
    MATCH (e:Episode {id: $episodeId})
    MATCH (entity {name: $entityName})
    MERGE (e)-[:MENTIONS]->(entity)
    RETURN e
  `,

  LINK_EPISODE_EXPERIENCE: `
    MATCH (e:Episode {id: $episodeId})
    MATCH (ex:Experience {episodeId: $episodeId})
    MERGE (e)-[:GENERATED]->(ex)
    RETURN e
  `,

  GET_EPISODES_BY_QUERY: `
    MATCH (e:Episode)
    WHERE toLower(e.content) CONTAINS toLower($query) 
       OR toLower(e.summary) CONTAINS toLower($query)
    RETURN e
    ORDER BY e.timestamp DESC
    LIMIT $limit
  `,

  GET_EPISODE_BY_ID: `
    MATCH (e:Episode {id: $id})
    RETURN e
  `,

  GET_ALL_EPISODES: `
    MATCH (e:Episode)
    RETURN e
    ORDER BY e.timestamp DESC
    LIMIT $limit
  `,

  GET_EXPERIENCES_FOR_EPISODE: `
    MATCH (e:Episode {id: $episodeId})-[:GENERATED]->(ex:Experience)
    RETURN ex
  `,

  COUNT_EPISODES: `
    MATCH (e:Episode)
    RETURN count(e) as count
  `,

  PRUNE_OLD_EPISODES: `
    MATCH (e:Episode)
    WITH e ORDER BY e.timestamp ASC LIMIT $limit
    DETACH DELETE e
    RETURN count(*) as deleted
  `,

  // Entity Resolution operations
  UPSERT_ENTITY_ALIAS: `
    MERGE (a:EntityAlias {name: $name})
    SET a.source = $source,
        a.confidence = $confidence,
        a.lastUpdated = $lastUpdated
    RETURN a
  `,

  CREATE_ALIAS_OF_EDGE: `
    MATCH (a:EntityAlias {name: $aliasName})
    MATCH (e) WHERE e.id = $entityId OR e.name = $entityId
    MERGE (a)-[:ALIAS_OF]->(e)
  `,

  GET_ENTITY_ALIASES: `
    MATCH (a:EntityAlias)-[:ALIAS_OF]->(e)
    WHERE e.id = $entityId OR e.name = $entityId
    RETURN a
  `,

  FIND_CANONICAL_ENTITY: `
    MATCH (a:EntityAlias {name: $aliasName})-[:ALIAS_OF]->(e)
    RETURN e
  `,

  // Contradiction operations
  UPSERT_CONTRADICTION: `
    MERGE (c:Contradiction {id: $id})
    SET c.detectedAt = $detectedAt,
        c.resolution_winner = $resolution_winner,
        c.resolution_reasoning = $resolution_reasoning,
        c.factA_id = $factA_id,
        c.factA_statement = $factA_statement,
        c.factA_source = $factA_source,
        c.factA_timestamp = $factA_timestamp,
        c.factB_id = $factB_id,
        c.factB_statement = $factB_statement,
        c.factB_source = $factB_source,
        c.factB_timestamp = $factB_timestamp
    RETURN c
  `,

  GET_UNRESOLVED_CONTRADICTIONS: `
    MATCH (c:Contradiction)
    WHERE c.resolution_winner IS NULL
    RETURN c
  `,

  RESOLVE_CONTRADICTION: `
    MATCH (c:Contradiction {id: $id})
    SET c.resolution_winner = $winner,
        c.resolution_reasoning = $reasoning
    RETURN c
  `,
};

// ============================================================================
// Operations Interface
// ============================================================================

/**
 * Episode row as returned from FalkorDB query
 */
export interface EpisodeRow {
  properties?: {
    id: string;
    timestamp: string;
    type: string;
    summary: string;
    content: string;
    context_project: string | null;
    context_task: string | null;
    entities: string;
    relationships: string;
    outcome_success: boolean | null;
    outcome_result: string | null;
    outcome_lessons: string | null;
  };
  id?: string;
  timestamp?: string;
  type?: string;
  summary?: string;
  content?: string;
  context_project?: string | null;
  context_task?: string | null;
  entities?: string;
  relationships?: string;
  outcome_success?: boolean | null;
  outcome_result?: string | null;
  outcome_lessons?: string | null;
}

/**
 * Graph CRUD operations interface
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
    callerName: string,
    callerFile: string,
    calleeName: string,
    calleeFile: string,
    line: number
  ): Promise<void>;

  createImportsEdge(
    fromPath: string,
    toPath: string,
    specifiers?: string[]
  ): Promise<void>;

  createExtendsEdge(
    childName: string,
    childFile: string,
    parentName: string,
    parentFile?: string
  ): Promise<void>;

  createImplementsEdge(
    className: string,
    classFile: string,
    interfaceName: string,
    interfaceFile?: string
  ): Promise<void>;

  createRendersEdge(
    parentName: string,
    parentFile: string,
    childName: string,
    line: number
  ): Promise<void>;

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
    filePath: string,
    commitHash: string,
    linesAdded?: number,
    linesRemoved?: number,
    complexityDelta?: number
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

// ============================================================================
// Helper to convert props to QueryParams
// ============================================================================

function toParams<T extends object>(props: T): QueryParams {
  return props as unknown as QueryParams;
}

// ============================================================================
// Operations Implementation
// ============================================================================

class GraphOperationsImpl implements GraphOperations {
  constructor(private readonly client: GraphClient) {}

  
  async upsertFile(file: FileEntity): Promise<void> {
    const props = fileToNodeProps(file);
    await this.client.query(CYPHER.UPSERT_FILE, { params: toParams(props) });
  }

  
  async upsertFunction(fn: FunctionEntity): Promise<void> {
    const props = functionToNodeProps(fn);
    await this.client.query(CYPHER.UPSERT_FUNCTION, { params: toParams(props) });
  }

  
  async upsertClass(cls: ClassEntity): Promise<void> {
    const props = classToNodeProps(cls);
    await this.client.query(CYPHER.UPSERT_CLASS, { params: toParams(props) });
  }

  
  async upsertInterface(iface: InterfaceEntity): Promise<void> {
    const props = interfaceToNodeProps(iface);
    await this.client.query(CYPHER.UPSERT_INTERFACE, { params: toParams(props) });
  }

  
  async upsertVariable(variable: VariableEntity): Promise<void> {
    const props = variableToNodeProps(variable);
    await this.client.query(CYPHER.UPSERT_VARIABLE, { params: toParams(props) });
  }

  
  async upsertType(type: TypeEntity): Promise<void> {
    const props = typeToNodeProps(type);
    await this.client.query(CYPHER.UPSERT_TYPE, { params: toParams(props) });
  }

  
  async upsertComponent(component: ComponentEntity): Promise<void> {
    const props = componentToNodeProps(component);
    await this.client.query(CYPHER.UPSERT_COMPONENT, { params: toParams(props) });
  }

  
  async createCallEdge(
    callerName: string,
    callerFile: string,
    calleeName: string,
    calleeFile: string,
    line: number
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_CALLS_EDGE, {
      params: { callerName, callerFile, calleeName, calleeFile, line },
    });
  }

  
  async createImportsEdge(
    fromPath: string,
    toPath: string,
    specifiers?: string[]
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_IMPORTS_EDGE, {
      params: { fromPath, toPath, specifiers: specifiers ?? null },
    });
  }

  
  async createExtendsEdge(
    childName: string,
    childFile: string,
    parentName: string,
    parentFile?: string
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_EXTENDS_EDGE, {
      params: { childName, childFile, parentName, parentFile: parentFile ?? null },
    });
  }

  
  async createImplementsEdge(
    className: string,
    classFile: string,
    interfaceName: string,
    interfaceFile?: string
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_IMPLEMENTS_EDGE, {
      params: { className, classFile, interfaceName, interfaceFile: interfaceFile ?? null },
    });
  }

  
  async createRendersEdge(
    parentName: string,
    parentFile: string,
    childName: string,
    line: number
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_RENDERS_EDGE, {
      params: { parentName, parentFile, childName, line },
    });
  }

  
  async deleteFileEntities(filePath: string): Promise<void> {
    await this.client.query(CYPHER.DELETE_FILE_ENTITIES, {
      params: { path: filePath },
    });
  }

  
  async clearAll(): Promise<void> {
    await this.client.query(CYPHER.CLEAR_ALL, { params: {} });
  }

  
  async batchUpsert(entities: ParsedFileEntities): Promise<void> {
    // Upsert file first (parent node for CONTAINS edges)
    await this.upsertFile(entities.file);

    // Upsert all entity types in parallel as they all connect to the file
    await Promise.all([
      // Functions
      ...entities.functions.map((fn) => this.upsertFunction(fn)),
      // Classes
      ...entities.classes.map((cls) => this.upsertClass(cls)),
      // Interfaces
      ...entities.interfaces.map((iface) => this.upsertInterface(iface)),
      // Variables
      ...entities.variables.map((v) => this.upsertVariable(v)),
      // Types
      ...entities.types.map((t) => this.upsertType(t)),
      // Components
      ...entities.components.map((comp) => this.upsertComponent(comp)),
    ]);

    // Create edges in parallel (after entities exist)
    await Promise.all([
      // Call edges
      ...entities.callEdges.map((edge) =>
        this.createCallEdge(
          edge.callerId.split(':')[2] ?? '',
          edge.callerId.split(':')[1] ?? '',
          edge.calleeId.split(':')[2] ?? '',
          edge.calleeId.split(':')[1] ?? '',
          edge.line
        )
      ),
      // Import edges
      ...entities.importsEdges.map((edge) =>
        this.createImportsEdge(edge.fromFilePath, edge.toFilePath, edge.specifiers)
      ),
      // Extends edges (classes) - extract parent file from ID if present
      ...entities.extendsEdges.map((edge) => {
        const parentParts = edge.parentId.split(':');
        const parentFile = parentParts[1] !== 'external' ? parentParts[1] : undefined;
        return this.createExtendsEdge(
          edge.childId.split(':')[2] ?? '',
          edge.childId.split(':')[1] ?? '',
          parentParts[2] ?? parentParts[1] ?? '', // name at index 2 or 1 for external
          parentFile
        );
      }),
      // Implements edges (class -> interface) - extract interface file from ID if present
      ...entities.implementsEdges.map((edge) => {
        const ifaceParts = edge.interfaceId.split(':');
        const ifaceFile = ifaceParts[1] !== 'external' ? ifaceParts[1] : undefined;
        return this.createImplementsEdge(
          edge.classId.split(':')[2] ?? '',
          edge.classId.split(':')[1] ?? '',
          ifaceParts[2] ?? ifaceParts[1] ?? '', // name at index 2 or 1 for external
          ifaceFile
        );
      }),
      // Renders edges (components)
      ...entities.rendersEdges.map((edge) =>
        this.createRendersEdge(
          edge.parentId.split(':')[2] ?? '',
          edge.parentId.split(':')[1] ?? '',
          edge.childId.split(':')[2] ?? '',
          edge.line
        )
      ),
    ]);
  }

  // Project operations

  
  async upsertProject(project: ProjectEntity): Promise<void> {
    await this.client.query(CYPHER.UPSERT_PROJECT, {
      params: {
        id: project.id,
        name: project.name,
        rootPath: project.rootPath,
        createdAt: project.createdAt,
        lastParsed: project.lastParsed,
        fileCount: project.fileCount ?? 0,
      },
    });
  }

  
  async getProjects(): Promise<ProjectEntity[]> {
    try {
      const result = await this.client.roQuery<{ p: Record<string, unknown> }>(
        CYPHER.GET_ALL_PROJECTS
      );
      return (result.data ?? []).map((row) => this.projectFromRow(row.p));
    } catch {
      // Handle empty graph case - return empty array
      return [];
    }
  }

  
  async getProjectByRoot(rootPath: string): Promise<ProjectEntity | null> {
    try {
      const result = await this.client.roQuery<{ p: Record<string, unknown> }>(
        CYPHER.GET_PROJECT_BY_ROOT,
        { params: { rootPath } }
      );
      const row = result.data?.[0];
      return row ? this.projectFromRow(row.p) : null;
    } catch {
      // Handle empty graph case - return null (no existing project)
      return null;
    }
  }

  
  async deleteProject(projectId: string): Promise<void> {
    await this.client.query(CYPHER.DELETE_PROJECT, {
      params: { id: projectId },
    });
  }

  
  async linkProjectFile(projectId: string, filePath: string): Promise<void> {
    await this.client.query(CYPHER.LINK_PROJECT_FILE, {
      params: { projectId, filePath },
    });
  }

  // Commit operations

  
  async upsertCommit(commit: CommitEntity): Promise<void> {
    const props = commitToNodeProps(commit);
    await this.client.query(CYPHER.UPSERT_COMMIT, { params: toParams(props) });
  }

  
  async createModifiedInEdge(
    filePath: string,
    commitHash: string,
    linesAdded?: number,
    linesRemoved?: number,
    complexityDelta?: number
  ): Promise<void> {
    await this.client.query(CYPHER.CREATE_MODIFIED_IN_EDGE, {
      params: {
        filePath,
        commitHash,
        linesAdded: linesAdded ?? null,
        linesRemoved: linesRemoved ?? null,
        complexityDelta: complexityDelta ?? null,
      },
    });
  }

  // Episode operations (episodic memory)

  
  async upsertEpisode(episode: Parameters<typeof episodeToNodeProps>[0]): Promise<void> {
    const props = episodeToNodeProps(episode);
    await this.client.query(CYPHER.UPSERT_EPISODE, { params: toParams(props) });
  }

  
  async upsertExperience(experience: Parameters<typeof experienceToNodeProps>[0]): Promise<void> {
    const props = experienceToNodeProps(experience);
    await this.client.query(CYPHER.UPSERT_EXPERIENCE, { params: toParams(props) });
  }

  
  async linkEpisodeEntity(episodeId: string, entityName: string): Promise<void> {
    await this.client.query(CYPHER.LINK_EPISODE_ENTITY, {
      params: { episodeId, entityName },
    });
  }

  
  async linkEpisodeExperience(episodeId: string): Promise<void> {
    await this.client.query(CYPHER.LINK_EPISODE_EXPERIENCE, {
      params: { episodeId },
    });
  }

  
  async getEpisodesByQuery(query: string, limit: number): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_EPISODES_BY_QUERY, {
      params: { query, limit },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  
  async getEpisodeById(id: string): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_EPISODE_BY_ID, {
      params: { id },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  
  async getAllEpisodes(limit: number): Promise<EpisodeRow[]> {
    const result = await this.client.roQuery(CYPHER.GET_ALL_EPISODES, {
      params: { limit },
    });
    return (result.data ?? []) as EpisodeRow[];
  }

  
  async getExperiencesForEpisode(episodeId: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_EXPERIENCES_FOR_EPISODE, {
      params: { episodeId },
    });
    return result.data ?? [];
  }

  
  async countEpisodes(): Promise<number> {
    const result = await this.client.roQuery(CYPHER.COUNT_EPISODES, { params: {} });
    const row = result.data?.[0] as { count?: number } | undefined;
    return row?.count ?? 0;
  }

  
  async pruneOldEpisodes(count: number): Promise<number> {
    const result = await this.client.query(CYPHER.PRUNE_OLD_EPISODES, {
      params: { limit: count },
    });
    const row = result.data?.[0] as { deleted?: number } | undefined;
    return row?.deleted ?? 0;
  }

  // Entity Resolution operations

  
  async upsertEntityAlias(alias: EntityAliasNodeProps): Promise<void> {
    await this.client.query(CYPHER.UPSERT_ENTITY_ALIAS, { params: toParams(alias) });
  }

  
  async createAliasOfEdge(aliasName: string, entityId: string): Promise<void> {
    await this.client.query(CYPHER.CREATE_ALIAS_OF_EDGE, {
      params: { aliasName, entityId },
    });
  }

  
  async getEntityAliases(entityId: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_ENTITY_ALIASES, {
      params: { entityId },
    });
    return result.data ?? [];
  }

  
  async findCanonicalEntity(aliasName: string): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.FIND_CANONICAL_ENTITY, {
      params: { aliasName },
    });
    return result.data ?? [];
  }

  // Contradiction operations

  
  async upsertContradiction(contradiction: ContradictionNodeProps): Promise<void> {
    await this.client.query(CYPHER.UPSERT_CONTRADICTION, { params: toParams(contradiction) });
  }

  
  async getUnresolvedContradictions(): Promise<unknown[]> {
    const result = await this.client.roQuery(CYPHER.GET_UNRESOLVED_CONTRADICTIONS, { params: {} });
    return result.data ?? [];
  }

  
  async resolveContradiction(id: string, winner: string, reasoning: string): Promise<void> {
    await this.client.query(CYPHER.RESOLVE_CONTRADICTION, {
      params: { id, winner, reasoning },
    });
  }

  private projectFromRow(row: Record<string, unknown>): ProjectEntity {
    // Handle FalkorDB nested properties format
    const props = (row['properties'] ?? row) as Record<string, unknown>;
    const fileCount = props['fileCount'] as number | undefined;
    const entity: ProjectEntity = {
      id: props['id'] as string,
      name: props['name'] as string,
      rootPath: props['rootPath'] as string,
      createdAt: props['createdAt'] as string,
      lastParsed: props['lastParsed'] as string,
    };
    if (fileCount !== undefined) {
      entity.fileCount = fileCount;
    }
    return entity;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create graph operations instance from client
 *
 * @example
 * ```typescript
 * const client = await createClient();
 * const ops = createOperations(client);
 *
 * await ops.upsertFile({
 *   path: '/src/index.ts',
 *   name: 'index.ts',
 *   extension: 'ts',
 *   loc: 150,
 *   lastModified: new Date().toISOString(),
 *   hash: 'abc123'
 * });
 *
 * await ops.deleteFileEntities('/src/old.ts');
 * ```
 */
export function createOperations(client: GraphClient): GraphOperations {
  return new GraphOperationsImpl(client);
}
