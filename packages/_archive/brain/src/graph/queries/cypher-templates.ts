/**
 * Cypher query templates for read-only graph queries.
 */

export const QUERY_CYPHER = {
  GET_FULL_GRAPH_NODES: `
    MATCH (n)
    WHERE n:File OR n:Function OR n:Class OR n:Interface OR n:Variable OR n:Type OR n:Component
    RETURN n, labels(n) as labels
    LIMIT $limit
  `,

  GET_FULL_GRAPH_EDGES: `
    MATCH (a)-[r]->(b)
    WHERE (a:File OR a:Function OR a:Class OR a:Interface OR a:Variable OR a:Type OR a:Component)
      AND (b:File OR b:Function OR b:Class OR b:Interface OR b:Variable OR b:Type OR b:Component)
    RETURN a, r, b, type(r) as edgeType
    LIMIT $limit
  `,

  GET_FILE_SUBGRAPH: `
    MATCH (f:File {path: $path})-[:CONTAINS]->(e)
    OPTIONAL MATCH (e)-[r]-(related)
    RETURN f, e, r, related, labels(e) as labels, labels(related) as relatedLabels, type(r) as edgeType
  `,

  GET_FUNCTION_CALLERS: `
    MATCH (caller:Function)-[c:CALLS]->(target:Function {name: $name})
    RETURN caller, c.line as line
  `,

  GET_DEPENDENCY_TREE: `
    MATCH path = (root:File {path: $path})-[:IMPORTS*1..$depth]->(dep:File)
    RETURN path
  `,

  GET_STATS_NODES: `
    MATCH (n)
    WHERE n:File OR n:Function OR n:Class OR n:Interface OR n:Variable OR n:Type OR n:Component
    RETURN labels(n)[0] as label, count(n) as count
  `,

  GET_STATS_EDGES: `
    MATCH ()-[r]->()
    RETURN type(r) as label, count(r) as count
  `,

  GET_LARGEST_FILES: `
    MATCH (f:File)-[:CONTAINS]->(e)
    RETURN f.path as path, count(e) as entityCount
    ORDER BY entityCount DESC
    LIMIT 10
  `,

  GET_MOST_CONNECTED: `
    MATCH (n)-[r]-()
    WHERE n:Function OR n:Class OR n:Component
    RETURN n.name as name, n.filePath as filePath, count(r) as connectionCount
    ORDER BY connectionCount DESC
    LIMIT 10
  `,

  SEARCH_FULLTEXT: `
    CALL db.idx.fulltext.queryNodes($indexName, $term) YIELD node, score
    RETURN node, labels(node) as labels, score
    LIMIT $limit
  `,

  SEARCH_BY_NAME: `
    MATCH (n)
    WHERE (n:Function OR n:Class OR n:Interface OR n:Component OR n:Variable OR n:Type)
      AND toLower(n.name) CONTAINS toLower($term)
    RETURN n, labels(n) as labels
    LIMIT $limit
  `,

  GET_VARIABLE_READERS: `
    MATCH (fn:Function)-[r:READS]->(v:Variable {name: $variableName, filePath: $variableFile})
    RETURN fn.name as functionName, fn.filePath as functionFile, r.line as line
  `,

  GET_VARIABLE_WRITERS: `
    MATCH (fn:Function)-[r:WRITES]->(v:Variable {name: $variableName, filePath: $variableFile})
    RETURN fn.name as functionName, fn.filePath as functionFile, r.line as line
  `,

  GET_FUNCTION_READS: `
    MATCH (fn:Function {name: $functionName, filePath: $functionFile})-[r:READS]->(v:Variable)
    RETURN v.name as variableName, v.filePath as variableFile, r.line as line
  `,

  GET_FUNCTION_WRITES: `
    MATCH (fn:Function {name: $functionName, filePath: $functionFile})-[r:WRITES]->(v:Variable)
    RETURN v.name as variableName, v.filePath as variableFile, r.line as line
  `,

  TRACE_DATA_FLOW: `
    MATCH path = (source {name: $sourceName, filePath: $sourceFile})-[:FLOWS_TO*1..$maxDepth]->(target)
    RETURN path, length(path) as depth,
           [node in nodes(path) | {name: node.name, file: node.filePath}] as nodes,
           [rel in relationships(path) | {tainted: rel.tainted, sanitized: rel.sanitized, transformation: rel.transformation}] as edges
    ORDER BY depth
    LIMIT $limit
  `,

  GET_TAINTED_FLOWS: `
    MATCH path = (source)-[r:FLOWS_TO*]->(sink)
    WHERE any(rel in r WHERE rel.tainted = true)
      AND none(rel in r WHERE rel.sanitized = true)
    RETURN path, source.name as sourceName, sink.name as sinkName
    LIMIT $limit
  `,

  GET_SANITIZED_FLOWS: `
    MATCH path = (source)-[r:FLOWS_TO*]->(sink)
    WHERE any(rel in r WHERE rel.sanitized = true)
    RETURN path, source.name as sourceName, sink.name as sinkName
    LIMIT $limit
  `,
} as const;
