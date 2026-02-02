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
import { getRole } from './presets/role-registry';
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

  // Get role configuration from registry
  const roleConfig = getRole(role);
  
  // Resolve system prompt
  const finalSystemPrompt = systemPrompt ?? roleConfig.systemPrompt;
  
  // Resolve model
  log.debug('Resolving model', {
    tier: roleConfig.recommendedModel,
    provider: options.modelProvider,
    modelName: options.modelName,
  });

  const model = options.model ?? resolveModel({
    tier: (roleConfig.recommendedModel ?? 'standard') as 'fast' | 'standard' | 'reasoning' | 'powerful',
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
      agentLog.info('generate() called', {
        promptLength: input.prompt.length,
        prompt: input.prompt.slice(0, 500) + (input.prompt.length > 500 ? '...' : ''),
      });
      const done = agentLog.time('generate');
      try {
        const result = await toolLoopAgent.generate({ prompt: input.prompt });
        done();

        // Log each step with tool calls
        if (result.steps) {
          for (let i = 0; i < result.steps.length; i++) {
            const step = result.steps[i];

            // Log each tool call individually at trace level (full details)
            if (step.toolCalls) {
              for (const tc of step.toolCalls) {
                agentLog.trace(`Tool call: ${tc.toolName}`, {
                  tool: tc.toolName,
                  input: (tc as Record<string, unknown>).args ?? (tc as Record<string, unknown>).input,
                });
              }
            }

            // Log each tool result individually at trace level (full output)
            if (step.toolResults) {
              for (const tr of step.toolResults) {
                const output = (tr as Record<string, unknown>).result ?? (tr as Record<string, unknown>).output ?? '';
                agentLog.trace(`Tool result: ${tr.toolName}`, {
                  tool: tr.toolName,
                  output: typeof output === 'string' ? output.slice(0, 1000) : output,
                  outputLength: typeof output === 'string' ? output.length : undefined,
                });
              }
            }

            // Summary log for step
            agentLog.debug(`Step ${i + 1}/${result.steps.length}`, {
              toolCalls: step.toolCalls?.map(tc => tc.toolName) ?? [],
              toolResults: step.toolResults?.map(tr => tr.toolName) ?? [],
              textLength: step.text?.length ?? 0,
            });
          }
        }

        // Log token usage
        if (result.totalUsage) {
          agentLog.info('Token usage', {
            inputTokens: result.totalUsage.inputTokens,
            outputTokens: result.totalUsage.outputTokens,
            totalTokens: result.totalUsage.totalTokens,
            reasoningTokens: (result.totalUsage as Record<string, unknown>).reasoningTokens ?? 0,
            cachedInputTokens: (result.totalUsage as Record<string, unknown>).cachedInputTokens ?? 0,
          });
        }

        agentLog.info('generate() completed', {
          steps: result.steps?.length ?? 0,
          textLength: result.text?.length ?? 0,
          response: result.text?.slice(0, 500) + ((result.text?.length ?? 0) > 500 ? '...' : ''),
        });

        return result;
      } catch (error) {
        done();
        agentLog.error('generate() failed', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
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
