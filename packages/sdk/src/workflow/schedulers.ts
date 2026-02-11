/**
 * @agntk/core - Scheduled Workflows
 *
 * Implements recurring task execution using Workflow DevKit's `sleep()`.
 * Each scheduled workflow is a durable loop: execute → sleep → repeat.
 * Zero compute cost during sleep — the workflow runtime suspends the process.
 *
 * @see ADV-SCHEDULER-018
 * @see https://useworkflow.dev
 */

import { createLogger } from '@agntk/logger';
import { sleep } from './hooks';
import { parseDuration, formatDuration } from './durable-agent';

const log = createLogger('@agntk/core:workflow:scheduler');

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for a scheduled workflow.
 *
 * @typeParam T - The return type of the task function
 */
export interface ScheduledWorkflowConfig<T = void> {
  /** Human-readable name for this schedule. */
  name: string;

  /** Description of what the scheduled task does. */
  description?: string;

  /**
   * Interval between executions.
   * Duration string (e.g., "1h", "1d", "7d").
   */
  interval: string;

  /**
   * The task to execute on each tick.
   * Receives the current iteration number (0-indexed) and returns a result.
   */
  task: (iteration: number) => Promise<T> | T;

  /**
   * Maximum number of iterations before the workflow stops.
   * Omit or set to `Infinity` for an infinite loop.
   * @default Infinity
   */
  maxIterations?: number;

  /**
   * Whether to run the task immediately on start, or wait for the first interval.
   * @default true
   */
  immediate?: boolean;

  /**
   * Called after each successful task execution.
   */
  onTick?: (result: T, iteration: number) => void | Promise<void>;

  /**
   * Called when a task execution throws an error.
   * Return `true` to continue the schedule despite the error (default).
   * Return `false` to stop the schedule.
   * @default continue
   */
  onError?: (error: Error, iteration: number) => boolean | Promise<boolean>;
}

/**
 * A running scheduled workflow instance.
 *
 * @typeParam T - The return type of the task function
 */
export interface ScheduledWorkflow<T = void> {
  /** The schedule configuration name. */
  readonly name: string;

  /** The schedule configuration description. */
  readonly description?: string;

  /** The interval between executions. */
  readonly interval: string;

  /**
   * Start the schedule loop. Returns a promise that resolves
   * when the schedule completes (hits maxIterations or is cancelled).
   */
  start: () => Promise<ScheduleResult<T>>;

  /**
   * Cancel the schedule. The current sleep will be interrupted,
   * and the loop will exit after the current tick completes.
   */
  cancel: () => void;

  /** Whether the schedule is currently running. */
  readonly isRunning: boolean;

  /** Number of completed iterations. */
  readonly completedIterations: number;

  /** Results from completed iterations. */
  readonly results: ScheduleTickResult<T>[];
}

/**
 * Result from a single scheduled tick.
 */
export interface ScheduleTickResult<T = void> {
  /** 0-indexed iteration number. */
  iteration: number;

  /** Whether the tick succeeded. */
  success: boolean;

  /** The result value (if success). */
  result?: T;

  /** The error message (if failed). */
  error?: string;

  /** Timestamp when the tick completed. */
  completedAt: Date;
}

/**
 * Final result from a completed schedule.
 */
export interface ScheduleResult<T = void> {
  /** Schedule name. */
  name: string;

  /** Total completed iterations. */
  totalIterations: number;

  /** Whether the schedule was cancelled. */
  cancelled: boolean;

  /** All tick results. */
  ticks: ScheduleTickResult<T>[];
}

// ============================================================================
// Scheduled Workflow Factory
// ============================================================================

/**
 * Create a scheduled workflow that loops with durable sleep.
 *
 * The workflow executes a task, sleeps for the configured interval,
 * and repeats. Under the Workflow runtime, sleep is zero-compute.
 *
 * @param config - Schedule configuration
 * @returns A `ScheduledWorkflow` instance (call `.start()` to begin)
 *
 * @example
 * ```typescript
 * const daily = createScheduledWorkflow({
 *   name: 'daily-briefing',
 *   interval: '1d',
 *   task: async (iteration) => {
 *     const agent = createAgent({ role: 'analyst' });
 *     const result = await agent.generate({
 *       prompt: 'Generate a daily briefing summary.',
 *     });
 *     return result.text;
 *   },
 *   onTick: (text, i) => console.log(`Briefing #${i}:`, text),
 * });
 *
 * await daily.start(); // Loops forever with 1d sleep between ticks
 * ```
 */
export function createScheduledWorkflow<T = void>(
  config: ScheduledWorkflowConfig<T>,
): ScheduledWorkflow<T> {
  const {
    name,
    description,
    interval,
    task,
    maxIterations = Infinity,
    immediate = true,
    onTick,
    onError,
  } = config;

  // Validate interval eagerly
  const intervalMs = parseDuration(interval);

  let _running = false;
  let _cancelled = false;
  let _iteration = 0;
  const _results: ScheduleTickResult<T>[] = [];

  log.info('Scheduled workflow created', {
    name,
    interval,
    intervalMs,
    maxIterations: maxIterations === Infinity ? 'infinite' : maxIterations,
    immediate,
  });

  async function executeTick(iteration: number): Promise<ScheduleTickResult<T>> {
    log.debug('Executing tick', { name, iteration });

    try {
      const result = await task(iteration);

      const tickResult: ScheduleTickResult<T> = {
        iteration,
        success: true,
        result,
        completedAt: new Date(),
      };

      if (onTick) {
        await onTick(result, iteration);
      }

      log.info('Tick completed', { name, iteration });
      return tickResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error('Tick failed', { name, iteration, error: error.message });

      const tickResult: ScheduleTickResult<T> = {
        iteration,
        success: false,
        error: error.message,
        completedAt: new Date(),
      };

      if (onError) {
        const shouldContinue = await onError(error, iteration);
        if (!shouldContinue) {
          log.info('onError returned false — stopping schedule', { name });
          _cancelled = true;
        }
      }

      return tickResult;
    }
  }

  async function start(): Promise<ScheduleResult<T>> {
    if (_running) {
      throw new Error(`Schedule "${name}" is already running`);
    }

    _running = true;
    _cancelled = false;
    _iteration = 0;
    _results.length = 0;

    log.info('Schedule started', { name, interval, maxIterations: maxIterations === Infinity ? 'infinite' : maxIterations });

    try {
      while (_iteration < maxIterations && !_cancelled) {
        // Sleep before first tick if not immediate
        if (_iteration === 0 && !immediate) {
          log.debug('Waiting for first interval before executing', { name, interval });
          await sleep(interval, { reason: `${name}: waiting for first interval` });

          if (_cancelled) break;
        }

        // Execute the tick
        const tickResult = await executeTick(_iteration);
        _results.push(tickResult);
        _iteration++;

        if (_cancelled) break;

        // Sleep between iterations (skip after last)
        if (_iteration < maxIterations) {
          log.debug('Sleeping between ticks', {
            name,
            iteration: _iteration,
            interval,
            intervalMs,
          });

          await sleep(interval, {
            reason: `${name}: interval sleep (iteration ${_iteration})`,
          });
        }
      }
    } finally {
      _running = false;
    }

    const result: ScheduleResult<T> = {
      name,
      totalIterations: _results.length,
      cancelled: _cancelled,
      ticks: [..._results],
    };

    log.info('Schedule completed', {
      name,
      totalIterations: result.totalIterations,
      cancelled: result.cancelled,
    });

    return result;
  }

  function cancel(): void {
    if (!_running) {
      log.warn('cancel() called but schedule is not running', { name });
      return;
    }

    log.info('Schedule cancelled', { name, iteration: _iteration });
    _cancelled = true;
  }

  return {
    name,
    description,
    interval,
    start,
    cancel,

    get isRunning() {
      return _running;
    },

    get completedIterations() {
      return _results.length;
    },

    get results() {
      return [..._results];
    },
  };
}

// ============================================================================
// Example Presets
// ============================================================================

/**
 * Options for the daily briefing schedule preset.
 */
export interface DailyBriefingOptions {
  /**
   * The task that generates the briefing content.
   * Receives the iteration number.
   */
  generateBriefing: (iteration: number) => Promise<string>;

  /**
   * Called with each briefing (e.g., send email, post to Slack).
   */
  deliver: (briefing: string, iteration: number) => void | Promise<void>;

  /**
   * Override the default interval. Default: "1d"
   */
  interval?: string;

  /**
   * Maximum number of briefings. Default: Infinity
   */
  maxIterations?: number;
}

/**
 * Create a daily briefing scheduled workflow.
 *
 * Runs a briefing generation task once per day (configurable),
 * delivering the result via a callback.
 *
 * @example
 * ```typescript
 * const briefing = createDailyBriefing({
 *   generateBriefing: async () => {
 *     const agent = createAgent({ role: 'analyst' });
 *     const result = await agent.generate({
 *       prompt: 'Summarize today\'s calendar, emails, and tasks.',
 *     });
 *     return result.text;
 *   },
 *   deliver: (text) => sendSlackMessage('#daily', text),
 * });
 *
 * await briefing.start();
 * ```
 */
export function createDailyBriefing(
  options: DailyBriefingOptions,
): ScheduledWorkflow<string> {
  const {
    generateBriefing,
    deliver,
    interval = '1d',
    maxIterations,
  } = options;

  return createScheduledWorkflow<string>({
    name: 'daily-briefing',
    description: 'Generate and deliver a daily briefing summary',
    interval,
    maxIterations,
    task: generateBriefing,
    onTick: deliver,
    onError: async (error, iteration) => {
      log.error('Daily briefing failed', { iteration, error: error.message });
      return true; // Continue schedule despite error
    },
  });
}

/**
 * Options for the weekly report schedule preset.
 */
export interface WeeklyReportOptions {
  /**
   * The task that generates the weekly report.
   * Receives the iteration (week) number.
   */
  generateReport: (week: number) => Promise<string>;

  /**
   * Called with each report (e.g., send email, save to file).
   */
  deliver: (report: string, week: number) => void | Promise<void>;

  /**
   * Override the default interval. Default: "7d"
   */
  interval?: string;

  /**
   * Maximum number of reports. Default: Infinity
   */
  maxIterations?: number;
}

/**
 * Create a weekly report scheduled workflow.
 *
 * Runs a report generation task once per week (configurable),
 * delivering the result via a callback.
 *
 * @example
 * ```typescript
 * const report = createWeeklyReport({
 *   generateReport: async (week) => {
 *     const agent = createAgent({ role: 'analyst' });
 *     const result = await agent.generate({
 *       prompt: `Generate weekly report #${week + 1}.`,
 *     });
 *     return result.text;
 *   },
 *   deliver: (text) => sendEmail('team@company.com', 'Weekly Report', text),
 * });
 *
 * await report.start();
 * ```
 */
export function createWeeklyReport(
  options: WeeklyReportOptions,
): ScheduledWorkflow<string> {
  const {
    generateReport,
    deliver,
    interval = '7d',
    maxIterations,
  } = options;

  return createScheduledWorkflow<string>({
    name: 'weekly-report',
    description: 'Generate and deliver a weekly report',
    interval,
    maxIterations,
    task: generateReport,
    onTick: deliver,
    onError: async (error, iteration) => {
      log.error('Weekly report failed', { week: iteration, error: error.message });
      return true; // Continue schedule despite error
    },
  });
}

// Re-export used helpers for convenience
export { parseDuration, formatDuration };
