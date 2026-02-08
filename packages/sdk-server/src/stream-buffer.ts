/**
 * @agent/sdk-server - Stream Event Buffer
 *
 * In-memory buffer for SSE events keyed by workflow run ID.
 * Enables resumable streams — clients can reconnect and replay
 * from the last event they received.
 */

import { createLogger } from '@agent/logger';

const log = createLogger('@agent/sdk-server:stream-buffer');

export interface BufferedEvent {
  id: string;
  event: string;
  data: string;
  timestamp: number;
}

export interface StreamBufferOptions {
  /** Time-to-live for buffered runs in ms. Default: 5 minutes. */
  ttlMs?: number;

  /** Max events per run. Default: 10000. */
  maxEventsPerRun?: number;

  /** Cleanup interval in ms. Default: 60 seconds. */
  cleanupIntervalMs?: number;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAX_EVENTS = 10_000;
const DEFAULT_CLEANUP_INTERVAL_MS = 60 * 1000;

interface RunBuffer {
  events: BufferedEvent[];
  createdAt: number;
  lastActivityAt: number;
  completed: boolean;
}

export class StreamEventBuffer {
  private buffers = new Map<string, RunBuffer>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private readonly ttlMs: number;
  private readonly maxEventsPerRun: number;

  constructor(options: StreamBufferOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.maxEventsPerRun = options.maxEventsPerRun ?? DEFAULT_MAX_EVENTS;

    const cleanupInterval = options.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS;
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), cleanupInterval);

    // Prevent timer from blocking process shutdown
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }

    log.debug('StreamEventBuffer created', {
      ttlMs: this.ttlMs,
      maxEventsPerRun: this.maxEventsPerRun,
      cleanupIntervalMs: cleanupInterval,
    });
  }

  /**
   * Store an event for a workflow run.
   * Returns the assigned event ID.
   */
  store(runId: string, event: string, data: string): string {
    let buffer = this.buffers.get(runId);
    if (!buffer) {
      buffer = {
        events: [],
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        completed: false,
      };
      this.buffers.set(runId, buffer);
      log.debug('Created new run buffer', { runId });
    }

    // Enforce max events limit
    if (buffer.events.length >= this.maxEventsPerRun) {
      log.warn('Max events reached for run, dropping oldest', {
        runId,
        max: this.maxEventsPerRun,
      });
      buffer.events.shift();
    }

    const id = `${runId}:${buffer.events.length}`;
    buffer.events.push({ id, event, data, timestamp: Date.now() });
    buffer.lastActivityAt = Date.now();

    return id;
  }

  /**
   * Get all events after a given event ID.
   * Used for stream replay on reconnection.
   */
  getEventsAfter(runId: string, lastEventId: string): BufferedEvent[] {
    const buffer = this.buffers.get(runId);
    if (!buffer) {
      log.debug('No buffer found for run', { runId });
      return [];
    }

    const idx = buffer.events.findIndex(e => e.id === lastEventId);
    if (idx === -1) {
      // If the lastEventId isn't found, replay all events
      log.debug('lastEventId not found, replaying all', { runId, lastEventId });
      return [...buffer.events];
    }

    // Return events after the given ID
    return buffer.events.slice(idx + 1);
  }

  /**
   * Get all events for a run (used when reconnecting without a last-event-id).
   */
  getAllEvents(runId: string): BufferedEvent[] {
    const buffer = this.buffers.get(runId);
    return buffer ? [...buffer.events] : [];
  }

  /**
   * Mark a run as completed (stream finished normally).
   */
  markCompleted(runId: string): void {
    const buffer = this.buffers.get(runId);
    if (buffer) {
      buffer.completed = true;
      buffer.lastActivityAt = Date.now();
      log.debug('Run marked completed', { runId, eventCount: buffer.events.length });
    }
  }

  /**
   * Check if a run exists in the buffer.
   */
  has(runId: string): boolean {
    return this.buffers.has(runId);
  }

  /**
   * Check if a run is completed.
   */
  isCompleted(runId: string): boolean {
    return this.buffers.get(runId)?.completed ?? false;
  }

  /**
   * Remove a run from the buffer.
   */
  remove(runId: string): void {
    this.buffers.delete(runId);
    log.debug('Run buffer removed', { runId });
  }

  /**
   * Clean up expired run buffers.
   */
  cleanupExpired(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [runId, buffer] of this.buffers) {
      if (now - buffer.lastActivityAt > this.ttlMs) {
        this.buffers.delete(runId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      log.debug('Cleaned up expired run buffers', { cleaned, remaining: this.buffers.size });
    }

    return cleaned;
  }

  /**
   * Get buffer stats.
   */
  getStats(): { activeRuns: number; totalEvents: number } {
    let totalEvents = 0;
    for (const buffer of this.buffers.values()) {
      totalEvents += buffer.events.length;
    }
    return { activeRuns: this.buffers.size, totalEvents };
  }

  /**
   * Dispose of the buffer and clear cleanup timer.
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.buffers.clear();
    log.debug('StreamEventBuffer disposed');
  }
}
