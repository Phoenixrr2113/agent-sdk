/**
 * @fileoverview Integration tests for team coordination: createTeam, TaskBoard advanced scenarios,
 * team tools, and state machine transitions.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import {
  createAgent,
  TaskBoard,
  createTeamTools,
  createTeam,
} from '@agent/sdk';
import { createMockModel } from './setup';

describe('Team Coordination', () => {
  describe('TaskBoard advanced', () => {
    it('should handle complex dependency chains', () => {
      const board = new TaskBoard();
      // A → B → C (linear dependency chain)
      board.addTask({ id: 'a', description: 'Task A' });
      board.addTask({ id: 'b', description: 'Task B', dependsOn: ['a'] });
      board.addTask({ id: 'c', description: 'Task C', dependsOn: ['b'] });

      // Only A should be available initially
      expect(board.getAvailable()).toHaveLength(1);
      expect(board.getAvailable()[0].task.id).toBe('a');

      // Complete A → B becomes available
      board.claim('a', 'w1');
      board.complete('a', 'A done');
      expect(board.getAvailable()).toHaveLength(1);
      expect(board.getAvailable()[0].task.id).toBe('b');

      // Complete B → C becomes available
      board.claim('b', 'w1');
      board.complete('b', 'B done');
      expect(board.getAvailable()).toHaveLength(1);
      expect(board.getAvailable()[0].task.id).toBe('c');

      // Complete C → nothing available
      board.claim('c', 'w1');
      board.complete('c', 'C done');
      expect(board.getAvailable()).toHaveLength(0);
    });

    it('should handle diamond dependencies', () => {
      const board = new TaskBoard();
      // A → B, A → C, B+C → D
      board.addTask({ id: 'a', description: 'Task A' });
      board.addTask({ id: 'b', description: 'Task B', dependsOn: ['a'] });
      board.addTask({ id: 'c', description: 'Task C', dependsOn: ['a'] });
      board.addTask({ id: 'd', description: 'Task D', dependsOn: ['b', 'c'] });

      // Only A available
      expect(board.getAvailable()).toHaveLength(1);

      // Complete A → B and C available
      board.claim('a', 'w1');
      board.complete('a', 'done');
      const available = board.getAvailable();
      expect(available).toHaveLength(2);
      const availableIds = available.map((a) => a.task.id).sort();
      expect(availableIds).toEqual(['b', 'c']);

      // Complete B → D still blocked (C not done)
      board.claim('b', 'w1');
      board.complete('b', 'done');
      expect(board.getAvailable()).toHaveLength(1);
      expect(board.getAvailable()[0].task.id).toBe('c');

      // Complete C → D available
      board.claim('c', 'w2');
      board.complete('c', 'done');
      expect(board.getAvailable()).toHaveLength(1);
      expect(board.getAvailable()[0].task.id).toBe('d');
    });

    it('should track results for completed tasks', () => {
      const board = new TaskBoard();
      board.addTask({ id: 'task-1', description: 'Test task' });
      board.claim('task-1', 'worker');
      board.complete('task-1', 'The result data');

      const counts = board.getCounts();
      expect(counts.completed).toBe(1);
      expect(counts.pending).toBe(0);
      expect(counts.claimed).toBe(0);
    });

    it('should handle batch task additions', () => {
      const tasks = Array.from({ length: 10 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
      }));

      const board = new TaskBoard(tasks);
      expect(board.getCounts().pending).toBe(10);
      expect(board.getAvailable()).toHaveLength(10);
    });
  });

  describe('createTeam', () => {
    it('should create a team with a lead and members', () => {
      const team = createTeam({
        name: 'test-team',
        lead: {
          name: 'coordinator',
          agent: createAgent({
            model: createMockModel('Coordinating tasks...'),
            toolPreset: 'none',
            maxSteps: 1,
          }),
        },
        members: [
          {
            name: 'coder',
            agent: createAgent({
              model: createMockModel('Code written.'),
              toolPreset: 'none',
              maxSteps: 1,
            }),
          },
          {
            name: 'reviewer',
            agent: createAgent({
              model: createMockModel('Code reviewed.'),
              toolPreset: 'none',
              maxSteps: 1,
            }),
          },
        ],
      });

      expect(team).toBeDefined();
      expect(team.name).toBe('test-team');
      expect(team.memberCount).toBeGreaterThanOrEqual(2);
    });

    it('should expose task management methods', () => {
      const team = createTeam({
        name: 'methods-team',
        lead: {
          name: 'lead',
          agent: createAgent({
            model: createMockModel('Leading.'),
            toolPreset: 'none',
            maxSteps: 1,
          }),
        },
        members: [
          {
            name: 'worker',
            agent: createAgent({
              model: createMockModel('Working.'),
              toolPreset: 'none',
              maxSteps: 1,
            }),
          },
        ],
      });

      expect(typeof team.getTaskBoard).toBe('function');
      expect(typeof team.getMessages).toBe('function');
      expect(typeof team.getPhase).toBe('function');
      expect(typeof team.sendMessage).toBe('function');
      expect(typeof team.broadcast).toBe('function');
    });
  });

  describe('createTeamTools', () => {
    it('should create team management tools', () => {
      const board = new TaskBoard();
      const tools = createTeamTools(board);

      expect(tools).toBeDefined();
      const toolNames = Object.keys(tools);
      expect(toolNames.length).toBeGreaterThan(0);
    });

    it('should include task management tools', () => {
      const board = new TaskBoard();
      const tools = createTeamTools(board);
      const toolNames = Object.keys(tools);

      expect(toolNames.some((name) => name.includes('task') || name.includes('claim') || name.includes('complete'))).toBe(true);
    });
  });
});
