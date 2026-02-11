/**
 * @agntk/core - Memory Tools
 *
 * Four markdown-based memory tools: remember, recall, update_context, forget.
 * Uses MemoryStore for persistence and LLM for extraction/curation.
 */

import { tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import { createLogger } from '@agntk/logger';
import type { MemoryStore } from './types';
import { extractAndUpdateMemory, forgetFromMemory, generateDecisionEntry } from './extraction';

const log = createLogger('@agntk/core:memory-tools');

// ============================================================================
// Types
// ============================================================================

export interface MemoryToolsOptions {
  /** MemoryStore instance for reading/writing files */
  store: MemoryStore;

  /** LanguageModel for extraction (required for remember/forget) */
  model?: LanguageModel;
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Create the 4 memory tools for an agent.
 *
 * @example
 * ```typescript
 * const store = new MarkdownMemoryStore({ workspaceRoot: '/my/project' });
 * const tools = createMemoryTools({ store, model });
 * ```
 */
export function createMemoryTools(options: MemoryToolsOptions) {
  const { store, model } = options;

  const remember = tool({
    description:
      'Store information in persistent memory. Extracts facts and updates memory.md. ' +
      'Use this when the user says "remember this" or when you learn something worth preserving across sessions. ' +
      'Also logs decisions to decisions.md when the input describes a decision.',
    inputSchema: z.object({
      text: z
        .string()
        .min(1)
        .max(10000)
        .describe('Information to remember'),
      isDecision: z
        .boolean()
        .optional()
        .describe('Set to true if this is a decision that should be logged to decisions.md'),
    }),
    execute: async ({ text, isDecision }) => {
      log.debug('remember() called', { textLength: text.length, isDecision });

      if (!model) {
        // Without a model, store text directly as a bullet point in memory.md
        const current = await store.loadMemory();
        const updated = (current ?? '# Memory\n') + `\n- ${text}`;
        await store.saveMemory(updated);
        return JSON.stringify({ success: true, message: 'Stored (no extraction — no model available)' });
      }

      try {
        // Extract and update memory.md via LLM
        const currentMemory = await store.loadMemory();
        const updatedMemory = await extractAndUpdateMemory(currentMemory, text, model);
        await store.saveMemory(updatedMemory);

        // Also log to decisions.md if flagged
        if (isDecision) {
          const entry = await generateDecisionEntry(text, model);
          await store.appendDecision(entry);
          log.info('Decision logged', { entryLength: entry.length });
        }

        log.info('Memory updated via extraction', { inputLength: text.length });
        return JSON.stringify({ success: true, message: 'Memory updated' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error('remember() failed', { error: msg });
        return JSON.stringify({ success: false, error: msg });
      }
    },
  });

  const recall = tool({
    description:
      'Search persistent memory for relevant information. ' +
      'Reads memory.md (curated facts) and decisions.md (decision log) and returns matching content. ' +
      'Use this when you need to check what was previously remembered or decided.',
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(1000)
        .describe('What to search for in memory'),
    }),
    execute: async ({ query }) => {
      log.debug('recall() called', { query: query.slice(0, 50) });

      try {
        const results: Array<{ source: string; content: string }> = [];

        // Search memory.md
        const memory = await store.loadMemory();
        if (memory) {
          const memoryMatches = searchContent(memory, query);
          if (memoryMatches.length > 0) {
            results.push({ source: 'memory.md', content: memoryMatches.join('\n') });
          }
        }

        // Search decisions.md
        const decisions = await store.loadDecisions();
        if (decisions) {
          const decisionMatches = searchContent(decisions, query);
          if (decisionMatches.length > 0) {
            results.push({ source: 'decisions.md', content: decisionMatches.join('\n') });
          }
        }

        // Search context.md
        const context = await store.loadContext();
        if (context) {
          const contextMatches = searchContent(context, query);
          if (contextMatches.length > 0) {
            results.push({ source: 'context.md', content: contextMatches.join('\n') });
          }
        }

        log.info('recall() completed', { query: query.slice(0, 30), resultCount: results.length });

        if (results.length === 0) {
          return JSON.stringify({
            success: true,
            message: 'No matching memories found.',
            results: [],
          });
        }

        return JSON.stringify({ success: true, results });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error('recall() failed', { error: msg });
        return JSON.stringify({ success: false, error: msg });
      }
    },
  });

  const update_context = tool({
    description:
      'Rewrite the session context file (context.md) with a summary of current work. ' +
      'Call this at the end of a session or when the focus of work changes significantly. ' +
      'The previous context.md is completely overwritten.',
    inputSchema: z.object({
      summary: z
        .string()
        .min(1)
        .max(5000)
        .describe('Summary of current session state: active work, recent changes, open questions, next steps'),
    }),
    execute: async ({ summary }) => {
      log.debug('update_context() called', { summaryLength: summary.length });

      try {
        const timestamp = new Date().toISOString().replace('T', ' ').split('.')[0];
        const content = `# Current Context\n*Last updated: ${timestamp}*\n\n${summary}`;
        await store.saveContext(content);

        log.info('Context updated', { length: content.length });
        return JSON.stringify({ success: true, message: 'Context updated' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error('update_context() failed', { error: msg });
        return JSON.stringify({ success: false, error: msg });
      }
    },
  });

  const forget = tool({
    description:
      'Remove a specific fact from persistent memory (memory.md). ' +
      'Use this when information is no longer true or relevant.',
    inputSchema: z.object({
      fact: z
        .string()
        .min(1)
        .max(1000)
        .describe('The fact to remove from memory'),
    }),
    execute: async ({ fact }) => {
      log.debug('forget() called', { fact: fact.slice(0, 50) });

      if (!model) {
        return JSON.stringify({ success: false, error: 'Cannot forget without a language model' });
      }

      try {
        const currentMemory = await store.loadMemory();
        const updatedMemory = await forgetFromMemory(currentMemory, fact, model);
        await store.saveMemory(updatedMemory);

        log.info('Fact forgotten', { factLength: fact.length });
        return JSON.stringify({ success: true, message: 'Fact removed from memory' });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        log.error('forget() failed', { error: msg });
        return JSON.stringify({ success: false, error: msg });
      }
    },
  });

  return { remember, recall, update_context, forget };
}

// ============================================================================
// Search Helpers
// ============================================================================

/**
 * Simple keyword search across lines of content.
 * Returns lines that match any word in the query.
 */
function searchContent(content: string, query: string): string[] {
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (queryWords.length === 0) return [];

  const lines = content.split('\n');
  const matches: string[] = [];

  // Search by paragraph (groups of consecutive non-empty lines)
  let currentParagraph: string[] = [];
  for (const line of lines) {
    if (line.trim() === '') {
      if (currentParagraph.length > 0) {
        const paragraph = currentParagraph.join('\n');
        const lower = paragraph.toLowerCase();
        if (queryWords.some(w => lower.includes(w))) {
          matches.push(paragraph);
        }
        currentParagraph = [];
      }
    } else {
      currentParagraph.push(line);
    }
  }

  // Don't forget the last paragraph
  if (currentParagraph.length > 0) {
    const paragraph = currentParagraph.join('\n');
    const lower = paragraph.toLowerCase();
    if (queryWords.some(w => lower.includes(w))) {
      matches.push(paragraph);
    }
  }

  return matches;
}
