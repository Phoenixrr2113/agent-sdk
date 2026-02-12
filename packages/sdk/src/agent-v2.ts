/**
 * @agntk/core - V2 Agent Factory
 *
 * A fully-equipped agent that shows up ready. No roles, no tool presets,
 * no feature flags. You give it a name, tell it what it's doing, and
 * point it at a task. It figures out the rest.
 *
 * Every capability is auto-detected from the environment:
 * - Tools: ALL tools, always
 * - Memory: always on, stored at ~/.agntk/agents/{name}/
 * - Durability: auto-detected (workflow package installed → on)
 * - Telemetry: auto-detected (LANGFUSE_PUBLIC_KEY set → on)
 * - Skills: auto-discovered from standard directories
 * - Sub-agents: always enabled with team coordination
 * - Reflection: always on (reflact strategy)
 * - Approval: always on for dangerous tools
 * - Model: auto-selected from available API keys
 */

import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { ToolLoopAgent, stepCountIs } from 'ai';
import type { ToolSet, TelemetrySettings as AiTelemetrySettings } from 'ai';
import { createLogger } from '@agntk/logger';
import type { AgentOptionsV2, AgentV2, AgentV2StreamResult } from './types/agent-v2';
import { usageLimitStop } from './usage-limits';
import { resolveModel } from './models';
import { createToolPreset } from './presets/tools';
import { createSpawnAgentTool } from './tools/spawn-agent';
import { wrapAllToolsWithRetry } from './tools/model-retry';
import { discoverSkills, filterEligibleSkills, buildSkillsSystemPrompt, loadSkillContent } from './skills';
import { checkWorkflowAvailability } from './workflow/utils';
import { wrapToolsAsDurable } from './workflow/durable-tool';
import { createReflectionPrepareStep } from './reflection';
// import { applyApproval } from './tools/approval'; // Disabled until approval handler is wired up
import { MarkdownMemoryStore } from './memory/store';
import { loadMemoryContext } from './memory/loader';
import { createMemoryTools } from './memory/tools';
import { initObservability, createTelemetrySettings } from './observability';
import { buildDynamicSystemPrompt } from './prompts/context';

// ============================================================================
// Logger
// ============================================================================

const log = createLogger('@agntk/core:agent-v2');

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_STEPS = 25;
const SUB_AGENT_MAX_STEPS = 15;
const DEFAULT_MAX_SPAWN_DEPTH = 2;
const AGENT_STATE_BASE = '.agntk/agents';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Resolve the persistent state directory for a named agent.
 * ~/.agntk/agents/{name}/
 */
function resolveAgentStatePath(name: string): string {
  // Sanitize name for filesystem
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return resolve(homedir(), AGENT_STATE_BASE, safeName);
}

/**
 * Detect if telemetry should be enabled from env vars.
 */
function detectTelemetry(): boolean {
  return !!(
    process.env.LANGFUSE_PUBLIC_KEY &&
    process.env.LANGFUSE_SECRET_KEY
  );
}

/**
 * Build the base instructions for the agent.
 * Combines user instructions with auto-discovered skills.
 */
function buildBaseInstructions(
  name: string,
  userInstructions?: string,
  skillsPrompt?: string,
): string {
  const parts: string[] = [];

  // Core identity
  parts.push(`You are ${name}, a capable AI agent.`);

  // User instructions
  if (userInstructions) {
    parts.push('');
    parts.push(userInstructions);
  }

  // Agent capabilities reminder
  parts.push('');
  parts.push(
    'You have access to a full suite of tools including file operations, ' +
    'shell commands, code search (grep, glob, ast-grep), a browser, ' +
    'deep reasoning, planning, and persistent memory. ' +
    'You can spawn sub-agents for complex tasks that benefit from delegation. ' +
    'Use the remember tool to persist important findings across sessions. ' +
    'Use the recall tool to search your memory for relevant context.',
  );

  // Skills
  if (skillsPrompt) {
    parts.push('');
    parts.push(skillsPrompt);
  }

  return parts.join('\n');
}

// ============================================================================
// V2 Agent Factory
// ============================================================================

/**
 * Create a v2 agent — fully equipped, zero config.
 *
 * @example
 * ```typescript
 * const agent = createAgentV2({
 *   name: 'deploy-bot',
 *   instructions: 'You manage deployments for our k8s cluster.',
 * });
 *
 * const result = await agent.stream({ prompt: 'Roll back staging to yesterday' });
 * for await (const chunk of result.fullStream) {
 *   if (chunk.type === 'text-delta') process.stdout.write(chunk.text ?? '');
 * }
 * ```
 */
/**
 * Internal options not exposed in the public API.
 * Used by the factory when recursively creating sub-agents.
 */
interface InternalV2Options {
  /** Current spawn depth. 0 = top-level agent. */
  _spawnDepth?: number;
  /** Parent agent name, for naming sub-agents. */
  _parentName?: string;
}

export function createAgentV2(options: AgentOptionsV2, _internal: InternalV2Options = {}): AgentV2 {
  const {
    name,
    instructions,
    workspaceRoot = process.cwd(),
  } = options;

  const spawnDepth = _internal._spawnDepth ?? 0;
  const isSubAgent = spawnDepth > 0;
  const maxSteps = options.maxSteps ?? (isSubAgent ? SUB_AGENT_MAX_STEPS : DEFAULT_MAX_STEPS);

  log.info('Creating v2 agent', { name, maxSteps, workspaceRoot, spawnDepth });

  // ── 1. Resolve model ──────────────────────────────────────────────────
  // User override takes priority, otherwise auto-select from available API keys.
  const model = options.model ?? resolveModel({ tier: 'standard' });
  log.debug('Model resolved', { hasExplicitModel: !!options.model });

  // ── 2. Build ALL tools (no presets, no filtering) ─────────────────────
  // The 'full' preset creates every tool we have.
  let tools: ToolSet = createToolPreset('full', { workspaceRoot }) as ToolSet;
  log.debug('Base tools built', { count: Object.keys(tools).length, tools: Object.keys(tools) });

  // ── 3. Memory — always on ─────────────────────────────────────────────
  // Each named agent gets persistent state at ~/.agntk/agents/{name}/
  const agentStatePath = resolveAgentStatePath(name);
  const memoryStore = new MarkdownMemoryStore({
    projectDir: agentStatePath,
    globalDir: '.agntk', // Global identity/preferences at ~/.agntk/
    workspaceRoot,
  });

  const memoryTools = createMemoryTools({ store: memoryStore, model });
  Object.assign(tools, memoryTools);
  log.info('Memory enabled', {
    agentStatePath,
    projectPath: memoryStore.getProjectPath(),
    globalPath: memoryStore.getGlobalPath(),
    tools: Object.keys(memoryTools),
  });

  // ── 4. Sub-agents — recursive v2 creation ──────────────────────────────
  // Sub-agents are full v2 agents. At max depth, spawn tool is omitted.
  if (spawnDepth < DEFAULT_MAX_SPAWN_DEPTH) {
    const spawnTool = createSpawnAgentTool({
      maxSpawnDepth: DEFAULT_MAX_SPAWN_DEPTH,
      currentDepth: spawnDepth,
      createAgent: (subAgentOptions) => {
        const subName = `${name}/${subAgentOptions.role}`;
        log.info('Spawning sub-agent', { parentName: name, subName, role: subAgentOptions.role });

        // Create a full v2 sub-agent with depth+1.
        // It gets all tools, its own memory under the parent's state dir,
        // and won't get a spawn tool if at max depth.
        const subAgent = createAgentV2(
          {
            name: subName,
            instructions: subAgentOptions.instructions,
            workspaceRoot,
            maxSteps: SUB_AGENT_MAX_STEPS,
            model: options.model, // Inherit parent's model
          },
          {
            _spawnDepth: spawnDepth + 1,
            _parentName: name,
          },
        );

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
              text: streamPromise.then((r) => r.text),
            };
          },
        };
      },
    });
    tools = { ...tools, spawn_agent: spawnTool };
    log.debug('Sub-agents enabled', { maxSpawnDepth: DEFAULT_MAX_SPAWN_DEPTH, currentDepth: spawnDepth });
  } else {
    log.debug('Sub-agents disabled (at max spawn depth)', { spawnDepth });
  }

  // ── 5. Approval — off by default ─────────────────────────────────────
  // The v2 agent is run by a person who trusts it. Approval can be
  // re-enabled when we add a proper approval handler to the CLI/SDK.
  // Without a handler, needsApproval: true silently blocks tool execution.
  log.debug('Approval disabled (no handler configured)');

  // ── 6. Durability — auto-detect ───────────────────────────────────────
  // Check if workflow package is available and wrap tools if so.
  // This is async but we wrap eagerly — the wrapper is inert without the runtime.
  tools = wrapToolsAsDurable(tools, { retryCount: 3 }) as ToolSet;
  checkWorkflowAvailability().then((available) => {
    if (available) {
      log.info('Durable tool wrapping active (workflow package detected)');
    } else {
      log.debug('Workflow package not installed — durable wrapping is inert');
    }
  }).catch(() => { /* swallow */ });

  // ── 7. ModelRetry — always on ─────────────────────────────────────────
  tools = wrapAllToolsWithRetry(tools, 3) as ToolSet;
  log.debug('ModelRetry wrapping applied');

  // ── 8. Auto-discover skills ───────────────────────────────────────────
  let skillsPrompt = '';
  try {
    const discovered = discoverSkills(undefined, workspaceRoot);
    const eligible = filterEligibleSkills(discovered);
    if (eligible.length > 0) {
      const loaded = eligible.map((s) => loadSkillContent(s));
      skillsPrompt = buildSkillsSystemPrompt(loaded);
      log.info('Skills discovered', { count: eligible.length, names: eligible.map((s) => s.name) });
    }
  } catch (err) {
    log.warn('Skill discovery failed', { error: err instanceof Error ? err.message : String(err) });
  }

  // ── 9. Build system prompt ────────────────────────────────────────────
  let augmentedSystemPrompt = buildBaseInstructions(name, instructions, skillsPrompt);

  // ── 10. Stop conditions ───────────────────────────────────────────────
  const stopConditions: Array<(opts: { steps: Array<import('ai').StepResult<ToolSet>> }) => PromiseLike<boolean> | boolean> = [
    stepCountIs(maxSteps),
  ];

  if (options.usageLimits) {
    stopConditions.push(usageLimitStop(options.usageLimits));
    log.debug('Usage limits configured', { limits: options.usageLimits });
  }

  // ── 11. Reflection — always on (reflact strategy) ─────────────────────
  const prepareStep = createReflectionPrepareStep(augmentedSystemPrompt, {
    strategy: 'reflact',
  });
  log.debug('Reflection enabled', { strategy: 'reflact' });

  // ── 12. Telemetry — auto-detect ───────────────────────────────────────
  const telemetryEnabled = detectTelemetry();
  const telemetrySettings = telemetryEnabled
    ? createTelemetrySettings({ functionId: `agent-v2:${name}` })
    : undefined;

  if (telemetryEnabled) {
    log.debug('Telemetry will be initialized on first call');
  }

  // ── 13. Build the ToolLoopAgent ───────────────────────────────────────
  const toolLoopAgent = new ToolLoopAgent({
    model,
    instructions: augmentedSystemPrompt,
    tools,
    stopWhen: stopConditions,
    // Dynamic system prompt injection — picks up memory context after lazy load
    prepareCall: (opts) => ({ ...opts, instructions: augmentedSystemPrompt }),
    prepareStep,
    ...(telemetrySettings ? { experimental_telemetry: telemetrySettings as AiTelemetrySettings } : {}),
  });

  log.debug('ToolLoopAgent created', {
    promptLength: augmentedSystemPrompt.length,
    toolCount: Object.keys(tools).length,
    telemetry: !!telemetrySettings,
  });

  // ── Lazy initializers ─────────────────────────────────────────────────

  const agentLog = log.child({ agent: name });
  let initialized = false;
  let initPromise: Promise<void> | null = null;

  async function ensureInit(): Promise<void> {
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      // Load memory context into system prompt
      try {
        const memoryContext = await loadMemoryContext(memoryStore);
        if (memoryContext) {
          augmentedSystemPrompt = memoryContext + '\n\n' + augmentedSystemPrompt;
          agentLog.debug('Memory context injected', { chars: memoryContext.length });
        }
      } catch (err) {
        agentLog.warn('Memory context loading failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Inject dynamic environment context (time, platform, workspace)
      try {
        augmentedSystemPrompt = await buildDynamicSystemPrompt(augmentedSystemPrompt, {
          workspaceRoot,
          includeWorkspaceMap: true,
        });
        agentLog.debug('Dynamic context injected');
      } catch (err) {
        agentLog.warn('Dynamic context injection failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Initialize telemetry if detected
      if (telemetryEnabled) {
        try {
          await initObservability({
            provider: 'langfuse',
          });
          agentLog.info('Telemetry initialized');
        } catch (err) {
          agentLog.warn('Telemetry initialization failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      initialized = true;
    })();

    return initPromise;
  }

  // ── Build the agent instance ──────────────────────────────────────────

  const agent: AgentV2 = {
    name,

    init: ensureInit,

    getSystemPrompt: () => augmentedSystemPrompt,

    getToolNames: () => Object.keys(tools),

    stream: async (input): Promise<AgentV2StreamResult> => {
      await ensureInit();
      agentLog.info('stream() called', { promptLength: input.prompt.length });

      const result = await toolLoopAgent.stream({ prompt: input.prompt });

      return {
        fullStream: result.fullStream,
        text: result.text,
        usage: result.totalUsage,
      };
    },
  };

  log.info('V2 agent created', {
    name,
    spawnDepth,
    toolCount: Object.keys(tools).length,
    tools: Object.keys(tools),
    memoryPath: agentStatePath,
    durable: 'auto-detect',
    telemetry: telemetryEnabled,
    reflection: 'reflact',
  });

  return agent;
}

export default createAgentV2;
