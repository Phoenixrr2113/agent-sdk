/**
 * @fileoverview AI SDK tools for SpecialistPool interaction.
 *
 * - spawn_specialist: Spawn or reuse a cached domain specialist.
 * - list_specialists: List all cached specialists and their state.
 */

import { z } from 'zod';
import { tool } from 'ai';
import type { SpecialistPool } from './specialist-pool';

// ============================================================================
// spawn_specialist
// ============================================================================

export function createSpawnSpecialistTool(pool: SpecialistPool) {
  return tool({
    description:
      'Spawn or reuse a cached domain specialist. If a specialist for the given domain ' +
      'already exists and has not expired, it is reused. Otherwise a new specialist is created ' +
      'with the specified role, skills, and instructions.',
    inputSchema: z.object({
      domain: z.string().describe('Domain/specialty name (used as cache key).'),
      role: z
        .enum(['generic', 'coder', 'researcher', 'analyst'])
        .optional()
        .describe('Agent role. Default: generic.'),
      skills: z
        .array(z.string())
        .optional()
        .describe('Skill directory paths or skill names to inject.'),
      instructions: z
        .string()
        .optional()
        .describe('Custom system prompt instructions for this specialist.'),
      prompt: z.string().describe('The prompt/task to send to the specialist.'),
    }),
    execute: async ({ domain, role, skills, instructions, prompt }) => {
      const cached = await pool.spawn({ domain, role, skills, instructions });
      const response = await pool.generate(domain, prompt);

      return {
        domain: cached.domain,
        response,
        useCount: cached.useCount,
        skills: cached.agent.skills,
        fromCache: cached.useCount > 1,
      };
    },
  });
}

// ============================================================================
// list_specialists
// ============================================================================

export function createListSpecialistsTool(pool: SpecialistPool) {
  return tool({
    description:
      'List all cached specialists in the pool with their domain, age, usage count, ' +
      'history length, and expiration status.',
    inputSchema: z.object({}),
    execute: async () => {
      const specialists = pool.list();
      return {
        count: specialists.length,
        specialists: specialists.map((s) => ({
          domain: s.domain,
          useCount: s.useCount,
          historyLength: s.historyLength,
          expired: s.expired,
          skills: s.skills,
          ageMs: Date.now() - s.createdAt,
          lastUsedMs: Date.now() - s.lastUsedAt,
        })),
      };
    },
  });
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create all pool tools for use with an Agent's tool set.
 */
export function createPoolTools(pool: SpecialistPool) {
  return {
    spawn_specialist: createSpawnSpecialistTool(pool),
    list_specialists: createListSpecialistsTool(pool),
  };
}
