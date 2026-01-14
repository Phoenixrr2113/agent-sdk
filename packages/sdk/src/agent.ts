/**
 * @agent/sdk - Core Agent Factory
 * 
 * Creates agents using AI SDK's ToolLoopAgent pattern.
 * Provides opinionated defaults for tools, roles, and streaming.
 */

import { generateId, ToolLoopAgent, stepCountIs } from 'ai';
import type { Tool, ToolSet } from 'ai';
import { createLogger } from '@agent/logger';
import type { AgentOptions, AgentRole, ToolPreset } from './types/agent';
import { resolveModel } from './models';
import { roleConfigs, getRoleSystemPrompt } from './presets/roles';
import { createToolPreset, type ToolPresetLevel } from './presets/tools';
import { createSpawnAgentTool } from './tools/spawn-agent';

// ============================================================================
// Logger
// ============================================================================

const log = createLogger('@agent/sdk:agent');

// ============================================================================
// Agent Instance Type
// ============================================================================

export interface Agent {
  /** Unique identifier for this agent instance */
  agentId: string;
  
  /** Role of this agent */
  role: AgentRole;
  
  /** Stream a response (returns the ToolLoopAgent's stream result) */
  stream: (input: { prompt: string }) => ReturnType<ToolLoopAgent['stream']>;
  
  /** Generate a non-streaming response */
  generate: (input: { prompt: string }) => ReturnType<ToolLoopAgent['generate']>;
  
  /** Get the underlying ToolLoopAgent instance */
  getToolLoopAgent: () => ToolLoopAgent;
  
  /** Get the system prompt */
  getSystemPrompt: () => string;
}

// ============================================================================
// Tool Building
// ============================================================================

function buildTools(options: AgentOptions, workspaceRoot: string): ToolSet {
  const { toolPreset = 'standard', tools = {}, enableTools, disableTools } = options;
  
  log.debug('Building tools', { preset: toolPreset, customTools: Object.keys(tools).length });

  // Create preset tools using factory
  let allTools: ToolSet = createToolPreset(toolPreset as ToolPresetLevel, {
    workspaceRoot,
  }) as ToolSet;
  
  // Add custom tools
  Object.assign(allTools, tools);
  
  // Filter enabled tools
  if (enableTools?.length) {
    const enabledSet = new Set(enableTools);
    allTools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => enabledSet.has(name))
    ) as ToolSet;
  }
  
  // Remove disabled tools
  if (disableTools?.length) {
    for (const name of disableTools) {
      delete allTools[name];
    }
  }
  
  log.debug('Tools ready', { tools: Object.keys(allTools) });

  return allTools;
}

// ============================================================================
// Create Agent Factory
// ============================================================================

/**
 * Creates an agent with the given options.
 * 
 * @example
 * ```typescript
 * const agent = createAgent({
 *   role: 'coder',
 *   workspaceRoot: '/my/project',
 *   toolPreset: 'standard',
 * });
 * 
 * const result = await agent.generate({ prompt: 'Create a hello world function' });
 * console.log(result.text);
 * ```
 */
export function createAgent(options: AgentOptions = {}): Agent {
  const {
    role = 'generic',
    agentId = generateId(),
    systemPrompt,
    maxSteps = 10,
    enableSubAgents = false,
    workspaceRoot = process.cwd(),
  } = options;

  log.info('Creating agent', { agentId, role, maxSteps, enableSubAgents });

  // Get role configuration
  const roleConfig = roleConfigs[role];
  
  // Resolve system prompt
  const finalSystemPrompt = systemPrompt ?? roleConfig.systemPrompt;
  
  // Resolve model
  log.debug('Resolving model', {
    tier: roleConfig.recommendedModel,
    provider: options.modelProvider,
    modelName: options.modelName,
  });

  const model = options.model ?? resolveModel({
    tier: roleConfig.recommendedModel as 'fast' | 'standard' | 'reasoning' | 'powerful',
    provider: options.modelProvider as 'openrouter' | 'ollama' | 'openai' | 'anthropic' | undefined,
    modelName: options.modelName,
  });

  // Build tools
  let tools = buildTools(options, workspaceRoot);
  
  // Add spawn_agent tool if enabled
  if (enableSubAgents) {
    log.debug('Enabling sub-agents', { maxSpawnDepth: options.maxSpawnDepth ?? 2 });

    const spawnTool = createSpawnAgentTool({
      maxSpawnDepth: options.maxSpawnDepth ?? 2,
      currentDepth: 0,
      createAgent: (subAgentOptions) => {
        log.info('Spawning sub-agent', {
          parentId: agentId,
          role: subAgentOptions.role,
        });

        const subAgent = createAgent({
          role: subAgentOptions.role as AgentRole,
          systemPrompt: subAgentOptions.instructions,
          enableSubAgents: false, // Prevent recursion
          workspaceRoot,
          maxSteps: subAgentOptions.maxSpawnDepth ?? 5,
        });
        return {
          stream: (input: { prompt: string }) => {
            const streamPromise = subAgent.stream(input);
            return {
              fullStream: (async function* () {
                const result = await streamPromise;
                for await (const chunk of result.fullStream) {
                  yield chunk;
                }
              })(),
              text: streamPromise.then(r => r.text),
            };
          },
        };
      },
    });
    tools = { ...tools, spawn_agent: spawnTool };
  }

  // Create the ToolLoopAgent
  log.debug('Creating ToolLoopAgent', {
    promptLength: finalSystemPrompt.length,
    toolCount: Object.keys(tools).length,
  });

  const toolLoopAgent = new ToolLoopAgent({
    model,
    instructions: finalSystemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps),
  });

  // Create a child logger for this agent instance
  const agentLog = log.child({ agentId });

  // Create the agent instance
  const agent: Agent = {
    agentId,
    role,
    
    getToolLoopAgent: () => toolLoopAgent,
    getSystemPrompt: () => finalSystemPrompt,
    
    stream: (input) => {
      agentLog.info('stream() called', { promptLength: input.prompt.length });
      const done = agentLog.time('stream');
      const result = toolLoopAgent.stream({ prompt: input.prompt });
      // Note: Can't await async stream here, timing logged on first await
      return result;
    },
    
    generate: async (input) => {
      agentLog.info('generate() called', { promptLength: input.prompt.length });
      const done = agentLog.time('generate');
      try {
        const result = await toolLoopAgent.generate({ prompt: input.prompt });
        done();
        agentLog.info('generate() completed', {
          steps: result.steps?.length,
          textLength: result.text?.length ?? 0,
        });
        return result;
      } catch (error) {
        done();
        agentLog.error('generate() failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };

  log.info('Agent created', { agentId, role });

  return agent;
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function createCoderAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'coder' });
}

export function createResearcherAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'researcher' });
}

export function createAnalystAgent(options: Omit<AgentOptions, 'role'> = {}): Agent {
  return createAgent({ ...options, role: 'analyst' });
}

export default createAgent;
