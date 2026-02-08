/**
 * @fileoverview Tests for the ConcurrencyQueue.
 */

import { describe, it, expect } from 'vitest';
import { ConcurrencyQueue, QueueFullError, QueueTimeoutError } from '../queue';

describe('ConcurrencyQueue', () => {
  it('creates with default config', () => {
    const queue = new ConcurrencyQueue();
    const stats = queue.getStats();
    expect(stats.maxConcurrent).toBe(5);
    expect(stats.maxQueueSize).toBe(50);
    expect(stats.active).toBe(0);
    expect(stats.queued).toBe(0);
    expect(stats.available).toBe(5);
  });

  it('creates with custom config', () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 2, maxQueueSize: 10, queueTimeout: 5000 });
    const stats = queue.getStats();
    expect(stats.maxConcurrent).toBe(2);
    expect(stats.maxQueueSize).toBe(10);
  });

  it('acquires and releases slots', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 2 });

    await queue.acquire();
    expect(queue.getStats().active).toBe(1);

    await queue.acquire();
    expect(queue.getStats().active).toBe(2);
    expect(queue.getStats().available).toBe(0);

    queue.release();
    expect(queue.getStats().active).toBe(1);
    expect(queue.getStats().available).toBe(1);

    queue.release();
    expect(queue.getStats().active).toBe(0);
  });

  it('queues requests when at capacity', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 1 });

    await queue.acquire(); // Takes the only slot
    expect(queue.getStats().active).toBe(1);

    // This should queue
    const pending = queue.acquire();
    expect(queue.getStats().queued).toBe(1);

    // Release the first slot — should resolve the queued request
    queue.release();
    await pending;
    expect(queue.getStats().active).toBe(1);
    expect(queue.getStats().queued).toBe(0);

    queue.release();
  });

  it('throws QueueFullError when queue is full', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 1, maxQueueSize: 1 });

    await queue.acquire(); // Takes the slot

    // Queue one request
    const pending = queue.acquire(); // Goes to queue (queue size = 1)

    // This should throw QueueFullError
    await expect(queue.acquire()).rejects.toThrow(QueueFullError);
    await expect(queue.acquire()).rejects.toThrow('Queue is full');

    // Clean up
    queue.release();
    await pending;
    queue.release();
  });

  it('throws QueueTimeoutError after timeout', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 1, queueTimeout: 100 });

    await queue.acquire(); // Takes the slot

    // This should timeout because we never release
    let caught: unknown;
    try {
      await queue.acquire();
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(QueueTimeoutError);
    expect((caught as QueueTimeoutError).code).toBe('QUEUE_TIMEOUT');

    queue.release();
  }, 15000);

  it('drains all pending requests', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 1 });

    await queue.acquire();

    const p1 = queue.acquire().catch(e => e);
    const p2 = queue.acquire().catch(e => e);

    expect(queue.getStats().queued).toBe(2);

    queue.drain();

    const e1 = await p1;
    const e2 = await p2;

    expect(e1).toBeInstanceOf(Error);
    expect(e2).toBeInstanceOf(Error);
    expect(queue.getStats().queued).toBe(0);

    queue.release();
  });

  it('processes requests in FIFO order', async () => {
    const queue = new ConcurrencyQueue({ maxConcurrent: 1 });
    const order: number[] = [];

    await queue.acquire();

    // Queue 3 requests
    const p1 = queue.acquire().then(() => { order.push(1); });
    const p2 = queue.acquire().then(() => { order.push(2); });
    const p3 = queue.acquire().then(() => { order.push(3); });

    // Release one at a time
    queue.release();
    await p1;
    queue.release();
    await p2;
    queue.release();
    await p3;
    queue.release();

    expect(order).toEqual([1, 2, 3]);
  });
});

describe('QueueFullError', () => {
  it('has correct properties', () => {
    const error = new QueueFullError(5);
    expect(error.code).toBe('QUEUE_FULL');
    expect(error.statusCode).toBe(503);
    expect(error.message).toContain('5');
    expect(error.name).toBe('QueueFullError');
  });
});

describe('QueueTimeoutError', () => {
  it('has correct properties', () => {
    const error = new QueueTimeoutError(30000);
    expect(error.code).toBe('QUEUE_TIMEOUT');
    expect(error.statusCode).toBe(408);
    expect(error.message).toContain('30000');
    expect(error.name).toBe('QueueTimeoutError');
  });
});
