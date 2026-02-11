/**
 * @agntk/core - Memory Extraction Pipeline
 *
 * LLM-powered extraction for the markdown-based memory system.
 * The LLM receives current memory.md + new input and returns updated memory.md.
 * No vector store, no embeddings — the LLM handles curation, dedup, and contradiction detection.
 */

import { generateText, type LanguageModel } from 'ai';
import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/core:extraction');

// ============================================================================
// Types
// ============================================================================

/** Hindsight 4-network memory taxonomy (used as section headers in memory.md) */
export type MemoryNetworkType = 'world_fact' | 'experience' | 'entity_summary' | 'belief';

// ============================================================================
// Prompts
// ============================================================================

const MEMORY_UPDATE_PROMPT = `You are a memory manager. Given the input and the current contents of memory.md, determine what to update.

CURRENT MEMORY.MD:
{CURRENT_MEMORY}

INPUT TO PROCESS:
"{INPUT}"

Respond with the updated memory.md contents. Rules:
- Add new facts under the appropriate section (World Facts, Decisions, Entity Knowledge, Preferences & Patterns)
- If a new fact contradicts an existing one, REPLACE the old fact
- If the fact is already captured, skip it
- Keep each section concise — facts as bullet points, one line each
- Remove facts that are no longer true
- Maximum ~200 lines total
- Always include all 4 section headers, even if a section is empty

Respond ONLY with the updated memory.md content. No explanations.`;

const MEMORY_FORGET_PROMPT = `You are a memory manager. Remove the specified fact from the current memory.md contents.

CURRENT MEMORY.MD:
{CURRENT_MEMORY}

FACT TO REMOVE:
"{INPUT}"

Remove the fact (or the closest matching fact) from memory.md. If the fact is not found, return the contents unchanged.

Respond ONLY with the updated memory.md content. No explanations.`;

const DECISION_ENTRY_PROMPT = `You are a decision logger. A decision was just made. Write a concise log entry in this exact format:

## {DATE} — [Decision Title]
**Context:** [Why this came up]
**Decision:** [What was decided]
**Rationale:** [Why this choice]
**Alternatives considered:** [What else was considered, if any]

The decision:
"{INPUT}"

Respond ONLY with the formatted decision entry. No explanations.`;

// ============================================================================
// Empty memory template
// ============================================================================

export const EMPTY_MEMORY_MD = `# Memory

## World Facts

## Decisions

## Entity Knowledge

## Preferences & Patterns
`;

// ============================================================================
// Extraction Functions
// ============================================================================

/**
 * Send current memory + new input to LLM, get back updated memory.md content.
 */
export async function extractAndUpdateMemory(
  currentMemory: string | null,
  input: string,
  model: LanguageModel,
): Promise<string> {
  const memory = currentMemory?.trim() || EMPTY_MEMORY_MD;

  const prompt = MEMORY_UPDATE_PROMPT
    .replace('{CURRENT_MEMORY}', memory)
    .replace('{INPUT}', input.replace(/"/g, '\\"'));

  log.debug('Extracting memory update', { inputLength: input.length, memoryLength: memory.length });

  try {
    const { text } = await generateText({ model, prompt, temperature: 0.1 });
    const result = text.trim();

    if (!result) {
      log.warn('Empty extraction result, returning current memory');
      return memory;
    }

    log.debug('Memory updated', { oldLength: memory.length, newLength: result.length });
    return result;
  } catch (error) {
    log.error('Memory extraction failed', { error: error instanceof Error ? error.message : String(error) });
    return memory;
  }
}

/**
 * Send current memory + fact to forget to LLM, get back updated memory.md content.
 */
export async function forgetFromMemory(
  currentMemory: string | null,
  factToForget: string,
  model: LanguageModel,
): Promise<string> {
  const memory = currentMemory?.trim() || EMPTY_MEMORY_MD;

  const prompt = MEMORY_FORGET_PROMPT
    .replace('{CURRENT_MEMORY}', memory)
    .replace('{INPUT}', factToForget.replace(/"/g, '\\"'));

  try {
    const { text } = await generateText({ model, prompt, temperature: 0.1 });
    return text.trim() || memory;
  } catch (error) {
    log.error('Memory forget failed', { error: error instanceof Error ? error.message : String(error) });
    return memory;
  }
}

/**
 * Generate a formatted decision log entry from a decision description.
 */
export async function generateDecisionEntry(
  input: string,
  model: LanguageModel,
): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const prompt = DECISION_ENTRY_PROMPT
    .replace('{DATE}', date!)
    .replace('{INPUT}', input.replace(/"/g, '\\"'));

  try {
    const { text } = await generateText({ model, prompt, temperature: 0.2 });
    return text.trim();
  } catch (error) {
    log.error('Decision entry generation failed', { error: error instanceof Error ? error.message : String(error) });
    // Fallback: simple entry
    return `## ${date} — Decision\n**Decision:** ${input}`;
  }
}
