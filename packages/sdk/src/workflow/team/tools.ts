/**
 * @fileoverview AI SDK tools for team coordination.
 *
 * 6 tools: team_message, team_broadcast, team_tasks, team_claim,
 * team_complete, team_status.
 */

import { z } from 'zod';
import { tool } from 'ai';
import type { Team } from './types';

/**
 * Create all 6 team coordination tools.
 * These are injected into each team member agent's tool set.
 */
export function createTeamTools(team: Team, memberName: string) {
  return {
    team_message: tool({
      description:
        'Send a direct message to a specific team member. ' +
        'Use this to coordinate, share findings, or request help.',
      inputSchema: z.object({
        to: z.string().describe('Name of the team member to message.'),
        content: z.string().describe('Message content to send.'),
      }),
      execute: async ({ to, content }) => {
        team.sendMessage(memberName, to, content);
        return { sent: true, to, content: content.slice(0, 100) };
      },
    }),

    team_broadcast: tool({
      description:
        'Broadcast a message to all team members. ' +
        'Use this for announcements, status updates, or sharing results.',
      inputSchema: z.object({
        content: z.string().describe('Message to broadcast to all team members.'),
      }),
      execute: async ({ content }) => {
        team.broadcast(memberName, content);
        return { broadcasted: true, content: content.slice(0, 100) };
      },
    }),

    team_tasks: tool({
      description:
        'View the current task board. Shows all tasks with their status, ' +
        'who claimed them, and which are available to claim.',
      inputSchema: z.object({}),
      execute: async () => {
        const tasks = team.getTaskBoard();
        return {
          total: tasks.length,
          tasks: tasks.map((t) => ({
            id: t.task.id,
            description: t.task.description,
            status: t.status,
            claimedBy: t.claimedBy,
            dependsOn: t.task.dependsOn,
          })),
        };
      },
    }),

    team_claim: tool({
      description:
        'Claim a task from the task board. The task must be pending and have ' +
        'all dependencies satisfied. Only one member can claim a task (atomic).',
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task to claim.'),
      }),
      execute: async ({ taskId }) => {
        const success = team.claimTask(taskId, memberName);
        return { claimed: success, taskId, memberName };
      },
    }),

    team_complete: tool({
      description:
        'Mark a previously claimed task as completed with a result. ' +
        'Call this after you have finished the task.',
      inputSchema: z.object({
        taskId: z.string().describe('The ID of the task to complete.'),
        result: z.string().describe('The result/output of the completed task.'),
      }),
      execute: async ({ taskId, result }) => {
        const success = team.completeTask(taskId, result);
        return { completed: success, taskId };
      },
    }),

    team_status: tool({
      description:
        'Get the current status of the team: phase, member states, ' +
        'task progress, and recent messages.',
      inputSchema: z.object({}),
      execute: async () => {
        const snapshot = team.getPersistedSnapshot();
        return {
          phase: snapshot.phase,
          members: snapshot.members,
          taskCounts: {
            total: snapshot.tasks.length,
            pending: snapshot.tasks.filter((t) => t.status === 'pending').length,
            claimed: snapshot.tasks.filter((t) => t.status === 'claimed').length,
            completed: snapshot.tasks.filter((t) => t.status === 'completed').length,
          },
          recentMessages: snapshot.messages.slice(-5),
        };
      },
    }),
  };
}
