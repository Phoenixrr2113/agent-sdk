/**
 * @agent/sdk - Memory Extraction Pipeline
 *
 * LLM-powered extraction implementing the Hindsight 4-network taxonomy:
 * - world_fact: Generic factual knowledge
 * - experience: Episodes with lessons learned
 * - entity_summary: Entity summaries with relationships
 * - belief: Agent's evolving beliefs and assumptions
 *
 * Produces structured memory items from raw text via LLM.
 */

import { generateText, type LanguageModel } from 'ai';
import { createLogger } from '@agent/logger';

const log = createLogger('@agent/sdk:extraction');

// ============================================================================
// Types
// ============================================================================

/** Hindsight 4-network memory taxonomy */
export type MemoryNetworkType = 'world_fact' | 'experience' | 'entity_summary' | 'belief';

/** Mem0-style write operation */
export type MemoryOperation = 'ADD' | 'UPDATE' | 'DELETE' | 'NOOP';

/** A single extracted fact from the LLM extraction pipeline */
export interface ExtractedFact {
  network: MemoryNetworkType;
  fact: string;
  entities: Array<{ name: string; type: string }>;
  relationships: Array<{ from: string; to: string; type: string }>;
  confidence: number;
  tags?: string[];
}

/** Result of the extraction pipeline */
export interface ExtractionResult {
  facts: ExtractedFact[];
  rawText: string;
}

/** Config for the extraction pipeline */
export interface ExtractionConfig {
  /** LanguageModel instance to use for extraction */
  model: LanguageModel;
  /** Temperature for extraction (default: 0.1) */
  temperature?: number;
  /** Max retries on parse failure (default: 2) */
  maxRetries?: number;
}

// ============================================================================
// Extraction Prompt
// ============================================================================

const EXTRACTION_PROMPT = `You are a memory extraction system. Extract structured facts from the given text.

Classify each fact into one of these 4 memory networks:
- world_fact: Objective, verifiable knowledge about the world (e.g., "TypeScript 5.3 supports import attributes")
- experience: Events that happened, with outcomes and lessons (e.g., "Refactoring the auth module reduced bugs by 30%")
- entity_summary: Key attributes of entities (people, projects, systems) (e.g., "Project Atlas uses PostgreSQL and Redis")
- belief: Subjective assessments, preferences, or evolving assumptions (e.g., "The team prefers functional over OOP style")

For each fact, extract:
- The fact statement (concise, self-contained)
- Named entities mentioned (name + type like Person, Project, Technology, Organization, Concept)
- Relationships between entities (from, to, type like USES, OWNS, WORKS_ON, DEPENDS_ON, RELATED_TO)
- Confidence (0.0-1.0)

## Text to Process
"{TEXT}"

## Output Format (JSON only)
{
  "facts": [
    {
      "network": "world_fact|experience|entity_summary|belief",
      "fact": "concise fact statement",
      "entities": [{ "name": "EntityName", "type": "EntityType" }],
      "relationships": [{ "from": "Entity1", "to": "Entity2", "type": "RELATIONSHIP_TYPE" }],
      "confidence": 0.9
    }
  ]
}

Extract ALL meaningful facts. Be thorough but concise. Respond with valid JSON only.`;

// ============================================================================
// Extraction Pipeline
// ============================================================================

/**
 * Extract structured facts from raw text using an LLM.
 */
export async function extractFacts(
  text: string,
  config: ExtractionConfig,
): Promise<ExtractionResult> {
  const { model, temperature = 0.1, maxRetries = 2 } = config;

  const prompt = EXTRACTION_PROMPT.replace('{TEXT}', text.replace(/"/g, '\\"'));
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const { text: response } = await generateText({
        model,
        prompt,
        temperature,
      });

      log.debug(`Extraction response (attempt ${attempt + 1})`, { preview: response.slice(0, 200) });

      const facts = parseExtractionResponse(response);

      if (facts.length === 0 && attempt < maxRetries) {
        log.warn(`Empty extraction on attempt ${attempt + 1}, retrying`);
        continue;
      }

      return { facts, rawText: text };
    } catch (error) {
      lastError = error;
      log.warn(`Extraction attempt ${attempt + 1} failed`, { error: String(error) });
      if (attempt < maxRetries) continue;
    }
  }

  log.error('Extraction failed after retries', { error: String(lastError) });
  // Return empty on failure rather than throwing — memory should still work without extraction
  return { facts: [], rawText: text };
}

/**
 * Parse the LLM extraction response into structured facts.
 */
function parseExtractionResponse(response: string): ExtractedFact[] {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log.warn('No JSON found in extraction response');
    return [];
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      facts?: Array<{
        network?: string;
        fact?: string;
        entities?: Array<{ name?: string; type?: string }>;
        relationships?: Array<{ from?: string; to?: string; type?: string }>;
        confidence?: number;
      }>;
    };

    const validNetworks = new Set<string>(['world_fact', 'experience', 'entity_summary', 'belief']);

    return (parsed.facts ?? [])
      .filter((f) => f.fact && f.network && validNetworks.has(f.network))
      .map((f) => ({
        network: f.network as MemoryNetworkType,
        fact: f.fact!,
        entities: (f.entities ?? [])
          .filter((e) => e.name && e.type)
          .map((e) => ({ name: e.name!, type: e.type! })),
        relationships: (f.relationships ?? [])
          .filter((r) => r.from && r.to && r.type)
          .map((r) => ({ from: r.from!, to: r.to!, type: r.type! })),
        confidence: Math.max(0, Math.min(1, f.confidence ?? 0.8)),
      }));
  } catch (error) {
    log.error('Failed to parse extraction response', { error: String(error) });
    return [];
  }
}
