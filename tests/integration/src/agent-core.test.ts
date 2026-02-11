/**
 * @fileoverview Integration tests for core agent functionality.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { createAgent } from '@agntk/core';
import { createMockModel, createMockStreamModel } from './setup';

describe('Agent Core', () => {
  describe('createAgent + generate', () => {
    it('should create an agent and generate a text response', async () => {
      const agent = createAgent({
        model: createMockModel('Hello from the agent!'),
        systemPrompt: 'You are a helpful assistant.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const result = await agent.generate({ prompt: 'Say hello' });

      expect(result.text).toBe('Hello from the agent!');
      expect(result.steps).toBeDefined();
      expect(Array.isArray(result.steps)).toBe(true);
    });

    it('should respect custom systemPrompt', async () => {
      const customPrompt = 'You are a pirate assistant. Always say arrr.';
      const agent = createAgent({
        model: createMockModel('Arrr, hello matey!'),
        systemPrompt: customPrompt,
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(agent.getSystemPrompt()).toContain(customPrompt);


      const result = await agent.generate({ prompt: 'Greet me' });
      expect(result.text).toBe('Arrr, hello matey!');
    });

    it('should have a unique agentId', () => {
      const agent1 = createAgent({
        model: createMockModel('a'),
        toolPreset: 'none',
      });
      const agent2 = createAgent({
        model: createMockModel('b'),
        toolPreset: 'none',
      });

      expect(agent1.agentId).toBeDefined();
      expect(agent2.agentId).toBeDefined();
      expect(agent1.agentId).not.toBe(agent2.agentId);
    });

    it('should accept a custom agentId', () => {
      const agent = createAgent({
        model: createMockModel('test'),
        agentId: 'custom-id-123',
        toolPreset: 'none',
      });

      expect(agent.agentId).toBe('custom-id-123');
    });

    it('should default role to generic', () => {
      const agent = createAgent({
        model: createMockModel('test'),
        toolPreset: 'none',
      });

      expect(agent.role).toBe('generic');
    });
  });

  describe('createAgent + stream', () => {
    it('should return a stream result from the agent', async () => {
      const agent = createAgent({
        model: createMockStreamModel('Hello world from streaming'),
        systemPrompt: 'You are a helpful assistant.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      // Verify the stream method exists and returns a result
      expect(typeof agent.stream).toBe('function');
      const stream = agent.stream({ prompt: 'Say hello' });
      expect(stream).toBeDefined();
    });
  });
});
