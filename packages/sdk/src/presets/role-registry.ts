/**
 * @fileoverview Role Registry - manages built-in and custom roles.
 */

import { z } from 'zod';
import { createLogger } from '@agent/logger';
import { getConfig } from '../config';
import { applyTemplate } from '../prompts/template';

const log = createLogger('@agent/sdk:roles');

// ============================================================================
// Types
// ============================================================================

export interface RoleDefinition {
  /** System prompt for this role */
  systemPrompt: string;
  /** Zod schema for call options */
  callOptionsSchema?: z.ZodType;
  /** Default tools to include */
  defaultTools?: string[];
  /** Recommended model tier */
  recommendedModel?: 'fast' | 'standard' | 'reasoning' | 'powerful';
}

// ============================================================================
// Registry State
// ============================================================================

const roleRegistry = new Map<string, RoleDefinition>();
let configRolesLoaded = false;

// ============================================================================
// Base System Prompt
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an AI assistant with access to tools for completing tasks.

**Guidelines:**
- Be direct and concise in your responses
- Use tools when they would help accomplish the task
- Explain your reasoning when making decisions
- Ask for clarification if the request is ambiguous
- Complete tasks step by step, validating progress`;

// ============================================================================
// Built-in Role Prompts
// ============================================================================

const ROLE_PROMPTS = {
  generic: '',

  researcher: `
# Role: Research Specialist

You excel at gathering, verifying, and synthesizing information from multiple sources.

**Core competencies:**
- Web search and documentation retrieval
- Cross-referencing claims across sources
- Distinguishing fact from speculation
- Summarizing complex topics clearly

**Quality standards:**
- Cite sources for factual claims
- Explicitly state confidence levels
- Acknowledge when information is incomplete`,

  coder: `
# Role: Software Engineer

You write production-quality code that integrates cleanly with existing systems.

**Core competencies:**
- Reading and understanding existing codebases
- Writing clean, maintainable code
- Testing and validation
- Debugging and error diagnosis

**Quality standards:**
- Follow patterns established in the codebase
- Write tests for new functionality
- Consistent formatting with the codebase
- Meaningful variable and function names`,

  analyst: `
# Role: Data Analyst

You analyze information to extract insights and support decision-making.

**Core competencies:**
- Pattern recognition across datasets
- Statistical reasoning
- Hypothesis formation and testing
- Clear communication of findings

**Quality standards:**
- Distinguish correlation from causation
- Quantify uncertainty in conclusions
- Consider alternative explanations`,
};

// ============================================================================
// Built-in Roles
// ============================================================================

const BUILT_IN_ROLES: Record<string, RoleDefinition> = {
  generic: {
    systemPrompt: BASE_SYSTEM_PROMPT,
    defaultTools: ['shell', 'glob', 'grep'],
    recommendedModel: 'standard',
  },
  researcher: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n${ROLE_PROMPTS.researcher}`,
    defaultTools: ['glob', 'grep', 'deep_reasoning'],
    recommendedModel: 'standard',
  },
  coder: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n${ROLE_PROMPTS.coder}`,
    defaultTools: ['shell', 'glob', 'grep'],
    recommendedModel: 'powerful',
  },
  analyst: {
    systemPrompt: `${BASE_SYSTEM_PROMPT}\n${ROLE_PROMPTS.analyst}`,
    defaultTools: ['glob', 'grep', 'deep_reasoning'],
    recommendedModel: 'standard',
  },
};

// ============================================================================
// Registry Functions
// ============================================================================

/**
 * Register a role in the registry.
 */
export function registerRole(name: string, definition: RoleDefinition): void {
  log.debug('Registering role', { name, hasPrompt: !!definition.systemPrompt });
  roleRegistry.set(name, definition);
}

/**
 * Get a role from the registry.
 * Falls back to built-in roles, then generic.
 * Templates are applied to the system prompt.
 */
export function getRole(name: string): RoleDefinition {
  loadConfigRoles();

  let role: RoleDefinition;

  // Check registry first
  if (roleRegistry.has(name)) {
    role = roleRegistry.get(name)!;
  } else if (name in BUILT_IN_ROLES) {
    role = BUILT_IN_ROLES[name];
  } else {
    log.warn('Unknown role, using generic', { role: name });
    role = BUILT_IN_ROLES.generic;
  }

  // Apply template substitution
  return {
    ...role,
    systemPrompt: applyTemplate(role.systemPrompt),
  };
}

/**
 * Get all registered role names.
 */
export function getAllRoleNames(): string[] {
  loadConfigRoles();
  const builtIn = Object.keys(BUILT_IN_ROLES);
  const custom = Array.from(roleRegistry.keys());
  return [...new Set([...builtIn, ...custom])];
}

/**
 * Check if a role exists.
 */
export function hasRole(name: string): boolean {
  loadConfigRoles();
  return roleRegistry.has(name) || name in BUILT_IN_ROLES;
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Load roles from config file (called lazily on first access).
 */
function loadConfigRoles(): void {
  if (configRolesLoaded) return;
  configRolesLoaded = true;

  const config = getConfig();
  const roles = config.roles;

  if (!roles) return;

  for (const [name, roleConfig] of Object.entries(roles)) {
    if (!roleConfig) continue;

    // Build the full prompt
    let systemPrompt = roleConfig.systemPrompt ?? '';

    // If it's an override of a built-in role, inherit the base
    if (name in BUILT_IN_ROLES && !roleConfig.systemPrompt) {
      systemPrompt = BUILT_IN_ROLES[name].systemPrompt;
    } else if (systemPrompt && !systemPrompt.includes('Guidelines:')) {
      // Prepend base prompt if custom prompt doesn't include it
      systemPrompt = `${BASE_SYSTEM_PROMPT}\n\n${systemPrompt}`;
    }

    const definition: RoleDefinition = {
      systemPrompt,
      defaultTools: roleConfig.defaultTools,
      recommendedModel: roleConfig.recommendedModel as RoleDefinition['recommendedModel'],
    };

    log.info('Loading role from config', { name });
    registerRole(name, definition);
  }
}

/**
 * Reset the registry (for testing).
 */
export function resetRoleRegistry(): void {
  roleRegistry.clear();
  configRolesLoaded = false;
}

// ============================================================================
// Helpers for backward compatibility
// ============================================================================

export const SPAWNED_AGENT_CONTEXT = `
# Context: Spawned Sub-Agent

You are running as a sub-agent spawned by a parent agent to handle a delegated task.

**Constraints:**
- The delegate tool is disabled to prevent infinite recursion
- Focus on completing the delegated task autonomously
`;

export function buildSpawnedAgentPrompt(role: string): string {
  const def = getRole(role);
  return `${def.systemPrompt}\n${SPAWNED_AGENT_CONTEXT}`;
}

export { BASE_SYSTEM_PROMPT };
