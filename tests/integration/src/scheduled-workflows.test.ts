/**
 * @fileoverview Integration tests for scheduled workflows.
 * Tests createScheduledWorkflow, createDailyBriefing, createWeeklyReport.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import {
  createScheduledWorkflow,
  createDailyBriefing,
  createWeeklyReport,
} from '@agntk/core';

describe('Scheduled Workflows', () => {
  describe('createScheduledWorkflow', () => {
    it('should create a scheduled workflow with correct properties', () => {
      const workflow = createScheduledWorkflow({
        name: 'test-schedule',
        interval: '1h',
        task: async (iteration) => `Result ${iteration}`,
        maxIterations: 3,
      });

      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('test-schedule');
      expect(workflow.interval).toBe('1h');
      expect(typeof workflow.start).toBe('function');
      expect(typeof workflow.cancel).toBe('function');
    });

    it('should expose isRunning and completedIterations', () => {
      const workflow = createScheduledWorkflow({
        name: 'state-check',
        interval: '1s',
        task: async () => {},
        maxIterations: 1,
      });

      expect(workflow.isRunning).toBe(false);
      expect(workflow.completedIterations).toBe(0);
    });

    it('should execute task and complete with maxIterations', async () => {
      const results: number[] = [];

      const workflow = createScheduledWorkflow({
        name: 'counted-schedule',
        interval: '1s',
        task: async (iteration) => {
          results.push(iteration);
          return iteration;
        },
        maxIterations: 3,
        immediate: true,
      });

      const finalResult = await workflow.start();

      expect(finalResult).toBeDefined();
      expect(finalResult.name).toBe('counted-schedule');
      expect(finalResult.totalIterations).toBe(3);
      expect(finalResult.cancelled).toBe(false);
      expect(finalResult.ticks).toHaveLength(3);
      expect(results).toEqual([0, 1, 2]);
    });

    it('should call onTick after each task execution', async () => {
      const tickResults: string[] = [];

      const workflow = createScheduledWorkflow<string>({
        name: 'tick-test',
        interval: '1s',
        task: async (iteration) => `Result ${iteration}`,
        maxIterations: 2,
        immediate: true,
        onTick: (result) => {
          tickResults.push(result);
        },
      });

      await workflow.start();

      expect(tickResults).toEqual(['Result 0', 'Result 1']);
    });
  });

  describe('createDailyBriefing', () => {
    it('should create a daily briefing workflow', () => {
      const briefing = createDailyBriefing({
        generateBriefing: async () => 'Good morning! Here is your daily briefing...',
        deliver: async () => {},
      });

      expect(briefing).toBeDefined();
      expect(briefing.name).toContain('daily');
      expect(briefing.interval).toBe('1d');
    });

    it('should accept a custom interval', () => {
      const briefing = createDailyBriefing({
        generateBriefing: async () => 'Briefing',
        deliver: async () => {},
        interval: '12h',
      });

      expect(briefing.interval).toBe('12h');
    });
  });

  describe('createWeeklyReport', () => {
    it('should create a weekly report workflow', () => {
      const report = createWeeklyReport({
        generateReport: async () => 'Weekly report: All tasks completed this week.',
        deliver: async () => {},
      });

      expect(report).toBeDefined();
      expect(report.name).toContain('weekly');
      expect(report.interval).toBe('7d');
    });

    it('should accept a custom interval', () => {
      const report = createWeeklyReport({
        generateReport: async () => 'Report',
        deliver: async () => {},
        interval: '5d',
      });

      expect(report.interval).toBe('5d');
    });
  });
});
