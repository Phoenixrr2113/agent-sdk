/**
 * Cypher query templates for CRUD operations.
 * Grouped by domain: file, entity, episode, edge, project.
 */

export const CYPHER = {
  // ── File operations ──────────────────────────────────────────────────────
  UPSERT_FILE: `
    MERGE (f:File {path: $path})
    SET f.name = $name,
        f.extension = $extension,
        f.loc = $loc,
        f.lastModified = $lastModified,
        f.hash = $hash
    RETURN f
  `,

  DELETE_FILE_ENTITIES: `
    MATCH (f:File {path: $path})-[:CONTAINS]->(e)
    DETACH DELETE e
    WITH f
    DETACH DELETE f
  `,

  COUNT_FILE_ENTITIES: `
    MATCH (f:File {path: $path})-[:CONTAINS]->(e)
    RETURN count(e) as count
  `,

  CLEAR_ALL: `
    MATCH (n)
    DETACH DELETE n
  `,

  // ── Entity operations (Function, Class, Interface, Variable, Type, Component) ─
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

  // ── Edge operations ──────────────────────────────────────────────────────
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

  // ── Temporal edges ───────────────────────────────────────────────────────
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

  // ── Dataflow edges ───────────────────────────────────────────────────────
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

  // ── Commit operations ────────────────────────────────────────────────────
  UPSERT_COMMIT: `
    MERGE (c:Commit {hash: $hash})
    SET c.message = $message,
        c.author = $author,
        c.email = $email,
        c.date = $date
    RETURN c
  `,

  // ── Project operations ───────────────────────────────────────────────────
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

  // ── Episode operations ───────────────────────────────────────────────────
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

  // ── Entity Resolution operations ─────────────────────────────────────────
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

  // ── Contradiction operations ─────────────────────────────────────────────
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
} as const;
