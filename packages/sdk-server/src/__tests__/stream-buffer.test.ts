/**
 * @agent/sdk-server - StreamEventBuffer Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StreamEventBuffer } from '../stream-buffer';

describe('StreamEventBuffer', () => {
  let buffer: StreamEventBuffer;

  beforeEach(() => {
    buffer = new StreamEventBuffer({
      ttlMs: 5000,
      maxEventsPerRun: 100,
      cleanupIntervalMs: 60000,
    });
  });

  afterEach(() => {
    buffer.dispose();
  });

  describe('store', () => {
    it('should store events and return event IDs', () => {
      const id1 = buffer.store('run-1', 'text-delta', '{"textDelta":"Hello"}');
      const id2 = buffer.store('run-1', 'text-delta', '{"textDelta":" World"}');

      expect(id1).toBe('run-1:0');
      expect(id2).toBe('run-1:1');
    });

    it('should store events for multiple runs independently', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      buffer.store('run-2', 'text-delta', '{"textDelta":"B"}');

      expect(buffer.getAllEvents('run-1')).toHaveLength(1);
      expect(buffer.getAllEvents('run-2')).toHaveLength(1);
    });

    it('should drop oldest event when max events reached', () => {
      const smallBuffer = new StreamEventBuffer({
        ttlMs: 5000,
        maxEventsPerRun: 3,
        cleanupIntervalMs: 60000,
      });

      smallBuffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      smallBuffer.store('run-1', 'text-delta', '{"textDelta":"B"}');
      smallBuffer.store('run-1', 'text-delta', '{"textDelta":"C"}');
      smallBuffer.store('run-1', 'text-delta', '{"textDelta":"D"}');

      const events = smallBuffer.getAllEvents('run-1');
      expect(events).toHaveLength(3);
      expect(events[0].data).toBe('{"textDelta":"B"}');

      smallBuffer.dispose();
    });
  });

  describe('getEventsAfter', () => {
    it('should return events after a given event ID', () => {
      const id1 = buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      buffer.store('run-1', 'text-delta', '{"textDelta":"B"}');
      buffer.store('run-1', 'text-delta', '{"textDelta":"C"}');

      const events = buffer.getEventsAfter('run-1', id1);
      expect(events).toHaveLength(2);
      expect(events[0].data).toBe('{"textDelta":"B"}');
      expect(events[1].data).toBe('{"textDelta":"C"}');
    });

    it('should return all events if lastEventId not found', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      buffer.store('run-1', 'text-delta', '{"textDelta":"B"}');

      const events = buffer.getEventsAfter('run-1', 'nonexistent');
      expect(events).toHaveLength(2);
    });

    it('should return empty array if run not found', () => {
      const events = buffer.getEventsAfter('nonexistent', 'some-id');
      expect(events).toHaveLength(0);
    });

    it('should return empty array if lastEventId is the last event', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      const lastId = buffer.store('run-1', 'text-delta', '{"textDelta":"B"}');

      const events = buffer.getEventsAfter('run-1', lastId);
      expect(events).toHaveLength(0);
    });
  });

  describe('getAllEvents', () => {
    it('should return all events for a run', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      buffer.store('run-1', 'text-delta', '{"textDelta":"B"}');

      const events = buffer.getAllEvents('run-1');
      expect(events).toHaveLength(2);
    });

    it('should return empty array for unknown run', () => {
      expect(buffer.getAllEvents('unknown')).toHaveLength(0);
    });

    it('should return a copy (not reference)', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');

      const events1 = buffer.getAllEvents('run-1');
      const events2 = buffer.getAllEvents('run-1');

      expect(events1).not.toBe(events2);
      expect(events1).toEqual(events2);
    });
  });

  describe('markCompleted', () => {
    it('should mark a run as completed', () => {
      buffer.store('run-1', 'done', '{}');
      expect(buffer.isCompleted('run-1')).toBe(false);

      buffer.markCompleted('run-1');
      expect(buffer.isCompleted('run-1')).toBe(true);
    });

    it('should return false for unknown run', () => {
      expect(buffer.isCompleted('unknown')).toBe(false);
    });
  });

  describe('has', () => {
    it('should return true for existing runs', () => {
      buffer.store('run-1', 'text-delta', '{}');
      expect(buffer.has('run-1')).toBe(true);
    });

    it('should return false for non-existing runs', () => {
      expect(buffer.has('run-1')).toBe(false);
    });
  });

  describe('remove', () => {
    it('should remove a run buffer', () => {
      buffer.store('run-1', 'text-delta', '{}');
      expect(buffer.has('run-1')).toBe(true);

      buffer.remove('run-1');
      expect(buffer.has('run-1')).toBe(false);
    });
  });

  describe('cleanupExpired', () => {
    it('should clean up expired runs', () => {
      vi.useFakeTimers();

      const shortTTLBuffer = new StreamEventBuffer({
        ttlMs: 1000,
        cleanupIntervalMs: 600000,
      });

      shortTTLBuffer.store('run-1', 'text-delta', '{}');
      expect(shortTTLBuffer.has('run-1')).toBe(true);

      vi.advanceTimersByTime(2000);
      const cleaned = shortTTLBuffer.cleanupExpired();
      expect(cleaned).toBe(1);
      expect(shortTTLBuffer.has('run-1')).toBe(false);

      shortTTLBuffer.dispose();
      vi.useRealTimers();
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      buffer.store('run-1', 'text-delta', '{"textDelta":"A"}');
      buffer.store('run-1', 'text-delta', '{"textDelta":"B"}');
      buffer.store('run-2', 'text-delta', '{"textDelta":"C"}');

      const stats = buffer.getStats();
      expect(stats.activeRuns).toBe(2);
      expect(stats.totalEvents).toBe(3);
    });
  });

  describe('dispose', () => {
    it('should clear all buffers', () => {
      buffer.store('run-1', 'text-delta', '{}');
      buffer.dispose();

      expect(buffer.getStats().activeRuns).toBe(0);
    });
  });
});
