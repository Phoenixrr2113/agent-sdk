/**
 * Context Assembler Module
 * 
 * Assembles a token-limited context for LLMs from graph data.
 */

import type { GraphOperations, EpisodeRow } from '../graph';
import type { Episode } from '../types';
import { ContextScorer } from './scoring';
import { estimateTokens } from './tokenizer';

export type AssembledContext = {
  query: string;
  episodes: Episode[];
  tokenCount: number;
  formatted: string;
};

export class ContextAssembler {
  private scorer: ContextScorer;

  constructor(
    private operations: GraphOperations
  ) {
    this.scorer = new ContextScorer();
  }

  async assemble(query: string, tokenBudget: number = 4000): Promise<AssembledContext> {
    // 1. Retrieve relevant episodes
    const rows = await this.operations.getEpisodesByQuery(query, 50);
    
    // Map to Episodes
    const episodes: Episode[] = rows.map(row => {
        // Safe property access using type assertion on the structure we expect from DB
        const props = (row.properties || row) as Record<string, unknown>;
        
        const entities = typeof props.entities === 'string' 
          ? JSON.parse(props.entities) 
          : (Array.isArray(props.entities) ? props.entities : []);
          
        const relationships = typeof props.relationships === 'string' 
          ? JSON.parse(props.relationships) 
          : (Array.isArray(props.relationships) ? props.relationships : []);
          
        const lessons = props.outcome_lessons && typeof props.outcome_lessons === 'string'
          ? JSON.parse(props.outcome_lessons)
          : undefined;

        return {
            id: String(props.id || ''),
            timestamp: String(props.timestamp || new Date().toISOString()),
            type: (props.type as Episode['type']) || 'observation',
            summary: String(props.summary || ''),
            content: String(props.content || ''),
            context: {
                project: typeof props.context_project === 'string' ? props.context_project : undefined,
                task: typeof props.context_task === 'string' ? props.context_task : undefined
            },
            entities,
            relationships,
            outcome: props.outcome_success !== undefined && props.outcome_success !== null ? {
                success: Boolean(props.outcome_success),
                result: typeof props.outcome_result === 'string' ? props.outcome_result : undefined,
                lessons
            } : undefined
        };
    });

    // 2. Score and rank
    const scored = this.scorer.scoreItems(episodes, query);

    // 3. Select top items within budget
    const selectedEpisodes: Episode[] = [];
    let currentTokens = 0;
    let formattedParts: string[] = [];

    for (const { item, score } of scored) {
      if (score <= 0.1) continue; // Skip low relevance

      const content = `[Episode ${item.timestamp}] ${item.type}: ${item.content}`;
      const tokens = estimateTokens(content);

      if (currentTokens + tokens <= tokenBudget) {
        selectedEpisodes.push(item);
        formattedParts.push(content);
        currentTokens += tokens;
      }
    }

    return {
      query,
      episodes: selectedEpisodes,
      tokenCount: currentTokens,
      formatted: formattedParts.join('\n\n')
    };
  }
}
