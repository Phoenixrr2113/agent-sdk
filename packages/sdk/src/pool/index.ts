/**
 * @fileoverview Pool module barrel exports.
 */

export { SpecialistPool } from './specialist-pool';
export { createPoolTools, createSpawnSpecialistTool, createListSpecialistsTool } from './tools';
export type {
  SpecialistPoolConfig,
  SpecialistConfig,
  CachedSpecialist,
  ConversationMessage,
  SpecialistAgent,
  HistoryStrategy,
} from './types';
