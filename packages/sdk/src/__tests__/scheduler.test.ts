/**
 * @agent/sdk - Scheduled Workflows Tests (ADV-SCHEDULER-018)
 *
 * Tests for:
 * - createScheduledWorkflow() — loop, sleep, execute pattern
 * - Cancellation mid-schedule
 * - Error handling with onError callback
 * - maxIterations limit
 * - immediate vs deferred first tick
 * - createDailyBriefing() preset
 * - createWeeklyReport() preset
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createScheduledWorkflow,
  createDailyBriefing,
  createWeeklyReport,
} from '../workflow/schedulers';
import type {
  ScheduledWorkflowConfig,
  ScheduledWorkflow,
  ScheduleResult,
} from '../workflow/schedulers';

// ============================================================================
// Mock sleep() to avoid real delays
// ============================================================================

vi.mock('../workflow/hooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('../workflow/hooks')>();
  return {
    ...original,
    sleep: vi.fn().mockResolvedValue(undefined),
  };
});

import { sleep } from '../workflow/hooks';

const mockSleep = vi.mocked(sleep);

// ============================================================================
// Setup / Teardown
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// createScheduledWorkflow() Tests
// ============================================================================

describe('createScheduledWorkflow', () => {
  it('creates a scheduled workflow with correct properties', () => {
    const schedule = createScheduledWorkflow({
      name: 'test-schedule',
      description: 'A test schedule',
      interval: '1h',
      task: async () => {},
    });

    expect(schedule.name).toBe('test-schedule');
    expect(schedule.description).toBe('A test schedule');
    expect(schedule.interval).toBe('1h');
    expect(schedule.isRunning).toBe(false);
    expect(schedule.completedIterations).toBe(0);
    expect(schedule.results).toEqual([]);
    expect(typeof schedule.start).toBe('function');
    expect(typeof schedule.cancel).toBe('function');
  });

  it('throws on invalid interval format', () => {
    expect(() => createScheduledWorkflow({
      name: 'bad-interval',
      interval: 'every-day',
      task: async () => {},
    })).toThrow('Invalid duration format');
  });

  it('executes task for maxIterations then stops', async () => {
    const task = vi.fn().mockResolvedValue('done');

    const schedule = createScheduledWorkflow({
      name: 'bounded',
      interval: '1h',
      task,
      maxIterations: 3,
    });

    const result = await schedule.start();

    expect(result.name).toBe('bounded');
    expect(result.totalIterations).toBe(3);
    expect(result.cancelled).toBe(false);
    expect(result.ticks).toHaveLength(3);

    // Task called 3 times with iteration numbers
    expect(task).toHaveBeenCalledTimes(3);
    expect(task).toHaveBeenNthCalledWith(1, 0);
    expect(task).toHaveBeenNthCalledWith(2, 1);
    expect(task).toHaveBeenNthCalledWith(3, 2);

    // sleep called between iterations (not after last)
    // With immediate=true (default): 2 sleep calls (between iterations 0→1, 1→2)
    expect(mockSleep).toHaveBeenCalledTimes(2);
  });

  it('calls onTick after each successful execution', async () => {
    const onTick = vi.fn();
    const task = vi.fn()
      .mockResolvedValueOnce('result-0')
      .mockResolvedValueOnce('result-1');

    const schedule = createScheduledWorkflow<string>({
      name: 'ticked',
      interval: '5m',
      task,
      maxIterations: 2,
      onTick,
    });

    await schedule.start();

    expect(onTick).toHaveBeenCalledTimes(2);
    expect(onTick).toHaveBeenNthCalledWith(1, 'result-0', 0);
    expect(onTick).toHaveBeenNthCalledWith(2, 'result-1', 1);
  });

  it('handles task errors with onError callback', async () => {
    const onError = vi.fn().mockReturnValue(true); // continue
    const task = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered');

    const schedule = createScheduledWorkflow<string>({
      name: 'error-handling',
      interval: '1m',
      task,
      maxIterations: 3,
      onError,
    });

    const result = await schedule.start();

    expect(result.totalIterations).toBe(3);
    expect(result.ticks[0].success).toBe(true);
    expect(result.ticks[0].result).toBe('ok');
    expect(result.ticks[1].success).toBe(false);
    expect(result.ticks[1].error).toBe('boom');
    expect(result.ticks[2].success).toBe(true);
    expect(result.ticks[2].result).toBe('recovered');

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it('stops when onError returns false', async () => {
    const onError = vi.fn().mockReturnValue(false); // stop
    const task = vi.fn()
      .mockResolvedValueOnce('ok')
      .mockRejectedValueOnce(new Error('fatal'));

    const schedule = createScheduledWorkflow<string>({
      name: 'stop-on-error',
      interval: '1m',
      task,
      maxIterations: 5,
      onError,
    });

    const result = await schedule.start();

    // Should stop after iteration 1 (the error)
    expect(result.totalIterations).toBe(2);
    expect(result.cancelled).toBe(true);
    expect(task).toHaveBeenCalledTimes(2);
  });

  it('defers first tick when immediate=false', async () => {
    const task = vi.fn().mockResolvedValue('deferred');

    const schedule = createScheduledWorkflow({
      name: 'deferred',
      interval: '1h',
      task,
      maxIterations: 2,
      immediate: false,
    });

    await schedule.start();

    // With immediate=false, maxIterations=2:
    // 1. sleep (before first tick)
    // 2. tick 0
    // 3. sleep (between ticks)
    // 4. tick 1
    // = 2 sleep calls
    expect(mockSleep).toHaveBeenCalledTimes(2);
    // First sleep call should be the deferred start
    expect(mockSleep).toHaveBeenNthCalledWith(1, '1h', {
      reason: 'deferred: waiting for first interval',
    });
  });

  it('sleeps with correct interval and reason', async () => {
    const schedule = createScheduledWorkflow({
      name: 'interval-check',
      interval: '30m',
      task: async () => {},
      maxIterations: 2,
    });

    await schedule.start();

    expect(mockSleep).toHaveBeenCalledWith('30m', {
      reason: 'interval-check: interval sleep (iteration 1)',
    });
  });

  it('reports isRunning correctly', async () => {
    let resolveTask: (() => void) | undefined;
    const task = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveTask = resolve;
      });
    });

    const schedule = createScheduledWorkflow({
      name: 'running-check',
      interval: '1h',
      task,
      maxIterations: 1,
    });

    expect(schedule.isRunning).toBe(false);

    const startPromise = schedule.start();

    // Task is executing, schedule should be running
    expect(schedule.isRunning).toBe(true);

    // Resolve the task
    resolveTask!();
    await startPromise;

    expect(schedule.isRunning).toBe(false);
  });

  it('cancel stops the schedule', async () => {
    let iteration = 0;
    let _schedule: ScheduledWorkflow<string> | undefined;

    const schedule = createScheduledWorkflow<string>({
      name: 'cancelable',
      interval: '1h',
      task: async (i) => {
        iteration = i;
        if (i >= 1) {
          _schedule?.cancel();
        }
        return `result-${i}`;
      },
      maxIterations: 100,
    });

    _schedule = schedule;

    const result = await schedule.start();

    // Should have stopped after cancellation
    expect(result.cancelled).toBe(true);
    expect(result.totalIterations).toBeLessThanOrEqual(3);
    expect(schedule.isRunning).toBe(false);
  });

  it('throws if start is called while already running', async () => {
    const task = vi.fn().mockResolvedValue(undefined);
    const schedule = createScheduledWorkflow({
      name: 'double-start',
      interval: '1h',
      task,
      maxIterations: 1,
    });

    const p = schedule.start();

    await expect(schedule.start()).rejects.toThrow('already running');

    await p;
  });

  it('records tick results with timestamps', async () => {
    const task = vi.fn().mockResolvedValue(42);

    const schedule = createScheduledWorkflow<number>({
      name: 'timestamped',
      interval: '1m',
      task,
      maxIterations: 1,
    });

    const result = await schedule.start();

    expect(result.ticks[0].iteration).toBe(0);
    expect(result.ticks[0].success).toBe(true);
    expect(result.ticks[0].result).toBe(42);
    expect(result.ticks[0].completedAt).toBeInstanceOf(Date);
  });

  it('completedIterations increments during execution', async () => {
    let capturedIterations = 0;
    let _schedule: ScheduledWorkflow | undefined;

    const schedule = createScheduledWorkflow({
      name: 'counter',
      interval: '1m',
      task: async () => {
        capturedIterations = _schedule?.completedIterations ?? 0;
      },
      maxIterations: 3,
    });

    _schedule = schedule;
    await schedule.start();

    // After completion
    expect(schedule.completedIterations).toBe(3);
  });

  it('results returns a copy of tick results', async () => {
    const schedule = createScheduledWorkflow<string>({
      name: 'copy',
      interval: '1m',
      task: async (i) => `tick-${i}`,
      maxIterations: 2,
    });

    await schedule.start();

    const results = schedule.results;
    expect(results).toHaveLength(2);
    expect(results[0].result).toBe('tick-0');
    expect(results[1].result).toBe('tick-1');

    // Should be a copy
    results.push({} as any);
    expect(schedule.results).toHaveLength(2);
  });

  it('handles non-Error thrown values', async () => {
    const onError = vi.fn().mockReturnValue(true);
    const task = vi.fn().mockRejectedValue('string error');

    const schedule = createScheduledWorkflow({
      name: 'non-error',
      interval: '1m',
      task,
      maxIterations: 1,
      onError,
    });

    const result = await schedule.start();

    expect(result.ticks[0].success).toBe(false);
    expect(result.ticks[0].error).toBe('string error');
  });

  it('continues without onError when task fails', async () => {
    const task = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const schedule = createScheduledWorkflow<string>({
      name: 'no-error-handler',
      interval: '1m',
      task,
      maxIterations: 2,
    });

    const result = await schedule.start();

    expect(result.totalIterations).toBe(2);
    expect(result.ticks[0].success).toBe(false);
    expect(result.ticks[1].success).toBe(true);
  });
});

// ============================================================================
// createDailyBriefing() Tests
// ============================================================================

describe('createDailyBriefing', () => {
  it('creates a daily briefing with default 1d interval', async () => {
    const generateBriefing = vi.fn().mockResolvedValue('Today\'s summary...');
    const deliver = vi.fn();

    const briefing = createDailyBriefing({
      generateBriefing,
      deliver,
      maxIterations: 2,
    });

    expect(briefing.name).toBe('daily-briefing');
    expect(briefing.interval).toBe('1d');

    const result = await briefing.start();

    expect(result.totalIterations).toBe(2);
    expect(generateBriefing).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(deliver).toHaveBeenNthCalledWith(1, 'Today\'s summary...', 0);
  });

  it('uses custom interval when provided', () => {
    const briefing = createDailyBriefing({
      generateBriefing: async () => '',
      deliver: () => {},
      interval: '12h',
    });

    expect(briefing.interval).toBe('12h');
  });

  it('continues despite errors', async () => {
    const generateBriefing = vi.fn()
      .mockRejectedValueOnce(new Error('API down'))
      .mockResolvedValueOnce('Recovered briefing');
    const deliver = vi.fn();

    const briefing = createDailyBriefing({
      generateBriefing,
      deliver,
      maxIterations: 2,
    });

    const result = await briefing.start();

    expect(result.totalIterations).toBe(2);
    expect(result.ticks[0].success).toBe(false);
    expect(result.ticks[1].success).toBe(true);
    // deliver only called for successful ticks
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// createWeeklyReport() Tests
// ============================================================================

describe('createWeeklyReport', () => {
  it('creates a weekly report with default 7d interval', async () => {
    const generateReport = vi.fn().mockResolvedValue('Week summary...');
    const deliver = vi.fn();

    const report = createWeeklyReport({
      generateReport,
      deliver,
      maxIterations: 2,
    });

    expect(report.name).toBe('weekly-report');
    expect(report.interval).toBe('7d');

    const result = await report.start();

    expect(result.totalIterations).toBe(2);
    expect(generateReport).toHaveBeenCalledTimes(2);
    expect(generateReport).toHaveBeenNthCalledWith(1, 0);
    expect(generateReport).toHaveBeenNthCalledWith(2, 1);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it('uses custom interval when provided', () => {
    const report = createWeeklyReport({
      generateReport: async () => '',
      deliver: () => {},
      interval: '14d',
    });

    expect(report.interval).toBe('14d');
  });

  it('continues despite errors', async () => {
    const generateReport = vi.fn()
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce('Week 2 report');
    const deliver = vi.fn();

    const report = createWeeklyReport({
      generateReport,
      deliver,
      maxIterations: 2,
    });

    const result = await report.start();

    expect(result.totalIterations).toBe(2);
    expect(result.ticks[0].success).toBe(false);
    expect(result.ticks[1].success).toBe(true);
    expect(deliver).toHaveBeenCalledTimes(1);
  });
});

// ============================================================================
// Integration: Schedule Lifecycle
// ============================================================================

describe('Integration: full schedule lifecycle', () => {
  it('runs 2 complete cycles with sleep between', async () => {
    const results: string[] = [];

    const schedule = createScheduledWorkflow<string>({
      name: 'lifecycle-test',
      interval: '1h',
      task: async (i) => `cycle-${i}`,
      maxIterations: 2,
      onTick: (result) => results.push(result),
    });

    expect(schedule.isRunning).toBe(false);
    expect(schedule.completedIterations).toBe(0);

    const finalResult = await schedule.start();

    expect(schedule.isRunning).toBe(false);
    expect(schedule.completedIterations).toBe(2);
    expect(results).toEqual(['cycle-0', 'cycle-1']);
    expect(finalResult.totalIterations).toBe(2);
    expect(finalResult.cancelled).toBe(false);

    // Verify sleep was called between cycles
    expect(mockSleep).toHaveBeenCalledTimes(1); // Only between iteration 0 and 1
    expect(mockSleep).toHaveBeenCalledWith('1h', expect.objectContaining({
      reason: expect.stringContaining('lifecycle-test'),
    }));
  });

  it('schedule can be restarted after completion', async () => {
    const task = vi.fn().mockResolvedValue('ok');

    const schedule = createScheduledWorkflow({
      name: 'restart',
      interval: '1m',
      task,
      maxIterations: 1,
    });

    await schedule.start();
    expect(schedule.completedIterations).toBe(1);

    // Should be able to start again
    await schedule.start();
    expect(task).toHaveBeenCalledTimes(2);
  });
});
