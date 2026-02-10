/**
 * @fileoverview XState v5 machines for team coordination.
 *
 * - teamCoordinationMachine: Parent actor managing team lifecycle
 *   (planning → executing → synthesizing → completed)
 * - teammateMachine: Child actor for each team member
 *   (idle → working → completed)
 */

import { setup, assign, sendTo, sendParent, fromPromise } from 'xstate';
import type { ActorRefFrom } from 'xstate';
import type {
  TeamPhase,
  TeammatePhase,
  TeamMessage,
  TeamOutput,
  TaskState,
  TeamMemberConfig,
  TaskDefinition,
} from './types';
import { TaskBoard } from './task-board';
import type { Agent } from '../../agent';

// ============================================================================
// Teammate Machine
// ============================================================================

export interface TeammateContext {
  name: string;
  role: string;
  agent: Agent;
  phase: TeammatePhase;
  inbox: TeamMessage[];
  outputs: string[];
  currentTaskId?: string;
}

export type TeammateEvent =
  | { type: 'ASSIGN_TASK'; taskId: string; description: string }
  | { type: 'MESSAGE'; message: TeamMessage }
  | { type: 'WORK_COMPLETE'; result: string }
  | { type: 'WORK_ERROR'; error: string }
  | { type: 'FINISH' };

export const teammateMachine = setup({
  types: {
    context: {} as TeammateContext,
    events: {} as TeammateEvent,
    input: {} as { name: string; role: string; agent: Agent },
  },
  actions: {
    receiveMessage: assign({
      inbox: ({ context, event }) => {
        if (event.type !== 'MESSAGE') return context.inbox;
        return [...context.inbox, event.message];
      },
    }),
    assignTask: assign({
      currentTaskId: ({ event }) => {
        if (event.type !== 'ASSIGN_TASK') return undefined;
        return event.taskId;
      },
      phase: 'working' as TeammatePhase,
    }),
    recordOutput: assign({
      outputs: ({ context, event }) => {
        if (event.type !== 'WORK_COMPLETE') return context.outputs;
        return [...context.outputs, event.result];
      },
      phase: 'idle' as TeammatePhase,
      currentTaskId: undefined,
    }),
    markCompleted: assign({
      phase: 'completed' as TeammatePhase,
    }),
    markError: assign({
      phase: 'error' as TeammatePhase,
    }),
  },
}).createMachine({
  id: 'teammate',
  initial: 'idle',
  context: ({ input }) => ({
    name: input.name,
    role: input.role,
    agent: input.agent,
    phase: 'idle' as TeammatePhase,
    inbox: [],
    outputs: [],
  }),
  states: {
    idle: {
      on: {
        ASSIGN_TASK: {
          target: 'working',
          actions: 'assignTask',
        },
        MESSAGE: {
          actions: 'receiveMessage',
        },
        FINISH: {
          target: 'completed',
          actions: 'markCompleted',
        },
      },
    },
    working: {
      on: {
        WORK_COMPLETE: {
          target: 'idle',
          actions: ['recordOutput', sendParent(({ event }) => ({
            type: 'MEMBER_TASK_COMPLETE' as const,
            result: event.type === 'WORK_COMPLETE' ? event.result : '',
          }))],
        },
        WORK_ERROR: {
          target: 'idle',
          actions: 'markError',
        },
        MESSAGE: {
          actions: 'receiveMessage',
        },
      },
    },
    completed: {
      type: 'final',
    },
  },
});

// ============================================================================
// Team Coordination Machine
// ============================================================================

export interface TeamCoordinationContext {
  name: string;
  phase: TeamPhase;
  members: Map<string, ActorRefFrom<typeof teammateMachine>>;
  memberConfigs: TeamMemberConfig[];
  taskBoard: TaskBoard;
  messages: TeamMessage[];
  outputs: TeamOutput[];
  finalResult?: string;
}

export type TeamCoordinationEvent =
  | { type: 'START_PLANNING' }
  | { type: 'START_EXECUTING' }
  | { type: 'START_SYNTHESIZING' }
  | { type: 'MEMBER_TASK_COMPLETE'; result: string }
  | { type: 'SYNTHESIS_COMPLETE'; result: string }
  | { type: 'ERROR'; error: string };

export const teamCoordinationMachine = setup({
  types: {
    context: {} as TeamCoordinationContext,
    events: {} as TeamCoordinationEvent,
    input: {} as {
      name: string;
      memberConfigs: TeamMemberConfig[];
      tasks: TaskDefinition[];
    },
  },
  actions: {
    setPhase: assign({
      phase: (_, params: { phase: TeamPhase }) => params.phase,
    }),
    recordMemberOutput: assign({
      outputs: ({ context, event }) => {
        if (event.type !== 'MEMBER_TASK_COMPLETE') return context.outputs;
        return [...context.outputs, { memberName: 'member', text: event.result }];
      },
    }),
    setSynthesisResult: assign({
      finalResult: ({ event }) => {
        if (event.type !== 'SYNTHESIS_COMPLETE') return undefined;
        return event.result;
      },
      phase: 'completed' as TeamPhase,
    }),
    setError: assign({
      phase: 'error' as TeamPhase,
    }),
  },
  guards: {
    allTasksComplete: ({ context }) => context.taskBoard.isAllCompleted(),
  },
}).createMachine({
  id: 'teamCoordination',
  initial: 'planning',
  context: ({ input }) => ({
    name: input.name,
    phase: 'planning' as TeamPhase,
    members: new Map(),
    memberConfigs: input.memberConfigs,
    taskBoard: new TaskBoard(input.tasks),
    messages: [],
    outputs: [],
  }),
  states: {
    planning: {
      entry: assign({ phase: 'planning' as TeamPhase }),
      on: {
        START_EXECUTING: {
          target: 'executing',
        },
      },
    },
    executing: {
      entry: assign({ phase: 'executing' as TeamPhase }),
      on: {
        MEMBER_TASK_COMPLETE: [
          {
            guard: 'allTasksComplete',
            target: 'synthesizing',
            actions: 'recordMemberOutput',
          },
          {
            actions: 'recordMemberOutput',
          },
        ],
        START_SYNTHESIZING: {
          target: 'synthesizing',
        },
        ERROR: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    synthesizing: {
      entry: assign({ phase: 'synthesizing' as TeamPhase }),
      on: {
        SYNTHESIS_COMPLETE: {
          target: 'completed',
          actions: 'setSynthesisResult',
        },
        ERROR: {
          target: 'error',
          actions: 'setError',
        },
      },
    },
    completed: {
      entry: assign({ phase: 'completed' as TeamPhase }),
      type: 'final',
    },
    error: {
      entry: assign({ phase: 'error' as TeamPhase }),
      type: 'final',
    },
  },
});
