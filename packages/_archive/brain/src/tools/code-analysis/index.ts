/**
 * Code Analysis Tools for Brain
 * 
 * Adapted from @codegraph/mcp-server tools for use with brain's graph client.
 * These tools wrap graph queries to provide code analysis capabilities.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import type { GraphClient } from '../../graph';
import {
  initParser,
  parseCode,
  analyzeDataflow,
  scanForVulnerabilities,
  sortBySeverity,
  analyzeRefactoring,
  getExtractionCandidatesQuery,
  getInternalCallsQuery,
  getRefactoringSummary,
  type DataflowAnalysisResult,
  type SecurityFinding,
  type RefactoringAnalysisInput
} from '../../parser';

export interface CodeAnalysisToolsConfig {
  client: GraphClient;
}

export function createCodeAnalysisTools(config: CodeAnalysisToolsConfig) {
  const { client } = config;

  const getContextTool = tool({
    description: `Get detailed context for a file or symbol.

Returns:
- For files: all functions, classes, interfaces in the file
- For symbols: full definition, parameters, return type, docstring
- Related entities: what it calls, what calls it, imports, etc.

Examples:
- { "file": "src/auth/login.ts" } - get all entities in file
- { "symbol": "validateToken" } - get function details and callers`,
    inputSchema: z.object({
      file: z.string().optional().describe('File path to get context for'),
      symbol: z.string().optional().describe('Symbol name to get context for'),
      includeRelationships: z.boolean().default(true).describe('Include related entities'),
    }),
    execute: async ({ file, symbol, includeRelationships }) => {
      if (!file && !symbol) {
        return JSON.stringify({ error: 'Either file or symbol must be specified' });
      }

      try {
        if (file && !symbol) {
          const cypher = `
            MATCH (f:File {path: $path})-[:CONTAINS]->(n)
            RETURN n.name as name, labels(n)[0] as type, n.startLine as startLine, 
                   n.endLine as endLine, n.docstring as docstring
            LIMIT 50
          `;
          const result = await client.roQuery(cypher, { params: { path: file } });
          
          return JSON.stringify({
            file: { path: file, entities: result.data ?? [] },
            relationships: [],
          });
        }

        if (symbol) {
          const symbolQuery = `
            MATCH (n) 
            WHERE n.name = $name AND (n:Function OR n:Class OR n:Interface OR n:Variable)
            ${file ? 'AND n.filePath CONTAINS $file' : ''}
            RETURN n.name as name, labels(n)[0] as type, n.filePath as filePath,
                   n.startLine as startLine, n.endLine as endLine, 
                   n.docstring as docstring, n.returnType as returnType
            LIMIT 1
          `;
          const symbolResult = await client.roQuery(symbolQuery, { 
            params: { name: symbol, ...(file && { file }) } 
          });

          const entity = symbolResult.data?.[0];
          let relationships: Array<{ name: string; type: string; relationship: string; filePath: string }> = [];

          if (includeRelationships && entity) {
            const callersQuery = `
              MATCH (caller)-[:CALLS]->(target {name: $name})
              RETURN caller.name as name, labels(caller)[0] as type, caller.filePath as filePath
              LIMIT 20
            `;
            const callersResult = await client.roQuery(callersQuery, { params: { name: symbol } });
            
            relationships = ((callersResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
              name: r['name'] as string,
              type: r['type'] as string,
              relationship: 'CALLED_BY',
              filePath: r['filePath'] as string,
            }));
          }

          return JSON.stringify({ entity, relationships });
        }

        return JSON.stringify({ relationships: [] });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  });

  const findSymbolTool = tool({
    description: `Find a symbol by name and return its definition.

Returns the symbol's location, type, and optional signature/complexity.

Examples:
- { "name": "validateToken" } - find function by name
- { "name": "UserSession", "kind": "class" } - find specific type`,
    inputSchema: z.object({
      name: z.string().describe('Symbol name to search for'),
      kind: z.enum(['function', 'class', 'interface', 'variable', 'any']).default('any')
        .describe('Type of symbol to search for'),
      file: z.string().optional().describe('Limit search to a specific file'),
    }),
    execute: async ({ name, kind, file }) => {
      if (!name || name.trim() === '') {
        return JSON.stringify({ found: false, symbol: null, error: 'Symbol name is required' });
      }

      try {
        const kindToLabel: Record<string, string> = {
          'function': 'Function',
          'class': 'Class',
          'interface': 'Interface',
          'variable': 'Variable',
          'any': '',
        };

        const label = kindToLabel[kind] || '';
        let cypher: string;

        if (label) {
          cypher = `
            MATCH (n:${label}) 
            WHERE n.name = $name ${file ? 'AND n.filePath CONTAINS $file' : ''}
            RETURN n.name as name, labels(n)[0] as kind, n.filePath as file, 
                   n.startLine as line, n.endLine as endLine, n.complexity as complexity
            LIMIT 10
          `;
        } else {
          cypher = `
            MATCH (n) 
            WHERE n.name = $name AND (n:Function OR n:Class OR n:Interface OR n:Variable)
            ${file ? 'AND n.filePath CONTAINS $file' : ''}
            RETURN n.name as name, labels(n)[0] as kind, n.filePath as file, 
                   n.startLine as line, n.endLine as endLine, n.complexity as complexity
            LIMIT 10
          `;
        }

        const result = await client.roQuery(cypher, { 
          params: { name, ...(file && { file }) } 
        });

        if (!result.data || result.data.length === 0) {
          return JSON.stringify({ found: false, symbol: null, error: `No symbol found matching "${name}"` });
        }

        const symbols = ((result.data ?? []) as Record<string, unknown>[]).map((row) => ({
          name: row['name'] as string,
          kind: ((row['kind'] as string) || 'unknown').toLowerCase(),
          file: row['file'] as string,
          line: row['line'] as number || 0,
          endLine: row['endLine'] as number | undefined,
          complexity: row['complexity'] as number | undefined,
        }));

        return JSON.stringify({
          found: true,
          symbol: symbols[0],
          alternatives: symbols.length > 1 ? symbols.slice(1) : undefined,
        });
      } catch (error) {
        return JSON.stringify({ found: false, symbol: null, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  });

  const searchCodeTool = tool({
    description: `Search for code by name or text content.

Searches the knowledge graph for functions, classes, interfaces, variables, and components.

Examples:
- { "query": "auth" } - find symbols containing "auth"
- { "query": "validate", "scope": "src/utils" } - search within scope`,
    inputSchema: z.object({
      query: z.string().describe('Search query'),
      scope: z.string().default('all').describe('Limit search to specific scope (file path prefix)'),
    }),
    execute: async ({ query, scope }) => {
      if (!query || query.trim() === '') {
        return JSON.stringify({ results: [], total: 0, error: 'Search query is required' });
      }

      try {
        const scopeFilter = scope && scope !== 'all' ? 'AND n.filePath STARTS WITH $scope' : '';
        const cypher = `
          MATCH (n)
          WHERE (n:Function OR n:Class OR n:Interface OR n:Variable OR n:Component)
            AND toLower(n.name) CONTAINS toLower($query) ${scopeFilter}
          RETURN n.name as name, labels(n)[0] as kind, n.filePath as file, n.startLine as line
          ORDER BY n.name
          LIMIT 50
        `;

        const result = await client.roQuery(cypher, { 
          params: { query, scope: scope === 'all' ? '' : scope } 
        });

        const results = ((result.data ?? []) as Record<string, unknown>[]).map((row) => ({
          name: row['name'] as string ?? 'unknown',
          kind: ((row['kind'] as string) ?? 'unknown').toLowerCase(),
          file: row['file'] as string ?? '',
          line: row['line'] as number ?? 0,
        }));

        return JSON.stringify({ results, total: results.length });
      } catch (error) {
        return JSON.stringify({ results: [], total: 0, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  });

  const analyzeImpactTool = tool({
    description: `Find all code affected by changing a symbol.

Returns direct callers, transitive callers, and affected tests.
Useful for understanding the blast radius of a change.

Examples:
- { "symbol": "validateToken" } - find all callers of this function
- { "symbol": "UserSession", "depth": 3 } - analyze with custom depth`,
    inputSchema: z.object({
      symbol: z.string().describe('Symbol name to analyze'),
      depth: z.number().default(3).describe('Traversal depth for transitive callers'),
    }),
    execute: async ({ symbol, depth }) => {
      if (!symbol || symbol.trim() === '') {
        return JSON.stringify({ 
          directCallers: [], transitiveCallers: [], affectedTests: [],
          error: 'Symbol name is required' 
        });
      }

      try {
        const directCallersQuery = `
          MATCH (caller)-[:CALLS]->(target {name: $name})
          RETURN caller.name as name, caller.filePath as file
          LIMIT 50
        `;
        const directResult = await client.roQuery(directCallersQuery, { params: { name: symbol } });

        const transitiveCallersQuery = `
          MATCH path = (caller)-[:CALLS*1..${Math.min(depth, 5)}]->(target {name: $name})
          WHERE caller <> target
          RETURN DISTINCT caller.name as name, caller.filePath as file, length(path) as depth
          LIMIT 100
        `;
        const transitiveResult = await client.roQuery(transitiveCallersQuery, { params: { name: symbol } });

        const testsQuery = `
          MATCH (test)-[:CALLS*1..3]->(target {name: $name})
          WHERE test.filePath CONTAINS 'test' OR test.filePath CONTAINS 'spec' OR test.name CONTAINS 'test'
          RETURN DISTINCT test.name as name, test.filePath as file
          LIMIT 20
        `;
        const testsResult = await client.roQuery(testsQuery, { params: { name: symbol } });

        const directCallers = ((directResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
          name: r['name'] as string, file: r['file'] as string
        }));

        const transitiveCallers = ((transitiveResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
          name: r['name'] as string, file: r['file'] as string, depth: r['depth'] as number
        }));

        const affectedTests = ((testsResult.data ?? []) as Record<string, unknown>[]).map((r) => ({
          name: r['name'] as string, file: r['file'] as string
        }));

        const affectedFiles = [...new Set([
          ...directCallers.map(c => c.file),
          ...transitiveCallers.map(c => c.file),
        ])].filter(Boolean);

        const riskScore = Math.min(100, directCallers.length * 10 + transitiveCallers.length * 5 + affectedTests.length * 15);
        const riskLevel = riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : riskScore < 80 ? 'high' : 'critical';

        return JSON.stringify({
          directCallers,
          transitiveCallers,
          affectedFiles,
          affectedTests,
          riskScore,
          riskLevel,
          recommendation: `${directCallers.length} direct callers, ${transitiveCallers.length} transitive. ${affectedTests.length} tests may need updating.`,
        });
      } catch (error) {
        return JSON.stringify({ 
          directCallers: [], transitiveCallers: [], affectedFiles: [], affectedTests: [],
          riskScore: 0, riskLevel: 'low', recommendation: '',
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    },
  });

  const getFileTreeTool = tool({
    description: `Get the file tree structure of the indexed codebase.

Returns a hierarchical view of files and their entity counts.

Examples:
- { "path": "src" } - get tree for src directory
- { "maxDepth": 2 } - limit depth of traversal`,
    inputSchema: z.object({
      path: z.string().default('').describe('Root path to start from'),
      maxDepth: z.number().default(3).describe('Maximum depth of tree'),
    }),
    execute: async ({ path, maxDepth }) => {
      try {
        const cypher = `
          MATCH (f:File)
          ${path ? 'WHERE f.path STARTS WITH $path' : ''}
          RETURN f.path as path, f.language as language
          ORDER BY f.path
          LIMIT 500
        `;

        const result = await client.roQuery(cypher, { params: { path } });
        
        const files = ((result.data ?? []) as Record<string, unknown>[]).map((r) => ({
          path: r['path'] as string,
          language: r['language'] as string,
        }));

        const tree: Record<string, unknown> = {};
        for (const file of files) {
          const parts = file.path.split('/');
          if (parts.length > maxDepth + 1) continue;
          
          let current = tree;
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!part) continue;
            if (!current[part]) current[part] = {};
            current = current[part] as Record<string, unknown>;
          }
          const fileName = parts[parts.length - 1];
          if (fileName) current[fileName] = file.language || 'file';
        }

        return JSON.stringify({ tree, fileCount: files.length });
      } catch (error) {
        return JSON.stringify({ tree: {}, fileCount: 0, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    },
  });

  const getComplexityReportTool = tool({
    description: `Get complexity metrics for the codebase.

Returns functions sorted by complexity, helping identify code that needs refactoring.

Examples:
- { "threshold": 10 } - only show functions with complexity >= 10
- { "file": "src/auth" } - limit to specific file/directory`,
    inputSchema: z.object({
      threshold: z.number().default(5).describe('Minimum complexity to include'),
      file: z.string().optional().describe('Limit to specific file or directory'),
      limit: z.number().default(20).describe('Maximum results'),
    }),
    execute: async ({ threshold, file, limit }) => {
      try {
        const cypher = `
          MATCH (f:Function)
          WHERE f.complexity >= $threshold ${file ? 'AND f.filePath CONTAINS $file' : ''}
          RETURN f.name as name, f.filePath as file, f.complexity as complexity,
                 f.startLine as line
          ORDER BY f.complexity DESC
          LIMIT $limit
        `;

        const result = await client.roQuery(cypher, { 
          params: { threshold, limit, ...(file && { file }) } 
        });

        const functions = ((result.data ?? []) as Record<string, unknown>[]).map((r) => ({
          name: r['name'] as string,
          file: r['file'] as string,
          complexity: r['complexity'] as number,
          line: r['line'] as number,
        }));

        const avgComplexity = functions.length > 0 
          ? functions.reduce((sum, f) => sum + f.complexity, 0) / functions.length 
          : 0;

        return JSON.stringify({
          functions,
          count: functions.length,
          averageComplexity: Math.round(avgComplexity * 10) / 10,
          recommendation: avgComplexity > 15 
            ? 'High average complexity. Consider refactoring complex functions.'
            : avgComplexity > 10
            ? 'Moderate complexity. Some functions could benefit from refactoring.'
            : 'Complexity is within acceptable range.',
        });
      } catch (error) {
        return JSON.stringify({ 
          functions: [], count: 0, averageComplexity: 0, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    },
  });

  // traceDataFlow
  const traceDataFlowTool = tool({
    description: 'Track how data flows from source to sink.',
    inputSchema: z.object({
      source: z.string().describe('Starting point (e.g. request.body)'),
      sink: z.string().optional().describe('Ending point (optional)'),
      file: z.string().optional().describe('File to analyze'),
    }),
    execute: async (input) => {
      try {
        if (!input.source) return JSON.stringify({ error: 'Source is required' });
        if (!input.file) return JSON.stringify({ error: 'File path is required' });

        const code = await readFile(input.file, 'utf-8');
        await initParser();

        const ext = input.file.split('.').pop() ?? 'ts';
        const langMap: Record<string, 'typescript' | 'javascript' | 'tsx' | 'jsx'> = {
          ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        };
        const language = langMap[ext] ?? 'typescript';
        const tree = parseCode(code, language);

        const result: DataflowAnalysisResult = analyzeDataflow(
          tree.rootNode,
          input.file,
          { maxDepth: 10, includeSteps: true }
        );

        const matchingSources = result.sources.filter(
          s => s.pattern.includes(input.source) || s.taintedVariable.includes(input.source)
        );

        const paths = result.paths
          .filter(p => matchingSources.some(s => s.taintedVariable === p.source.taintedVariable))
          .map(p => ({
            source: `${p.source.pattern} (${p.source.taintedVariable})`,
            transformations: p.steps.map(s => `${s.name} [${s.transformation}]`),
            sink: p.sink ? `${p.sink.pattern} (${p.sink.category})` : 'unknown',
          }));

        const vulnerabilities = result.vulnerabilities.map(
          v => `${v.category} [${v.severity}]: ${v.source.pattern} → ${v.sink.pattern}`
        );

        const sanitizersFound = [...new Set(result.paths.flatMap(p => p.sanitizers))];

        return JSON.stringify({
          paths,
          vulnerabilities,
          sanitizersFound,
          summary: `Found ${result.sources.length} sources, ${result.sinks.length} sinks, ${result.vulnerabilities.length} potential vulnerabilities`,
        });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // findVulnerabilities
  const findVulnerabilitiesTool = tool({
    description: 'Scan for security vulnerabilities using dataflow analysis.',
    inputSchema: z.object({
      scope: z.string().default('all').describe('Scope to scan (file path)'),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'all']).default('all'),
      category: z.enum(['injection', 'xss', 'auth', 'payment', 'all']).default('all'),
    }),
    execute: async (input) => {
      try {
        const scope = input.scope === 'all' ? process.cwd() : input.scope;
        const code = await readFile(scope, 'utf-8'); // Simplified for single file now

        await initParser();
        const ext = scope.split('.').pop() ?? 'ts';
        const langMap: Record<string, 'typescript' | 'javascript' | 'tsx' | 'jsx'> = {
           ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
        };
        const language = langMap[ext] ?? 'typescript';
        const tree = parseCode(code, language);

        const findings = scanForVulnerabilities(tree.rootNode, {
          filePath: scope,
          includeLowSeverity: input.severity === 'all' || input.severity === 'low',
        });

        const sorted = sortBySeverity(findings);
        const vulnerabilities = sorted.map(f => ({
          type: f.type,
          severity: f.severity,
          file: f.file,
          line: f.line,
          code: f.code,
          description: f.description
        }));

        return JSON.stringify({
          vulnerabilities,
          count: vulnerabilities.length
        });

      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // analyzeRefactoring
  const analyzeRefactoringTool = tool({
    description: 'Analyze a file for refactoring opportunities.',
    inputSchema: z.object({
      file: z.string().describe('File path to analyze'),
      threshold: z.number().default(3).describe('Coupling score threshold'),
    }),
    execute: async (input) => {
      try {
        if (!input.file) return JSON.stringify({ error: 'File path required' });
        
        const candidatesQuery = getExtractionCandidatesQuery(input.file);
        const callsQuery = getInternalCallsQuery(input.file);

        const [functionsResult, callsResult] = await Promise.all([
          client.roQuery(candidatesQuery),
          client.roQuery(callsQuery),
        ]);

        const analysisInput: RefactoringAnalysisInput = {
          file: input.file,
          functions: ((functionsResult.data ?? []) as any[]).map(f => ({
            name: f.name ?? 'unknown',
            startLine: f.startLine ?? 0,
            endLine: f.endLine ?? 0,
            internalCalls: f.internalCalls ?? 0,
            stateReads: f.stateReads ?? 0,
          })),
          callRelationships: ((callsResult.data ?? []) as any[]).map(c => ({
            caller: c.caller ?? '',
            callee: c.callee ?? '',
          })),
        };

        const result = analyzeRefactoring(analysisInput, {
          extractionThreshold: input.threshold,
          detectResponsibilities: true,
        });

        return JSON.stringify({
          extractionCandidates: result.extractionCandidates.map(c => ({
            name: c.name,
            couplingScore: c.couplingScore
          })),
          summary: getRefactoringSummary(result)
        });

      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  // queryGraph
  const queryGraphTool = tool({
    description: 'Run a raw Cypher query against the code graph.',
    inputSchema: z.object({
      cypher: z.string().describe('Cypher query to execute'),
      params: z.record(z.unknown()).optional().describe('Query parameters'),
    }),
    execute: async (input) => {
      try {
        if (!input.cypher) return JSON.stringify({ error: 'Cypher query required' });
        
        const lowerQuery = input.cypher.toLowerCase();
        if (lowerQuery.includes('create') || lowerQuery.includes('merge') || 
            lowerQuery.includes('delete') || lowerQuery.includes('set ') || 
            lowerQuery.includes('remove')) {
          return JSON.stringify({ error: 'Mutation queries not allowed' });
        }

        const result = await client.roQuery(
          input.cypher, 
          input.params ? { params: input.params as any } : undefined
        );
        
        return JSON.stringify({
          success: true,
          data: result.data,
          count: result.data.length
        });
      } catch (error) {
        return JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
  });

  return {
    getContext: getContextTool,
    findSymbol: findSymbolTool,
    searchCode: searchCodeTool,
    analyzeImpact: analyzeImpactTool,
    getFileTree: getFileTreeTool,
    getComplexityReport: getComplexityReportTool,
    traceDataFlow: traceDataFlowTool,
    findVulnerabilities: findVulnerabilitiesTool,
    analyzeRefactoring: analyzeRefactoringTool,
    queryGraph: queryGraphTool,
  };
}

export type CodeAnalysisTools = ReturnType<typeof createCodeAnalysisTools>;