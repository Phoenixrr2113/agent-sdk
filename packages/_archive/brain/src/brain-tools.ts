/**
 * @agntk/brain - Brain Tools
 *
 * Tools that agents can use to interact with the brain.
 * Shell tools have been consolidated into @agntk/core.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { Brain } from './brain';
import { createCodeAnalysisTools } from './tools/index';

// ============================================================================
// Schemas
// ============================================================================

const queryKnowledgeSchema = z.object({
  query: z.string().describe('Search term - function name, class name, concept, or keyword'),
  limit: z.number().optional().default(10).describe('Maximum results to return'),
});

const rememberSchema = z.object({
  fact: z.string().describe('The fact, observation, or decision to remember'),
  context: z.object({
    project: z.string().optional(),
    task: z.string().optional(),
    importance: z.enum(['low', 'medium', 'high']).optional(),
  }).optional().describe('Optional context about when/why this is being remembered'),
});

const recallSchema = z.object({
  query: z.string().describe('What to search for in memory'),
  limit: z.number().optional().default(5).describe('Maximum memories to return'),
});

const extractEntitiesSchema = z.object({
  text: z.string().describe('The text to analyze'),
  source: z.string().optional().describe('Where this text came from (e.g., "user message", "document")'),
});

// ============================================================================
// Knowledge Tools (queryKnowledge, remember, recall)
// ============================================================================

/**
 * Create brain knowledge tools (queryKnowledge, remember, recall).
 * These handle knowledge graph and memory operations.
 */
export function createBrainKnowledgeTools(brain: Brain) {
  return {
    queryKnowledge: tool({
      description: `Search the knowledge graph for code entities (functions, classes, files) or facts.
Use this to find information about the codebase or recalled facts.
Returns matching entities with their file paths and types.`,
      inputSchema: queryKnowledgeSchema,
      execute: async ({ query, limit }) => {
        const results = await brain.query(query, limit ?? 10);
        if (results.length === 0) {
          return JSON.stringify({ found: false, message: `No results found for "${query}"` });
        }
        return JSON.stringify({
          found: true,
          count: results.length,
          results: results.map((r) => ({
            name: r.name,
            type: r.type,
            file: r.filePath,
            line: r.line,
          })),
        });
      },
    }),

    remember: tool({
      description: `Store a fact or observation in memory for later recall.
Use this to save important information, decisions, or learnings.
The fact will be automatically analyzed to extract entities and relationships.`,
      inputSchema: rememberSchema,
      execute: async ({ fact, context }) => {
        await brain.remember(fact, context);
        return JSON.stringify({ stored: true, message: 'Fact stored in memory' });
      },
    }),

    recall: tool({
      description: `Retrieve past memories, facts, or observations related to a query.
Use this to remember past decisions, context, or learnings.
Returns episodes with their content and extracted entities.`,
      inputSchema: recallSchema,
      execute: async ({ query, limit }) => {
        const episodes = await brain.recall(query, limit ?? 5);
        if (episodes.length === 0) {
          return JSON.stringify({ found: false, message: `No memories found for "${query}"` });
        }
        return JSON.stringify({
          found: true,
          count: episodes.length,
          memories: episodes.map((ep) => ({
            timestamp: ep.timestamp,
            type: ep.type,
            summary: ep.summary,
            content: ep.content,
            entities: ep.entities,
          })),
        });
      },
    }),
  };
}

// ============================================================================
// Analysis Tools (extractEntities, code analysis)
// ============================================================================

/**
 * Create brain analysis tools (extractEntities + code analysis).
 * These handle text analysis and code understanding.
 */
export function createBrainAnalysisTools(brain: Brain) {
  const codeAnalysisTools = createCodeAnalysisTools({ client: brain.client });

  return {
    ...codeAnalysisTools,

    extractEntities: tool({
      description: `Extract entities and relationships from a piece of text.
Use this to analyze conversations, documents, or any text for structured knowledge.
Returns entities (people, projects, goals, problems, etc.) and their relationships.`,
      inputSchema: extractEntitiesSchema,
      execute: async ({ text, source }) => {
        try {
          const result = await brain.extract(text, source);
          return JSON.stringify({
            success: true,
            entities: result.entities.map((e) => ({
              text: e.text,
              type: e.type,
              confidence: e.confidence,
            })),
            relationships: result.relationships.map((r) => ({
              from: result.entities.find((e) => e.id === r.headEntityId)?.text,
              to: result.entities.find((e) => e.id === r.tailEntityId)?.text,
              type: r.type,
            })),
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Extraction failed',
          });
        }
      },
    }),
  };
}

// ============================================================================
// Combined (backwards-compatible)
// ============================================================================

/**
 * Create all brain tools. Shell tools are now in @agntk/core.
 *
 * @deprecated Use `createBrainKnowledgeTools` and `createBrainAnalysisTools` separately.
 */
export function createBrainTools(brain: Brain) {
  return {
    ...createBrainKnowledgeTools(brain),
    ...createBrainAnalysisTools(brain),
  };
}

export type BrainKnowledgeTools = ReturnType<typeof createBrainKnowledgeTools>;
export type BrainAnalysisTools = ReturnType<typeof createBrainAnalysisTools>;
export type BrainTools = ReturnType<typeof createBrainTools>;
