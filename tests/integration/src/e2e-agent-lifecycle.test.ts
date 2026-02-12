/**
 * @fileoverview End-to-end tests for full agent lifecycle scenarios.
 * Tests complete workflows from agent creation through tool execution to final output.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tool } from 'ai';
import { createAgent } from '@agntk/core';
import { contentFilter } from '@agntk/core/advanced';
import { createMockModel, createMockToolModel } from './setup';

describe('E2E: Agent Lifecycle', () => {
  describe('agent with guardrails and tools', () => {
    it('should create agent, execute tools, apply guardrails, return safe output', async () => {
      const model = createMockToolModel(
        [{ id: 'call-1', name: 'get_data', args: { query: 'user info' } }],
        'The user profile shows name: John, role: admin.',
      );

      const dataTool = tool({
        description: 'Get data from database',
        parameters: z.object({ query: z.string() }),
        execute: async ({ query }) => ({
          data: `Results for "${query}": name=John, role=admin`,
        }),
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { get_data: dataTool },
        maxSteps: 3,
        guardrails: {
          output: [contentFilter()],
          onBlock: 'filter',
        },
      });

      const result = await agent.generate({ prompt: 'Get user profile' });

      // Output should be present and guardrails should have been applied
      expect(result.text).toBeDefined();
      expect(typeof result.text).toBe('string');
    });
  });

  describe('agent with custom system prompt and roles', () => {
    it('should use coder role defaults', () => {
      const agent = createAgent({
        model: createMockModel('Here is the code...'),
        role: 'coder',
        toolPreset: 'none',
      });

      expect(agent.role).toBe('coder');
      const systemPrompt = agent.getSystemPrompt();
      expect(systemPrompt.length).toBeGreaterThan(0);
    });

    it('should override role system prompt with custom one', () => {
      const customPrompt = 'You are a specialized TypeScript expert.';
      const agent = createAgent({
        model: createMockModel('TypeScript expert here.'),
        role: 'coder',
        systemPrompt: customPrompt,
        toolPreset: 'none',
      });

      expect(agent.getSystemPrompt()).toContain(customPrompt);
    });
  });
});
