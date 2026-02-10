/**
 * @fileoverview Types for the SpecialistPool.
 */

import type { AgentOptions, AgentRole } from '../types/agent';

/** History management strategy for cached specialists. */
export type HistoryStrategy = 'full' | 'sliding-window' | 'summary';

/** Configuration for a specialist in the pool. */
export interface SpecialistConfig {
  /** Domain/specialty name (used as cache key). */
  domain: string;
  /** Agent role. Default: 'generic'. */
  role?: AgentRole;
  /** Skills to inject (directory paths or skill names). */
  skills?: string[];
  /** Custom system prompt (appended to role prompt + skills). */
  instructions?: string;
  /** History strategy for conversation continuity. Default: 'full'. */
  historyStrategy?: HistoryStrategy;
  /** Max messages for sliding-window strategy. Default: 20. */
  historyWindowSize?: number;
  /** Additional agent options. */
  agentOptions?: Partial<AgentOptions>;
}

/** A cached specialist entry. */
export interface CachedSpecialist {
  /** Domain name. */
  domain: string;
  /** The specialist agent. */
  agent: SpecialistAgent;
  /** When this specialist was created. */
  createdAt: number;
  /** When this specialist was last used. */
  lastUsedAt: number;
  /** Number of times this specialist has been used. */
  useCount: number;
  /** Conversation history (for stateful specialists). */
  history: ConversationMessage[];
}

/** A message in conversation history. */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/** A specialist agent with metadata. */
export interface SpecialistAgent {
  /** Generate a response. */
  generate: (input: { prompt: string }) => Promise<{ text: string; [key: string]: unknown }>;
  /** The domain this specialist serves. */
  domain: string;
  /** Skills loaded for this specialist. */
  skills: string[];
}

/** Configuration for the SpecialistPool. */
export interface SpecialistPoolConfig {
  /** Maximum number of cached specialists. Default: 10. */
  maxAgents?: number;
  /** TTL for cached specialists (ms). Default: 30 minutes. */
  ttlMs?: number;
  /** Default history strategy. Default: 'full'. */
  defaultHistoryStrategy?: HistoryStrategy;
  /** Default sliding-window size. Default: 20. */
  defaultWindowSize?: number;
  /** Factory function to create agent instances. */
  createAgent: (options: AgentOptions) => { generate: (input: { prompt: string }) => Promise<{ text: string; [key: string]: unknown }> };
}
