/**
 * @agent/sdk - Search Skills Tool
 *
 * AI SDK tool that allows agents to dynamically search for skills by keyword.
 * Backed by cached frontmatter metadata with file-change invalidation.
 */

import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'node:fs';
import { createLogger } from '@agent/logger';
import { discoverSkills, searchSkills } from '../skills/loader';
import type { SkillMeta } from '../skills/types';

const log = createLogger('@agent/sdk:search-skills');

// ============================================================================
// Cache
// ============================================================================

interface SkillCache {
  skills: SkillMeta[];
  /** Map of skill path → mtime at load time */
  mtimes: Map<string, number>;
  loadedAt: number;
}

let cache: SkillCache | null = null;

/** Maximum age before a full re-scan (5 minutes). */
const MAX_CACHE_AGE_MS = 5 * 60 * 1000;

/**
 * Check if cached skill files have changed on disk.
 */
function isCacheStale(c: SkillCache): boolean {
  // Time-based expiry
  if (Date.now() - c.loadedAt > MAX_CACHE_AGE_MS) return true;

  // Check mtimes of known files
  for (const [filePath, cachedMtime] of c.mtimes) {
    try {
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs !== cachedMtime) return true;
    } catch (_e: unknown) {
      // File deleted → stale
      return true;
    }
  }

  return false;
}

/**
 * Get skills from cache or re-scan from disk.
 */
function getCachedSkills(directories?: string[], basePath?: string): SkillMeta[] {
  if (cache && !isCacheStale(cache)) {
    return cache.skills;
  }

  log.debug('Refreshing skills cache');
  const skills = discoverSkills(directories, basePath);

  const mtimes = new Map<string, number>();
  for (const skill of skills) {
    try {
      const stat = fs.statSync(skill.path);
      mtimes.set(skill.path, stat.mtimeMs);
    } catch (_e: unknown) {
      // Skip if stat fails
    }
  }

  cache = { skills, mtimes, loadedAt: Date.now() };
  return skills;
}

/**
 * Clear the skills cache. Useful for testing.
 */
export function clearSkillsCache(): void {
  cache = null;
}

/**
 * Get the current cache for testing inspection.
 */
export function getSkillsCache(): SkillCache | null {
  return cache;
}

// ============================================================================
// Tool
// ============================================================================

export interface SearchSkillsToolConfig {
  /** Directories to scan for skills. */
  directories?: string[];
  /** Base path for resolving relative directories. */
  basePath?: string;
  /** Maximum results to return. Default: 5 */
  maxResults?: number;
}

/**
 * Create a search_skills tool for agent skill discovery.
 *
 * The tool searches cached skill metadata by keyword, returning
 * top matches ranked by relevance. Results include name, description,
 * tags, and when_to_use for the supervisor LLM to pick from.
 */
export function createSearchSkillsTool(config: SearchSkillsToolConfig = {}) {
  const { directories, basePath, maxResults = 5 } = config;

  return {
    search_skills: tool({
      description:
        'Search for available skills by keyword. Returns ranked matches ' +
        'with name, description, tags, and when_to_use guidance. ' +
        'Use this to find the right skill for a subtask.',
      inputSchema: z.object({
        query: z.string().describe('Search keywords (e.g. "deploy docker", "code review")'),
        limit: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe('Maximum results to return. Default: 5'),
      }),
      execute: async ({ query, limit }) => {
        const effectiveLimit = limit ?? maxResults;

        try {
          const skills = getCachedSkills(directories, basePath);

          if (skills.length === 0) {
            return JSON.stringify({
              success: true,
              count: 0,
              results: [],
              message: 'No skills found. Add SKILL.md files to your skills directory.',
            });
          }

          const matches = searchSkills(skills, query, effectiveLimit);

          const results = matches.map((m) => ({
            name: m.skill.name,
            description: m.skill.description,
            tags: m.skill.tags ?? [],
            whenToUse: m.skill.whenToUse ?? '',
            model: m.skill.model,
            score: Math.round(m.score * 100) / 100,
          }));

          log.debug('Skills search', { query, found: results.length, total: skills.length });

          return JSON.stringify({
            success: true,
            count: results.length,
            totalSkills: skills.length,
            results,
          });
        } catch (error) {
          log.error('Skills search failed', { query, error: String(error) });
          return JSON.stringify({
            success: false,
            error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      },
    }),
  };
}
