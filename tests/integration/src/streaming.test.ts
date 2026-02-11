/**
 * @fileoverview Integration tests for agent streaming functionality.
 * Tests the stream() method with MockLanguageModelV3.
 * Uses ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@agntk/core';
import { createMockStreamModel, createMockModel } from './setup';

describe('Streaming', () => {
  describe('agent.stream()', () => {
    it('should return a stream result object', () => {
      const agent = createAgent({
        model: createMockStreamModel('Hello world from streaming agent'),
        systemPrompt: 'You are a helpful assistant.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const result = agent.stream({ prompt: 'Say hello' });
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should exist as a callable function on the agent', () => {
      const agent = createAgent({
        model: createMockStreamModel('Streaming test'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(typeof agent.stream).toBe('function');
    });
  });

  describe('agent.generate() vs stream()', () => {
    it('should return text content via generate', async () => {
      const agent = createAgent({
        model: createMockModel('Hello world'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      const result = await agent.generate({ prompt: 'Say hello' });
      expect(result.text).toBe('Hello world');
    });

    it('should expose both stream and generate on same agent', () => {
      const agent = createAgent({
        model: createMockStreamModel('Dual mode'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(typeof agent.stream).toBe('function');
      expect(typeof agent.generate).toBe('function');
    });

    it('should have getToolLoopAgent that returns the underlying agent', () => {
      const agent = createAgent({
        model: createMockStreamModel('Test'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      const tla = agent.getToolLoopAgent();
      expect(tla).toBeDefined();
      expect(typeof tla.stream).toBe('function');
      expect(typeof tla.generate).toBe('function');
    });
  });
});
