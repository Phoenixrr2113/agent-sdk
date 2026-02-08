/**
 * @agent/sdk-server - Concurrency Queue
 *
 * Limits concurrent agent executions to prevent resource exhaustion.
 * Requests that exceed the limit are queued with configurable timeout.
 */

import { createLogger } from '@agent/logger';

const log = createLogger('@agent/sdk-server:queue');

/**
 * Configuration for the concurrency queue.
 */
export interface QueueConfig {
  /** Maximum concurrent agent executions. Default: 5 */
  maxConcurrent?: number;

  /** Maximum queue size. Requests beyond are rejected with 503. Default: 50 */
  maxQueueSize?: number;

  /** Timeout (ms) for queued requests. Default: 60000 (60s) */
  queueTimeout?: number;
}

interface QueuedRequest {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  enqueuedAt: number;
}

/**
 * Concurrency queue for limiting simultaneous agent executions.
 */
export class ConcurrencyQueue {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private readonly queueTimeout: number;
  private active = 0;
  private queue: QueuedRequest[] = [];

  constructor(config: QueueConfig = {}) {
    this.maxConcurrent = config.maxConcurrent ?? 5;
    this.maxQueueSize = config.maxQueueSize ?? 50;
    this.queueTimeout = config.queueTimeout ?? 60000;

    log.info('Concurrency queue initialized', {
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
      queueTimeout: this.queueTimeout,
    });
  }

  /**
   * Acquire a slot. Resolves when a slot is available.
   * Rejects with QueueFullError if queue is full, or QueueTimeoutError on timeout.
   */
  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      log.debug('Slot acquired immediately', { active: this.active, queued: this.queue.length });
      return;
    }

    if (this.queue.length >= this.maxQueueSize) {
      log.warn('Queue full, rejecting request', {
        active: this.active,
        queued: this.queue.length,
        maxQueueSize: this.maxQueueSize,
      });
      throw new QueueFullError(this.maxQueueSize);
    }

    return new Promise<void>((resolve, reject) => {
      const item: QueuedRequest = {
        resolve: () => {
          clearTimeout(item.timer);
          this.active++;
          resolve();
        },
        reject,
        timer: null as unknown as ReturnType<typeof setTimeout>,
        enqueuedAt: Date.now(),
      };

      item.timer = setTimeout(() => {
        const idx = this.queue.indexOf(item);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
          log.warn('Queue timeout', { waited: this.queueTimeout });
          reject(new QueueTimeoutError(this.queueTimeout));
        }
      }, this.queueTimeout);

      this.queue.push(item);

      log.debug('Request queued', { active: this.active, queued: this.queue.length });
    });
  }

  /**
   * Release a slot. Processes the next queued request if any.
   */
  release(): void {
    this.active--;

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      const waitTime = Date.now() - next.enqueuedAt;
      log.debug('Processing queued request', { waitTime, remaining: this.queue.length });
      next.resolve();
    } else {
      log.debug('Slot released', { active: this.active });
    }
  }

  /**
   * Get current queue statistics.
   */
  getStats(): QueueStats {
    return {
      active: this.active,
      queued: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      maxQueueSize: this.maxQueueSize,
      available: Math.max(0, this.maxConcurrent - this.active),
    };
  }

  /**
   * Drain the queue (reject all pending requests).
   */
  drain(): void {
    for (const req of this.queue) {
      clearTimeout(req.timer);
      req.reject(new Error('Queue drained'));
    }
    this.queue = [];
    log.info('Queue drained');
  }
}

/**
 * Queue statistics.
 */
export interface QueueStats {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueueSize: number;
  available: number;
}

/**
 * Error thrown when the queue is full.
 */
export class QueueFullError extends Error {
  readonly code = 'QUEUE_FULL';
  readonly statusCode = 503;

  constructor(maxSize: number) {
    super(`Queue is full (max ${maxSize}). Try again later.`);
    this.name = 'QueueFullError';
  }
}

/**
 * Error thrown when a queued request times out.
 */
export class QueueTimeoutError extends Error {
  readonly code = 'QUEUE_TIMEOUT';
  readonly statusCode = 408;

  constructor(timeoutMs: number) {
    super(`Queue timeout after ${timeoutMs}ms. Try again later.`);
    this.name = 'QueueTimeoutError';
  }
}
