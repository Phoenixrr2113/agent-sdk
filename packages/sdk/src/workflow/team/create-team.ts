/**
 * @fileoverview createTeam — public API for team coordination.
 *
 * Creates a Team that satisfies the Workflow interface, enabling
 * composition with createPipeline and createParallel.
 */

import { createLogger } from '@agntk/logger';
import type {
  TeamConfig,
  TeamMemberConfig,
  Team,
  TeamPhase,
  TeammatePhase,
  TeamMessage,
  TeamOutput,
  TaskState,
  TeamSnapshot,
} from './types';
import type { WorkflowInput, WorkflowOutput } from '../builders/types';
import { TaskBoard } from './task-board';
import { teamCoordinationMachine, teammateMachine } from './machines';

const log = createLogger('@agntk/core:team');

/**
 * Create a team of agents that coordinate via messaging, claim tasks
 * from a shared board, and produce synthesized results.
 *
 * Satisfies the Workflow interface so it can be used inside createPipeline
 * or createParallel.
 *
 * @example
 * ```typescript
 * const team = createTeam({
 *   name: 'research-team',
 *   lead: { name: 'lead', agent: leadAgent },
 *   members: [
 *     { name: 'researcher', agent: researchAgent },
 *     { name: 'writer', agent: writerAgent },
 *   ],
 *   tasks: [
 *     { id: 'research', description: 'Research the topic' },
 *     { id: 'write', description: 'Write the report', dependsOn: ['research'] },
 *   ],
 * });
 *
 * const result = await team.execute({ prompt: 'quantum computing' });
 * ```
 */
export function createTeam(config: TeamConfig): Team {
  const { name, lead, members, tasks = [] } = config;

  if (!lead) throw new Error('Team must have a lead');
  if (members.length === 0) throw new Error('Team must have at least one member');

  // Internal state
  const taskBoard = new TaskBoard(tasks);
  const messages: TeamMessage[] = [];
  const outputs: TeamOutput[] = [];
  const memberPhases = new Map<string, TeammatePhase>();
  let teamPhase: TeamPhase = 'planning';

  // Initialize member phases
  memberPhases.set(lead.name, 'idle');
  for (const member of members) {
    memberPhases.set(member.name, 'idle');
  }

  const allMembers = [lead, ...members];

  // ─────────────────────────────────────────────────────────────────────────
  // Team interface implementation
  // ─────────────────────────────────────────────────────────────────────────

  const team: Team = {
    name,
    memberCount: allMembers.length,

    getTaskBoard(): TaskState[] {
      return taskBoard.getAll();
    },

    getMessages(): TeamMessage[] {
      return [...messages];
    },

    getPhase(): TeamPhase {
      return teamPhase;
    },

    sendMessage(from: string, to: string, content: string): void {
      if (!memberPhases.has(from)) throw new Error(`Unknown sender: ${from}`);
      if (to !== 'all' && !memberPhases.has(to)) throw new Error(`Unknown recipient: ${to}`);

      const msg: TeamMessage = { from, to, content, timestamp: Date.now() };
      messages.push(msg);
      log.debug('Message sent', { from, to, contentLen: content.length });
    },

    broadcast(from: string, content: string): void {
      if (!memberPhases.has(from)) throw new Error(`Unknown sender: ${from}`);

      const msg: TeamMessage = { from, to: 'all', content, timestamp: Date.now() };
      messages.push(msg);
      log.debug('Broadcast', { from, contentLen: content.length });
    },

    claimTask(taskId: string, memberName: string): boolean {
      if (!memberPhases.has(memberName)) return false;
      const claimed = taskBoard.claim(taskId, memberName);
      if (claimed) {
        memberPhases.set(memberName, 'working');
        log.info('Task claimed', { taskId, memberName });
      }
      return claimed;
    },

    completeTask(taskId: string, result: string): boolean {
      const allTasks = taskBoard.getAll();
      const taskState = allTasks.find((t) => t.task.id === taskId);
      if (!taskState || taskState.status !== 'claimed') return false;

      const memberName = taskState.claimedBy!;
      const completed = taskBoard.complete(taskId, result);
      if (completed) {
        memberPhases.set(memberName, 'idle');
        outputs.push({ memberName, taskId, text: result });
        log.info('Task completed', { taskId, memberName });
      }
      return completed;
    },

    getPersistedSnapshot(): TeamSnapshot {
      return {
        name,
        phase: teamPhase,
        members: allMembers.map((m) => ({
          name: m.name,
          phase: memberPhases.get(m.name) ?? 'idle',
        })),
        tasks: taskBoard.getAll(),
        messages: [...messages],
        outputs: [...outputs],
      };
    },

    async execute(input: WorkflowInput): Promise<WorkflowOutput> {
      log.info('Team executing', { name, prompt: input.prompt.slice(0, 100) });

      teamPhase = 'planning';

      // Phase 1: Planning — lead agent plans the work
      log.info('Phase: planning');
      const planPrompt = buildPlanPrompt(input.prompt, tasks, members);
      const planResult = await lead.agent.generate({ prompt: planPrompt });
      const plan = planResult.text ?? '';

      // Phase 2: Executing — members work on tasks
      teamPhase = 'executing';
      log.info('Phase: executing');

      if (tasks.length > 0) {
        // Task-based execution: each member works on available tasks
        await executeTaskBased(team, allMembers, taskBoard, input.prompt, plan);
      } else {
        // Prompt-based execution: each member processes the prompt
        await executePromptBased(allMembers, input.prompt, plan, outputs);
      }

      // Phase 3: Synthesizing
      teamPhase = 'synthesizing';
      log.info('Phase: synthesizing');

      let finalText: string;
      if (config.synthesize) {
        finalText = await config.synthesize(outputs);
      } else {
        // Default: lead agent synthesizes
        const synthPrompt = buildSynthesisPrompt(input.prompt, outputs);
        const synthResult = await lead.agent.generate({ prompt: synthPrompt });
        finalText = synthResult.text ?? '';
      }

      teamPhase = 'completed';
      log.info('Team completed', { name, outputLength: finalText.length });

      // Mark all members completed
      for (const m of allMembers) {
        memberPhases.set(m.name, 'completed');
      }

      return {
        text: finalText,
        metadata: {
          teamName: name,
          memberCount: allMembers.length,
          taskCount: tasks.length,
          messageCount: messages.length,
          outputs: outputs.map((o) => ({ member: o.memberName, taskId: o.taskId })),
        },
      };
    },
  };

  return team;
}

// ============================================================================
// Internal execution helpers
// ============================================================================

function buildPlanPrompt(
  prompt: string,
  tasks: { id: string; description: string; dependsOn?: string[] }[],
  members: { name: string; role?: string }[],
): string {
  const memberList = members.map((m) => `- ${m.name}${m.role ? ` (${m.role})` : ''}`).join('\n');

  if (tasks.length > 0) {
    const taskList = tasks.map((t) => {
      const deps = t.dependsOn?.length ? ` [depends on: ${t.dependsOn.join(', ')}]` : '';
      return `- ${t.id}: ${t.description}${deps}`;
    }).join('\n');

    return (
      `You are the team lead. Plan how to accomplish this task with your team.\n\n` +
      `Task: ${prompt}\n\nTeam members:\n${memberList}\n\nAvailable tasks:\n${taskList}\n\n` +
      `Create a brief plan for task assignment.`
    );
  }

  return (
    `You are the team lead. Plan how to accomplish this task with your team.\n\n` +
    `Task: ${prompt}\n\nTeam members:\n${memberList}\n\n` +
    `Create a brief plan for how each member should contribute.`
  );
}

function buildSynthesisPrompt(prompt: string, outputs: TeamOutput[]): string {
  const outputText = outputs
    .map((o) => `[${o.memberName}${o.taskId ? ` / task:${o.taskId}` : ''}]: ${o.text}`)
    .join('\n\n');

  return (
    `Synthesize the following team outputs into a cohesive final result.\n\n` +
    `Original task: ${prompt}\n\nTeam outputs:\n${outputText}`
  );
}

async function executeTaskBased(
  team: Team,
  allMembers: TeamMemberConfig[],
  taskBoard: TaskBoard,
  prompt: string,
  plan: string,
): Promise<void> {
  // Simple round-robin task execution
  const maxRounds = 10;
  let round = 0;

  while (!taskBoard.isAllCompleted() && round < maxRounds) {
    round++;
    const available = taskBoard.getAvailable();
    if (available.length === 0 && !taskBoard.isAllCompleted()) {
      // Tasks may still be claimed but not completed — break to avoid infinite loop
      break;
    }

    // Assign available tasks to idle members
    const executions: Promise<void>[] = [];

    for (const taskState of available) {
      // Find an idle member
      const member = allMembers.find(
        (m) => !taskBoard.getAll().some(
          (t) => t.status === 'claimed' && t.claimedBy === m.name,
        ),
      );

      if (!member) break;

      if (team.claimTask(taskState.task.id, member.name)) {
        executions.push(
          (async () => {
            const taskPrompt = `${plan}\n\nYour task: ${taskState.task.description}\nContext: ${prompt}`;
            const result = await member.agent.generate({ prompt: taskPrompt });
            team.completeTask(taskState.task.id, result.text ?? '');
          })(),
        );
      }
    }

    if (executions.length > 0) {
      await Promise.all(executions);
    } else {
      break;
    }
  }
}

async function executePromptBased(
  allMembers: TeamMemberConfig[],
  prompt: string,
  plan: string,
  outputs: TeamOutput[],
): Promise<void> {
  // All members (except lead, index 0) execute in parallel
  const memberPromises = allMembers.slice(1).map(async (member) => {
    const memberPrompt = `${plan}\n\nYour role: ${member.role ?? member.name}\nTask: ${prompt}`;
    const result = await member.agent.generate({ prompt: memberPrompt });
    outputs.push({ memberName: member.name, text: result.text ?? '' });
  });

  await Promise.all(memberPromises);
}
