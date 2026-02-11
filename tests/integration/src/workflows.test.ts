/**
 * @fileoverview Integration tests for workflow builders, templates, team, and specialist pool.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@agntk/core';
import { createPipeline, createParallel, asStep, TaskBoard } from '@agntk/core/workflow';
import { SpecialistPool, createPoolTools } from '@agntk/core/advanced';
import { createMockModel } from './setup';

describe('Workflows', () => {
  describe('createPipeline', () => {
    it('should chain agent steps sequentially', async () => {
      const agentA = createAgent({
        model: createMockModel('Step A output'),
        systemPrompt: 'You transform text.',
        toolPreset: 'none',
        maxSteps: 1,
      });
      const agentB = createAgent({
        model: createMockModel('Final output after processing'),
        systemPrompt: 'You refine text.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const pipeline = createPipeline({
        steps: [asStep(agentA), asStep(agentB)],
      });

      const result = await pipeline.execute({ prompt: 'Raw input text' });
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
    });
  });

  describe('createParallel', () => {
    it('should fan out to multiple agents and synthesize', async () => {
      const agentA = createAgent({
        model: createMockModel('Analysis from perspective A'),
        systemPrompt: 'Analyze from perspective A.',
        toolPreset: 'none',
        maxSteps: 1,
      });
      const agentB = createAgent({
        model: createMockModel('Analysis from perspective B'),
        systemPrompt: 'Analyze from perspective B.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const parallel = createParallel({
        steps: [asStep(agentA), asStep(agentB)],
        synthesize: (results) => ({ text: results.map((r) => r.text).join(' | ') }),
      });

      const result = await parallel.execute({ prompt: 'Analyze this topic' });
      expect(result.text).toContain('|');
    });
  });

  describe('TaskBoard', () => {
    it('should manage task lifecycle: add, claim, complete', () => {
      const board = new TaskBoard();

      // Add tasks
      board.addTask({ id: 'task-1', description: 'First task' });
      board.addTask({ id: 'task-2', description: 'Second task', dependsOn: ['task-1'] });

      // Verify initial state — only task-1 available (task-2 blocked by dependency)
      const available = board.getAvailable();
      expect(available).toHaveLength(1);
      expect(available[0].task.id).toBe('task-1');

      // Claim task-1
      const claimed = board.claim('task-1', 'worker-a');
      expect(claimed).toBe(true);

      // Complete task-1
      board.complete('task-1', 'Result of task 1');

      // task-2 should now be available (dependency resolved)
      const nowAvailable = board.getAvailable();
      expect(nowAvailable).toHaveLength(1);
      expect(nowAvailable[0].task.id).toBe('task-2');
    });

    it('should prevent claiming already-claimed tasks', () => {
      const board = new TaskBoard();
      board.addTask({ id: 'task-1', description: 'Task' });
      board.claim('task-1', 'worker-a');
      const claimedAgain = board.claim('task-1', 'worker-b');
      expect(claimedAgain).toBe(false);
    });

    it('should track task counts', () => {
      const board = new TaskBoard([
        { id: 't1', description: 'Task 1' },
        { id: 't2', description: 'Task 2' },
      ]);

      expect(board.getCounts()).toEqual({ pending: 2, claimed: 0, completed: 0 });

      board.claim('t1', 'worker');
      expect(board.getCounts()).toEqual({ pending: 1, claimed: 1, completed: 0 });

      board.complete('t1', 'done');
      expect(board.getCounts()).toEqual({ pending: 1, claimed: 0, completed: 1 });
    });
  });

  describe('SpecialistPool', () => {
    it('should create pool, spawn specialist, and list', async () => {
      const pool = new SpecialistPool({
        maxAgents: 5,
        createAgent: (config) =>
          createAgent({
            model: createMockModel(`I am a ${config.domain} specialist`),
            systemPrompt: config.instructions ?? 'You are a specialist.',
            toolPreset: 'none',
            maxSteps: 1,
          }),
      });

      // Spawn a specialist (async)
      const specialist = await pool.spawn({
        domain: 'code-review',
        instructions: 'You review code.',
      });
      expect(specialist).toBeDefined();

      // List specialists
      const list = pool.list();
      expect(list).toHaveLength(1);
      expect(list[0].domain).toBe('code-review');
    });

    it('should generate a response from a spawned specialist', async () => {
      const pool = new SpecialistPool({
        maxAgents: 5,
        createAgent: () =>
          createAgent({
            model: createMockModel('Code looks good, approved!'),
            systemPrompt: 'You review code.',
            toolPreset: 'none',
            maxSteps: 1,
          }),
      });

      await pool.spawn({
        domain: 'reviewer',
        instructions: 'You review code.',
      });

      // Use pool.generate(domain, prompt) — the correct API
      const text = await pool.generate('reviewer', 'Review this function');
      expect(text).toBe('Code looks good, approved!');
    });
  });

  describe('createPoolTools', () => {
    it('should create pool management tools', () => {
      const pool = new SpecialistPool({
        maxAgents: 5,
        createAgent: () =>
          createAgent({
            model: createMockModel('test'),
            toolPreset: 'none',
            maxSteps: 1,
          }),
      });

      const tools = createPoolTools(pool);
      expect(tools).toBeDefined();
      const toolNames = Object.keys(tools);
      expect(toolNames.length).toBeGreaterThan(0);
    });
  });
});
