import { tool } from 'ai';
import { z } from 'zod';
import { nanoid } from 'nanoid';

import type { StorageAdapter } from '../../memory/storage/types';
import type { EmbeddingService } from '../../memory/embeddings/index';

export type MemoryToolDependencies = {
  storage: StorageAdapter;
  embeddingService: EmbeddingService;
  userId?: string;
};

const memorySearchSchema = z.object({
  query: z.string().min(1).describe('The search query to find relevant memories'),
  maxResults: z.number().optional().default(5).describe('Maximum number of results to return'),
  includeExpired: z.boolean().optional().default(false).describe('Whether to include expired/invalidated facts'),
});

type MemorySearchInput = z.infer<typeof memorySearchSchema>;

const memoryAddSchema = z.object({
  content: z.string().min(1).describe('The content/fact to store in memory'),
  source: z.string().optional().default('conversation').describe('Source of the information'),
  confidence: z.number().min(0).max(1).optional().default(0.8).describe('Confidence level of the fact (0-1)'),
  entityNames: z.array(z.string()).optional().default([]).describe('Names of entities this fact is about'),
});

type MemoryAddInput = z.infer<typeof memoryAddSchema>;

const memoryGetEntitySchema = z.object({
  name: z.string().optional().describe('Name of the entity to retrieve'),
  id: z.string().optional().describe('ID of the entity to retrieve'),
});

type MemoryGetEntityInput = z.infer<typeof memoryGetEntitySchema>;

const memoryInvalidateSchema = z.object({
  factId: z.string().describe('ID of the fact to invalidate'),
});

type MemoryInvalidateInput = z.infer<typeof memoryInvalidateSchema>;

export function createMemoryTools(deps: MemoryToolDependencies) {
  const { storage, embeddingService, userId } = deps;

  return {
    memory_search: tool({
      description: 'Search memory for relevant facts and entities based on a query. Use this to recall information from previous conversations or stored knowledge.',
      inputSchema: memorySearchSchema,
      execute: async (input: MemorySearchInput) => {
        const { query, maxResults, includeExpired } = input;
        try {
          const queryEmbedding = await embeddingService.embed(query);
          
          const factResults = await storage.facts.search(queryEmbedding, maxResults, includeExpired);
          const entityResults = await storage.entities.search(queryEmbedding, maxResults);

          const entityIds = new Set<string>();
          for (const result of factResults) {
            for (const entityId of result.fact.entityIds) {
              entityIds.add(entityId);
            }
          }
          for (const result of entityResults) {
            entityIds.add(result.entity.id);
          }

          const relatedRelations = [];
          for (const entityId of entityIds) {
            const relations = await storage.relations.findByEntity(entityId);
            relatedRelations.push(...relations);
          }

          return {
            success: true,
            facts: factResults.map(r => ({
              id: r.fact.id,
              content: r.fact.content,
              confidence: r.fact.confidence,
              source: r.fact.source,
              score: r.score,
            })),
            entities: entityResults.map(r => ({
              id: r.entity.id,
              name: r.entity.name,
              type: r.entity.type,
              attributes: r.entity.attributes,
              score: r.score,
            })),
            relations: relatedRelations.slice(0, 10).map(r => ({
              id: r.id,
              fromEntityId: r.fromEntityId,
              toEntityId: r.toEntityId,
              type: r.type,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during memory search',
          };
        }
      },
    }),

    memory_add: tool({
      description: 'Add a new fact or piece of information to memory. Use this to store important information for later recall.',
      inputSchema: memoryAddSchema,
      execute: async (input: MemoryAddInput) => {
        const { content, source, confidence, entityNames } = input;
        try {
          const embedding = await embeddingService.embed(content);
          
          const entityIds: string[] = [];
          for (const name of entityNames) {
            let entity = await storage.entities.findByName(name);
            if (!entity) {
              const entityId = nanoid();
              const now = new Date();
              entity = {
                id: entityId,
                name,
                type: 'unknown',
                attributes: {},
                createdAt: now,
                updatedAt: now,
              };
              await storage.entities.create(entity);
            }
            entityIds.push(entity.id);
          }

          const factId = nanoid();
          const now = new Date();
          
          await storage.facts.create({
            id: factId,
            content,
            embedding,
            entityIds,
            relationIds: [],
            validFrom: now,
            validTo: null,
            createdAt: now,
            source: userId ? `${source}:${userId}` : source,
            confidence,
          });

          return {
            success: true,
            factId,
            entityIds,
            message: `Stored fact with ID ${factId}`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during memory add',
          };
        }
      },
    }),

    memory_get_entity: tool({
      description: 'Get detailed information about a specific entity by name or ID',
      inputSchema: memoryGetEntitySchema,
      execute: async (input: MemoryGetEntityInput) => {
        const { name, id } = input;
        try {
          let entity = null;
          
          if (id) {
            entity = await storage.entities.get(id);
          } else if (name) {
            entity = await storage.entities.findByName(name);
          }

          if (!entity) {
            return {
              success: false,
              error: 'Entity not found',
            };
          }

          const facts = await storage.facts.findByEntity(entity.id);
          const relations = await storage.relations.findByEntity(entity.id);

          return {
            success: true,
            entity: {
              id: entity.id,
              name: entity.name,
              type: entity.type,
              attributes: entity.attributes,
            },
            facts: facts.map(f => ({
              id: f.id,
              content: f.content,
              confidence: f.confidence,
            })),
            relations: relations.map(r => ({
              id: r.id,
              type: r.type,
              fromEntityId: r.fromEntityId,
              toEntityId: r.toEntityId,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error retrieving entity',
          };
        }
      },
    }),

    memory_invalidate: tool({
      description: 'Invalidate/expire a fact that is no longer accurate or relevant',
      inputSchema: memoryInvalidateSchema,
      execute: async (input: MemoryInvalidateInput) => {
        const { factId } = input;
        try {
          const fact = await storage.facts.get(factId);
          if (!fact) {
            return {
              success: false,
              error: 'Fact not found',
            };
          }

          await storage.facts.invalidate(factId, new Date());

          return {
            success: true,
            message: `Fact ${factId} has been invalidated`,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error invalidating fact',
          };
        }
      },
    }),
  };
}
