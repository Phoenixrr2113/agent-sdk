/**
 * Project-wide parsing service
 * Orchestrates parsing of entire codebases and persisting to graph
 */

import { createLogger } from '@agent/logger';
import { stat, readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import fastGlob from 'fast-glob';
import type Parser from 'tree-sitter';
import type { FileEntity, ProjectEntity, FunctionEntity, ExtractedEntities } from '../types';
import { initParser, parseFile, parseFiles } from './parser';
import { extractAllEntities, extractCalls, extractRenders, extractInheritance } from './extractors';
import { calculateComplexity } from './analysis';
import { createClient, createOperations, type GraphOperations, type ParsedFileEntities } from '../graph';
import * as pythonPlugin from '../plugins/python';
import * as csharpPlugin from '../plugins/csharp';

const logger = createLogger('@agent/brain:parseProject');

const SUPPORTED_EXTENSIONS: readonly string[] = [
  '.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs',
  '.py', '.pyw', '.pyi',
  '.cs',
];

const PYTHON_EXTENSIONS: readonly string[] = ['.py', '.pyw', '.pyi'];
const CSHARP_EXTENSIONS: readonly string[] = ['.cs'];

const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/coverage/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/__tests__/**',
  '**/__mocks__/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/__pycache__/**',
  '**/.venv/**',
  '**/venv/**',
  '**/*.pyc',
];

export type ParseStats = {
  files: number;
  entities: number;
  edges: number;
  durationMs: number;
};

export type ParseResult = {
  status: 'complete' | 'error';
  stats?: ParseStats;
  error?: string;
};

export type ParseOptions = {
  deepAnalysis?: boolean;
  includeExternals?: boolean;
};

let graphOps: GraphOperations | null = null;

async function getGraphOps(): Promise<GraphOperations> {
  if (!graphOps) {
    const client = await createClient();
    graphOps = createOperations(client);
  }
  return graphOps;
}

function isPythonFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return PYTHON_EXTENSIONS.includes(ext);
}

function isCSharpFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  return CSHARP_EXTENSIONS.includes(ext);
}

async function createFileEntity(filePath: string): Promise<FileEntity> {
  const fileStat = await stat(filePath);
  const content = await readFile(filePath, 'utf-8');
  const loc = content.split('\n').length;
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);

  return {
    path: filePath,
    name: basename(filePath),
    extension: extname(filePath).slice(1),
    loc,
    lastModified: fileStat.mtime.toISOString(),
    hash,
  };
}

function extractEntitiesForFile(rootNode: Parser.SyntaxNode, filePath: string): ExtractedEntities {
  if (isPythonFile(filePath)) {
    return {
      functions: pythonPlugin.extractFunctions(rootNode as unknown as import('../types').SyntaxNode, filePath),
      classes: pythonPlugin.extractClasses(rootNode as unknown as import('../types').SyntaxNode, filePath),
      variables: pythonPlugin.extractVariables(rootNode as unknown as import('../types').SyntaxNode, filePath),
      imports: pythonPlugin.extractImports(rootNode as unknown as import('../types').SyntaxNode, filePath),
      interfaces: [],
      types: [],
      components: [],
    };
  }

  if (isCSharpFile(filePath)) {
    return {
      functions: csharpPlugin.extractFunctions(rootNode as unknown as import('../types').SyntaxNode, filePath),
      classes: csharpPlugin.extractClasses(rootNode as unknown as import('../types').SyntaxNode, filePath),
      interfaces: csharpPlugin.extractInterfaces(rootNode as unknown as import('../types').SyntaxNode, filePath),
      variables: csharpPlugin.extractVariables(rootNode as unknown as import('../types').SyntaxNode, filePath),
      imports: csharpPlugin.extractImports(rootNode as unknown as import('../types').SyntaxNode, filePath),
      types: csharpPlugin.extractTypes(rootNode as unknown as import('../types').SyntaxNode, filePath),
      components: [],
    };
  }

  return extractAllEntities(rootNode, filePath);
}

const FUNCTION_TYPES = [
  'function_declaration',
  'function_expression',
  'arrow_function',
  'method_definition',
  'generator_function_declaration',
];

function enrichFunctionsWithComplexity(
  rootNode: Parser.SyntaxNode,
  functions: FunctionEntity[]
): void {
  const functionsByLine = new Map<number, FunctionEntity>();
  for (const fn of functions) {
    functionsByLine.set(fn.startLine, fn);
  }

  function walk(node: Parser.SyntaxNode): void {
    if (FUNCTION_TYPES.includes(node.type)) {
      const startLine = node.startPosition.row + 1;
      const functionEntity = functionsByLine.get(startLine);
      if (functionEntity) {
        const metrics = calculateComplexity(node);
        functionEntity.complexity = metrics.cyclomatic;
        functionEntity.cognitiveComplexity = metrics.cognitive;
        functionEntity.nestingDepth = metrics.nestingDepth;
      }
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  walk(rootNode);
}

function buildParsedFileEntities(
  file: FileEntity,
  extracted: ExtractedEntities,
  rootNode?: Parser.SyntaxNode,
  options: ParseOptions = {},
  projectRoot?: string
): ParsedFileEntities {
  const { deepAnalysis = false, includeExternals = false } = options;

  if (rootNode) {
    enrichFunctionsWithComplexity(rootNode, extracted.functions);
  }

  let importsEdges: { fromFilePath: string; toFilePath: string; specifiers: string[] }[] = [];

  if (isPythonFile(file.path) && projectRoot) {
    for (const imp of extracted.imports) {
      const resolvedPath = pythonPlugin.resolvePythonImport(imp.source, file.path, projectRoot);
      if (resolvedPath) {
        importsEdges.push({
          fromFilePath: file.path,
          toFilePath: resolvedPath,
          specifiers: imp.specifiers.map((s) => s.name),
        });
      }
    }
  } else if (isCSharpFile(file.path)) {
    for (const imp of extracted.imports) {
      importsEdges.push({
        fromFilePath: file.path,
        toFilePath: `external:${imp.source}`,
        specifiers: imp.specifiers.map((s) => s.name),
      });
    }
  } else {
    importsEdges = extracted.imports
      .filter((imp) => imp.resolvedPath)
      .map((imp) => ({
        fromFilePath: file.path,
        toFilePath: imp.resolvedPath!,
        specifiers: imp.specifiers.map((s) => s.name),
      }));
  }

  let extendsEdges: { childId: string; parentId: string }[] = [];
  let implementsEdges: { classId: string; interfaceId: string }[] = [];

  if (isPythonFile(file.path)) {
    const inheritanceRefs = pythonPlugin.extractInheritance(
      rootNode as unknown as import('../types').SyntaxNode,
      file.path
    );
    for (const ref of inheritanceRefs) {
      const cls = extracted.classes.find(c => c.name === ref.childName);
      if (cls) {
        extendsEdges.push({
          childId: `Class:${file.path}:${cls.name}:${cls.startLine}`,
          parentId: `Class:external:${ref.parentName}`,
        });
      }
    }
  } else if (isCSharpFile(file.path)) {
    const inheritanceRefs = csharpPlugin.extractInheritance(
      rootNode as unknown as import('../types').SyntaxNode,
      file.path
    );
    for (const ref of inheritanceRefs) {
      const cls = extracted.classes.find(c => c.name === ref.childName);
      const iface = extracted.interfaces.find(i => i.name === ref.childName);

      if (ref.type === 'extends') {
        if (cls) {
          extendsEdges.push({
            childId: `Class:${file.path}:${cls.name}:${cls.startLine}`,
            parentId: `Class:external:${ref.parentName}`,
          });
        } else if (iface) {
          extendsEdges.push({
            childId: `Interface:${file.path}:${iface.name}:${iface.startLine}`,
            parentId: `Interface:external:${ref.parentName}`,
          });
        }
      } else if (ref.type === 'implements' && cls) {
        implementsEdges.push({
          classId: `Class:${file.path}:${cls.name}:${cls.startLine}`,
          interfaceId: `Interface:external:${ref.parentName}`,
        });
      }
    }
  } else {
    const inheritance = extractInheritance(
      file.path,
      extracted.classes,
      extracted.interfaces,
      extracted.imports,
      includeExternals
    );

    extendsEdges = inheritance.extends.map((ext) => ({
      childId: `Class:${ext.childFilePath}:${ext.childName}:${ext.childStartLine}`,
      parentId: ext.parentFilePath
        ? `Class:${ext.parentFilePath}:${ext.parentName}`
        : `Class:external:${ext.parentName}`,
    }));

    implementsEdges = inheritance.implements.map((impl) => ({
      classId: `Class:${impl.classFilePath}:${impl.className}:${impl.classStartLine}`,
      interfaceId: impl.interfaceFilePath
        ? `Interface:${impl.interfaceFilePath}:${impl.interfaceName}`
        : `Interface:external:${impl.interfaceName}`,
    }));
  }

  let callEdges: ParsedFileEntities['callEdges'] = [];
  if (deepAnalysis && rootNode) {
    if (isPythonFile(file.path)) {
      const pythonCalls = pythonPlugin.extractCalls(
        rootNode as unknown as import('../types').SyntaxNode,
        file.path
      );
      callEdges = pythonCalls.map((call) => ({
        callerId: `Function:${call.filePath}:${call.callerName}`,
        calleeId: `Function:${call.filePath}:${call.calleeName}`,
        line: call.line,
      }));
    } else if (isCSharpFile(file.path)) {
      const csharpCalls = csharpPlugin.extractCalls(
        rootNode as unknown as import('../types').SyntaxNode,
        file.path
      );
      callEdges = csharpCalls.map((call) => ({
        callerId: `Function:${call.filePath}:${call.callerName}`,
        calleeId: `Function:${call.filePath}:${call.calleeName}`,
        line: call.line,
      }));
    } else {
      const calls = extractCalls(
        rootNode,
        file.path,
        extracted.functions,
        extracted.imports,
        includeExternals
      );
      callEdges = calls.map((call) => ({
        callerId: `Function:${call.callerFilePath}:${call.callerName}`,
        calleeId: call.calleeFilePath
          ? `Function:${call.calleeFilePath}:${call.calleeName}`
          : `Function:external:${call.calleeName}`,
        line: call.line,
      }));
    }
  }

  let rendersEdges: ParsedFileEntities['rendersEdges'] = [];
  if (deepAnalysis && rootNode) {
    const renders = extractRenders(
      rootNode,
      file.path,
      extracted.components,
      extracted.imports,
      includeExternals
    );
    rendersEdges = renders.map((render) => ({
      parentId: `Component:${render.parentFilePath}:${render.parentName}`,
      childId: render.childFilePath
        ? `Component:${render.childFilePath}:${render.childName}`
        : `Component:external:${render.childName}`,
      line: render.line,
    }));
  }

  return {
    file,
    functions: extracted.functions,
    classes: extracted.classes,
    interfaces: extracted.interfaces,
    variables: extracted.variables,
    types: extracted.types,
    components: extracted.components,
    imports: extracted.imports,
    callEdges,
    importsEdges,
    extendsEdges,
    implementsEdges,
    rendersEdges,
  };
}

function countEntities(extracted: ExtractedEntities): number {
  return (
    extracted.imports.length +
    extracted.functions.length +
    extracted.classes.length +
    extracted.variables.length +
    extracted.types.length +
    extracted.interfaces.length +
    extracted.components.length
  );
}

function countEdges(parsed: ParsedFileEntities): number {
  return (
    parsed.callEdges.length +
    parsed.importsEdges.length +
    parsed.extendsEdges.length +
    parsed.implementsEdges.length +
    parsed.rendersEdges.length
  );
}

export async function parseProject(
  projectPath: string,
  ignorePatterns: string[] = [],
  options: ParseOptions = {}
): Promise<ParseResult> {
  const startTime = Date.now();

  try {
    const pathStat = await stat(projectPath);
    if (!pathStat.isDirectory()) {
      return {
        status: 'error',
        error: `Path is not a directory: ${projectPath}`,
      };
    }

    await initParser();

    const patterns = SUPPORTED_EXTENSIONS.map(ext => `**/*${ext}`);
    const ignoreList = [...DEFAULT_IGNORE_PATTERNS, ...ignorePatterns];

    const files = await fastGlob(patterns, {
      cwd: projectPath,
      absolute: true,
      ignore: ignoreList,
      onlyFiles: true,
    });

    if (files.length === 0) {
      return {
        status: 'complete',
        stats: {
          files: 0,
          entities: 0,
          edges: 0,
          durationMs: Date.now() - startTime,
        },
      };
    }

    const results = await parseFiles(files);
    const successCount = results.filter(r => r.tree).length;
    const errorCount = results.filter(r => r.error).length;

    const ops = await getGraphOps();

    const now = new Date().toISOString();
    let existingProject = await ops.getProjectByRoot(projectPath);
    const project: ProjectEntity = existingProject ?? {
      id: randomUUID(),
      name: basename(projectPath),
      rootPath: projectPath,
      createdAt: now,
      lastParsed: now,
      fileCount: successCount,
    };
    project.lastParsed = now;
    project.fileCount = successCount;
    await ops.upsertProject(project);

    let totalEntities = 0;
    let totalEdges = 0;

    for (const result of results) {
      if (result.tree) {
        try {
          const extracted = extractEntitiesForFile(result.tree.rootNode, result.filePath);
          const fileEntity = await createFileEntity(result.filePath);
          const parsed = buildParsedFileEntities(
            fileEntity,
            extracted,
            result.tree.rootNode,
            options,
            projectPath
          );

          await ops.batchUpsert(parsed);
          await ops.linkProjectFile(project.id, result.filePath);

          totalEntities += 1 + countEntities(extracted);
          totalEdges += countEdges(parsed) + countEntities(extracted);
        } catch (err) {
          logger.error(`Failed to persist ${result.filePath}`, { error: String(err) });
        }
      }
    }

    const stats: ParseStats = {
      files: successCount,
      entities: totalEntities,
      edges: totalEdges,
      durationMs: Date.now() - startTime,
    };

    if (errorCount > 0) {
      logger.warn(`${errorCount} files failed to parse`);
    }

    logger.info(`Completed: ${successCount} files, ${totalEntities} entities, ${totalEdges} edges in ${stats.durationMs}ms`);

    return {
      status: 'complete',
      stats,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown parsing error',
    };
  }
}

export async function parseSingleFile(filePath: string): Promise<{
  success: boolean;
  error?: string;
  entities?: number;
  edges?: number;
}> {
  try {
    await initParser();
    const tree = await parseFile(filePath);
    const extracted = extractEntitiesForFile(tree.rootNode, filePath);
    const fileEntity = await createFileEntity(filePath);
    const parsed = buildParsedFileEntities(fileEntity, extracted);

    const ops = await getGraphOps();
    await ops.batchUpsert(parsed);

    const entityCount = 1 + countEntities(extracted);
    const edgeCount = countEdges(parsed) + countEntities(extracted);

    logger.debug(`File ${filePath}: ${entityCount} entities, ${edgeCount} edges`);

    return {
      success: true,
      entities: entityCount,
      edges: edgeCount,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function removeFileFromGraph(filePath: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const ops = await getGraphOps();
    await ops.deleteFileEntities(filePath);
    logger.debug(`Removed file from graph: ${filePath}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
