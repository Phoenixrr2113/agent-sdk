/**
 * @agent/brain
 * Knowledge graph and memory system for AI agents
 *
 * The brain provides:
 * - Code knowledge graph (files, functions, classes, dependencies)
 * - NLP entity/relationship extraction from natural language
 * - Temporal awareness (what facts are current vs historical)
 * - Episodic memory (experiences and lessons learned)
 * - Multi-language code parsing (TypeScript, Python, C#)
 *
 * @example
 * ```typescript
 * import { createClient, createQueries, createOperations } from '@agent/brain';
 * import { EntityExtractor } from '@agent/brain/nlp';
 *
 * // Connect to knowledge graph
 * const client = await createClient({
 *   host: 'localhost',
 *   port: 6379,
 *   graphName: 'codegraph'
 * });
 *
 * await client.ensureIndexes();
 *
 * // Query the graph
 * const queries = createQueries(client);
 * const stats = await queries.getStats();
 * const results = await queries.search('processPayment');
 *
 * // Parse code files
 * await initParser();
 * const tree = await parseFile('/src/index.ts');
 * const functions = extractFunctions(tree.rootNode, tree.filePath);
 *
 * await client.close();
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Graph exports
// ─────────────────────────────────────────────────────────────────────────────
export {
  createClient,
  createQueries,
  createOperations,
  buildFileTree,
  getIndexSummary,
  type GraphClient,
  type GraphQueries,
  type GraphOperations,
  type FalkorConfig,
  type QueryOptions,
  type QueryResult,
  type FileTreeOptions,
  type ParsedFileEntities,
  GraphClientError,
  fileToNodeProps,
  functionToNodeProps,
  classToNodeProps,
  generateNodeId,
  generateFileNodeId,
  generateEdgeId,
} from './graph';

// ─────────────────────────────────────────────────────────────────────────────
// NLP exports
// ─────────────────────────────────────────────────────────────────────────────
export {
  EntityExtractor,
  type ExtractorConfig,
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  VALID_ENTITY_TYPES,
  VALID_RELATIONSHIP_TYPES,
  autoLabel,
  autoLabelFromFiles,
  labelSingle,
  type AutoLabelConfig,
  loadSamples,
  saveSamples,
  loadAnnotations,
  saveAnnotations,
  parseClaudeExport,
  createSamplesFromStrings,
} from './nlp';

// ─────────────────────────────────────────────────────────────────────────────
// Parser exports
// ─────────────────────────────────────────────────────────────────────────────
export {
  initParser,
  isInitialized,
  parseCode,
  parseFile,
  parseFiles,
  disposeParser,
  getLanguageForExtension,
  extractFunctions,
  extractClasses,
  extractImports,
  extractVariables,
  extractTypes,
  extractInterfaces,
  extractComponents,
  extractCalls,
  extractAllEntities,
  getLocation,
  findNodesOfType,
  generateEntityId,
  type SyntaxTree,
  type LanguageType,
  type ExtractedEntities,
  type CallReference,
} from './parser';

// Parser - Analysis exports
export {
  calculateComplexity,
  calculateCyclomatic,
  calculateCognitive,
  classifyComplexity,
  type ComplexityMetrics,
  analyzeImpact,
  classifyRisk,
  type ImpactAnalysisResult,
  analyzeDataflow,
  type DataflowAnalysisResult,
  scanForVulnerabilities,
  type SecurityFinding,
  analyzeRefactoring,
  type RefactoringAnalysisResult,
} from './parser';

// Parser - Project parsing exports
export {
  parseProject,
  parseSingleFile,
  removeFileFromGraph,
  type ParseResult,
  type ParseStats,
  type ParseOptions,
} from './parser';

// ─────────────────────────────────────────────────────────────────────────────
// Brain factory
// ─────────────────────────────────────────────────────────────────────────────
export {
  createBrain,
  type Brain,
  type BrainConfig,
} from './brain';

// ─────────────────────────────────────────────────────────────────────────────
// Brain tools
// ─────────────────────────────────────────────────────────────────────────────
export {
  createBrainTools,
  type BrainTools,
} from './brain-tools';

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────
export * from './types';
