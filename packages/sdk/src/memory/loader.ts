/**
 * @agntk/core - Memory Loader
 *
 * Loads memory files from a MemoryStore and formats them as a string
 * for injection into the agent's system prompt.
 *
 * Load order (from PLAN.md):
 *   1. ~/.agntk/identity.md
 *   2. ~/.agntk/preferences.md
 *   3. .agntk/project.md (or CLAUDE.md / AGENTS.md)
 *   4. .agntk/memory.md
 *   5. .agntk/context.md
 */

import { createLogger } from '@agntk/logger';
import type { MemoryStore } from './types';

const log = createLogger('@agntk/core:memory-loader');

/** Rough token estimate: ~4 chars per token */
const CHARS_PER_TOKEN = 4;
const TOKEN_WARNING_THRESHOLD = 2000;

/**
 * Load all always-on memory files and format as a system prompt section.
 * Missing files are silently skipped.
 */
export async function loadMemoryContext(store: MemoryStore): Promise<string> {
  const sections: string[] = [];

  // 1. Identity (global, human-authored)
  const identity = await store.loadIdentity();
  if (identity) {
    sections.push(formatSection('Identity', identity));
  }

  // 2. Preferences (global, agent-curated)
  const preferences = await store.loadPreferences();
  if (preferences) {
    sections.push(formatSection('Preferences', preferences));
  }

  // 3. Project (local, human-authored — falls back to CLAUDE.md / AGENTS.md)
  const project = await store.loadProject();
  if (project) {
    sections.push(formatSection('Project', project));
  }

  // 4. Memory (local, agent-curated facts)
  const memory = await store.loadMemory();
  if (memory) {
    sections.push(formatSection('Memory', memory));
  }

  // 5. Context (local, agent-rewritten each session)
  const context = await store.loadContext();
  if (context) {
    sections.push(formatSection('Current Context', context));
  }

  if (sections.length === 0) {
    return '';
  }

  const result = '# Persistent Memory\n\n' + sections.join('\n\n');

  // Warn if memory context is large
  const estimatedTokens = Math.ceil(result.length / CHARS_PER_TOKEN);
  if (estimatedTokens > TOKEN_WARNING_THRESHOLD) {
    log.warn('Memory context is large', {
      estimatedTokens,
      threshold: TOKEN_WARNING_THRESHOLD,
      chars: result.length,
    });
  }

  log.debug('Memory context loaded', {
    sections: sections.length,
    chars: result.length,
    estimatedTokens,
  });

  return result;
}

function formatSection(title: string, content: string): string {
  return `## ${title}\n\n${content}`;
}
