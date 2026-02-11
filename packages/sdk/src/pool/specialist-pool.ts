/**
 * @fileoverview SpecialistPool — LRU+TTL cache of domain specialists.
 *
 * Spawns (or reuses) specialist agents keyed by domain name.
 * Each specialist can have skills injected and maintains conversation history.
 */

import { createLogger } from '@agntk/logger';
import type {
  SpecialistPoolConfig,
  SpecialistConfig,
  CachedSpecialist,
  ConversationMessage,
  SpecialistAgent,
  HistoryStrategy,
} from './types';
import type { AgentOptions, AgentRole } from '../types/agent';
import { loadSkillsFromPaths, buildSkillsSystemPrompt } from '../skills';

const log = createLogger('@agntk/core:pool');

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_AGENTS = 10;
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_HISTORY_STRATEGY: HistoryStrategy = 'full';
const DEFAULT_WINDOW_SIZE = 20;

// ============================================================================
// SpecialistPool
// ============================================================================

export class SpecialistPool {
  private cache = new Map<string, CachedSpecialist>();
  private readonly maxAgents: number;
  private readonly ttlMs: number;
  private readonly defaultHistoryStrategy: HistoryStrategy;
  private readonly defaultWindowSize: number;
  private readonly createAgent: SpecialistPoolConfig['createAgent'];

  constructor(config: SpecialistPoolConfig) {
    this.maxAgents = config.maxAgents ?? DEFAULT_MAX_AGENTS;
    this.ttlMs = config.ttlMs ?? DEFAULT_TTL_MS;
    this.defaultHistoryStrategy = config.defaultHistoryStrategy ?? DEFAULT_HISTORY_STRATEGY;
    this.defaultWindowSize = config.defaultWindowSize ?? DEFAULT_WINDOW_SIZE;
    this.createAgent = config.createAgent;

    log.info('SpecialistPool created', {
      maxAgents: this.maxAgents,
      ttlMs: this.ttlMs,
      defaultHistoryStrategy: this.defaultHistoryStrategy,
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Spawn or reuse a specialist for the given domain.
   * Returns the cached specialist if not expired; otherwise creates a new one.
   */
  async spawn(config: SpecialistConfig): Promise<CachedSpecialist> {
    const { domain } = config;

    // Check for existing cached specialist
    const existing = this.cache.get(domain);
    if (existing && !this.isExpired(existing)) {
      log.debug('Cache hit', { domain, useCount: existing.useCount });
      existing.lastUsedAt = Date.now();
      existing.useCount += 1;
      return existing;
    }

    // Remove expired entry if present
    if (existing) {
      log.debug('Cache expired, recreating', { domain });
      this.cache.delete(domain);
    }

    // Evict LRU if at capacity
    this.evictIfNeeded();

    // Create new specialist
    const specialist = await this.createSpecialist(config);
    this.cache.set(domain, specialist);
    log.info('Specialist spawned', { domain, skills: config.skills?.length ?? 0 });

    return specialist;
  }

  /**
   * Generate a response from a specialist, managing conversation history.
   */
  async generate(domain: string, prompt: string): Promise<string> {
    const cached = this.cache.get(domain);
    if (!cached) {
      throw new Error(`No specialist found for domain: ${domain}. Call spawn() first.`);
    }

    if (this.isExpired(cached)) {
      this.cache.delete(domain);
      throw new Error(`Specialist for domain "${domain}" has expired. Call spawn() again.`);
    }

    cached.lastUsedAt = Date.now();
    cached.useCount += 1;

    // Build prompt with history context
    const contextualPrompt = this.buildContextualPrompt(cached, prompt);

    const result = await cached.agent.generate({ prompt: contextualPrompt });
    const text = result.text ?? '';

    // Update history
    cached.history.push(
      { role: 'user', content: prompt, timestamp: Date.now() },
      { role: 'assistant', content: text, timestamp: Date.now() },
    );

    return text;
  }

  /**
   * List all cached specialists with their metadata.
   */
  list(): Array<{
    domain: string;
    createdAt: number;
    lastUsedAt: number;
    useCount: number;
    historyLength: number;
    expired: boolean;
    skills: string[];
  }> {
    return Array.from(this.cache.values()).map((entry) => ({
      domain: entry.domain,
      createdAt: entry.createdAt,
      lastUsedAt: entry.lastUsedAt,
      useCount: entry.useCount,
      historyLength: entry.history.length,
      expired: this.isExpired(entry),
      skills: entry.agent.skills,
    }));
  }

  /**
   * Remove a specialist from the cache.
   */
  remove(domain: string): boolean {
    const deleted = this.cache.delete(domain);
    if (deleted) {
      log.info('Specialist removed', { domain });
    }
    return deleted;
  }

  /**
   * Clear all cached specialists.
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    log.info('Pool cleared', { removedCount: count });
  }

  /**
   * Get the current number of cached specialists.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get a cached specialist by domain (without modifying LRU state).
   */
  get(domain: string): CachedSpecialist | undefined {
    return this.cache.get(domain);
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private isExpired(entry: CachedSpecialist): boolean {
    return Date.now() - entry.createdAt > this.ttlMs;
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxAgents) {
      // Find LRU: oldest lastUsedAt
      let lruKey: string | undefined;
      let lruTime = Infinity;

      for (const [key, entry] of this.cache) {
        if (entry.lastUsedAt < lruTime) {
          lruTime = entry.lastUsedAt;
          lruKey = key;
        }
      }

      if (lruKey) {
        log.info('Evicting LRU specialist', { domain: lruKey, lastUsedAt: lruTime });
        this.cache.delete(lruKey);
      } else {
        break;
      }
    }
  }

  private async createSpecialist(config: SpecialistConfig): Promise<CachedSpecialist> {
    const role: AgentRole = config.role ?? 'generic';
    const skills = config.skills ?? [];

    // Build system prompt with skills
    let systemPrompt = config.instructions ?? '';
    if (skills.length > 0) {
      const loadedSkills = loadSkillsFromPaths(skills);
      if (loadedSkills.length > 0) {
        const skillsPrompt = buildSkillsSystemPrompt(loadedSkills);
        systemPrompt = systemPrompt ? `${systemPrompt}\n${skillsPrompt}` : skillsPrompt;
      }
    }

    // Create the agent via the factory
    const agentOptions: AgentOptions = {
      role,
      ...(systemPrompt && { systemPrompt }),
      ...config.agentOptions,
    };

    const rawAgent = this.createAgent(agentOptions);

    const agent: SpecialistAgent = {
      generate: rawAgent.generate,
      domain: config.domain,
      skills,
    };

    const now = Date.now();
    return {
      domain: config.domain,
      agent,
      createdAt: now,
      lastUsedAt: now,
      useCount: 1,
      history: [],
    };
  }

  private buildContextualPrompt(cached: CachedSpecialist, prompt: string): string {
    const history = this.getRelevantHistory(cached);
    if (history.length === 0) return prompt;

    const historyText = history
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');

    return `Previous conversation:\n${historyText}\n\nCurrent request: ${prompt}`;
  }

  private getRelevantHistory(cached: CachedSpecialist): ConversationMessage[] {
    const strategy = this.defaultHistoryStrategy;
    const history = cached.history;

    switch (strategy) {
      case 'full':
        return history;

      case 'sliding-window': {
        const windowSize = this.defaultWindowSize;
        return history.slice(-windowSize);
      }

      case 'summary':
        // Summary strategy: keep first message + last few for context
        if (history.length <= 4) return history;
        return [...history.slice(0, 2), ...history.slice(-2)];

      default:
        return history;
    }
  }
}
