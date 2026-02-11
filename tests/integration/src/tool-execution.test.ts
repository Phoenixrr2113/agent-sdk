/**
 * @fileoverview Integration tests for agent tool execution.
 * Tests the full tool loop: model calls tool → tool executes → model gets result → final response.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tool } from 'ai';
import { createAgent } from '@agntk/core';
import { createMockModel, createMockToolModel } from './setup';

describe('Tool Execution', () => {
  describe('single tool call', () => {
    it('should execute a custom tool and return the final response', async () => {
      const model = createMockToolModel(
        [{ id: 'call-1', name: 'get_weather', args: { city: 'London' } }],
        'The weather in London is sunny and 22°C.',
      );

      const weatherTool = tool({
        description: 'Get the current weather for a city',
        parameters: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ city, temperature: 22, condition: 'sunny' }),
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { get_weather: weatherTool },
        maxSteps: 3,
      });

      const result = await agent.generate({ prompt: 'What is the weather in London?' });

      expect(result.text).toBe('The weather in London is sunny and 22°C.');
      expect(result.steps.length).toBeGreaterThanOrEqual(2);
    });

    it('should track tool call results in steps', async () => {
      const model = createMockToolModel(
        [{ id: 'call-1', name: 'calculator', args: { a: 5, b: 3 } }],
        'The result is 8.',
      );

      const calcTool = tool({
        description: 'Add two numbers',
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: async ({ a, b }) => ({ sum: a + b }),
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { calculator: calcTool },
        maxSteps: 3,
      });

      const result = await agent.generate({ prompt: 'Add 5 and 3' });

      expect(result.text).toBe('The result is 8.');
      // The first step should contain tool calls
      const firstStep = result.steps[0];
      expect(firstStep.toolCalls).toBeDefined();
      expect(firstStep.toolCalls.length).toBeGreaterThan(0);
      expect(firstStep.toolCalls[0].toolName).toBe('calculator');
    });
  });

  describe('tool error handling', () => {
    it('should handle tool execution errors gracefully', async () => {
      const model = createMockToolModel(
        [{ id: 'call-1', name: 'failing_tool', args: {} }],
        'The tool encountered an error, but I can still respond.',
      );

      const failingTool = tool({
        description: 'A tool that always fails',
        parameters: z.object({}),
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { failing_tool: failingTool },
        maxSteps: 3,
      });

      const result = await agent.generate({ prompt: 'Use the failing tool' });
      expect(result).toBeDefined();
    });
  });

  describe('tool with complex schemas', () => {
    it('should handle tools with nested object schemas', async () => {
      const model = createMockToolModel(
        [{ id: 'call-1', name: 'create_user', args: { name: 'John', age: 30 } }],
        'User John created successfully.',
      );

      const createUserTool = tool({
        description: 'Create a user',
        parameters: z.object({
          name: z.string(),
          age: z.number(),
        }),
        execute: async ({ name, age }) => ({ id: 'user-1', name, age, created: true }),
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { create_user: createUserTool },
        maxSteps: 3,
      });

      const result = await agent.generate({ prompt: 'Create user John, age 30' });
      expect(result.text).toContain('John');
    });
  });

  describe('no tool calls', () => {
    it('should handle model that responds without tool calls', async () => {
      const model = createMockModel('Direct response without any tools.');

      const someTool = tool({
        description: 'A tool that exists but is not called',
        parameters: z.object({ input: z.string() }),
        execute: async ({ input }) => ({ output: input }),
      });

      const agent = createAgent({
        model,
        toolPreset: 'none',
        tools: { some_tool: someTool },
        maxSteps: 3,
      });

      const result = await agent.generate({ prompt: 'Just respond without tools' });
      expect(result.text).toBe('Direct response without any tools.');
      expect(result.steps).toHaveLength(1);
    });
  });
});
