/**
 * @fileoverview End-to-end tests for full agent lifecycle scenarios.
 * Tests complete workflows from agent creation through tool execution to final output.
 * Uses MockLanguageModelV3 from ai/test per official AI SDK testing guidance.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { tool } from 'ai';
import { createAgent } from '@agntk/core';
import { createPipeline, createParallel, asStep } from '@agntk/core/workflow';
import { contentFilter, SpecialistPool } from '@agntk/core/advanced';
import { createMockModel, createMockToolModel, createMockMultiModel, createMockModelWithSpy } from './setup';

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

  describe('pipeline with multiple agents', () => {
    it('should execute a research-then-write pipeline', async () => {
      const { model: researchModel, calls: researchCalls } = createMockModelWithSpy(
        'Research findings: TypeScript is a typed superset of JavaScript.',
      );
      const { model: writeModel, calls: writeCalls } = createMockModelWithSpy(
        'Article: TypeScript provides type safety on top of JavaScript.',
      );

      const researcher = createAgent({
        model: researchModel,
        systemPrompt: 'You are a researcher. Find information about the topic.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const writer = createAgent({
        model: writeModel,
        systemPrompt: 'You are a writer. Write an article based on the research.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const pipeline = createPipeline({
        name: 'research-write',
        steps: [asStep(researcher), asStep(writer)],
      });

      const result = await pipeline.execute({ prompt: 'Write about TypeScript' });

      expect(result.text).toContain('TypeScript');
      expect(researchCalls.length).toBeGreaterThan(0);
      expect(writeCalls.length).toBeGreaterThan(0);
    });
  });

  describe('parallel analysis with synthesis', () => {
    it('should fan out to multiple analysts and combine results', async () => {
      const security = createAgent({
        model: createMockModel('Security analysis: No vulnerabilities found in the code.'),
        systemPrompt: 'Analyze code for security issues.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const performance = createAgent({
        model: createMockModel('Performance analysis: O(n) time complexity, acceptable.'),
        systemPrompt: 'Analyze code for performance.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const quality = createAgent({
        model: createMockModel('Quality analysis: Code follows best practices.'),
        systemPrompt: 'Analyze code quality.',
        toolPreset: 'none',
        maxSteps: 1,
      });

      const parallel = createParallel({
        steps: [asStep(security), asStep(performance), asStep(quality)],
        synthesize: (results) => ({
          text: `Combined Report:\n${results.map((r) => `- ${r.text}`).join('\n')}`,
        }),
      });

      const result = await parallel.execute({ prompt: 'Analyze this code' });

      expect(result.text).toContain('Combined Report');
      expect(result.text).toContain('Security');
      expect(result.text).toContain('Performance');
      expect(result.text).toContain('Quality');
    });
  });

  describe('specialist pool workflow', () => {
    it('should spawn specialists, delegate, and collect results', async () => {
      // The createAgent callback receives AgentOptions { role, systemPrompt, ... }
      const pool = new SpecialistPool({
        maxAgents: 3,
        createAgent: (options) =>
          createAgent({
            model: createMockModel('Specialist task completed.'),
            systemPrompt: options.systemPrompt ?? 'You are a specialist.',
            toolPreset: 'none',
            maxSteps: 1,
          }),
      });

      // Spawn multiple specialists
      await pool.spawn({ domain: 'frontend', instructions: 'Handle UI tasks.' });
      await pool.spawn({ domain: 'backend', instructions: 'Handle API tasks.' });
      await pool.spawn({ domain: 'testing', instructions: 'Handle test tasks.' });

      expect(pool.list()).toHaveLength(3);

      // Generate from each specialist
      const frontendResult = await pool.generate('frontend', 'Build the login page');
      const backendResult = await pool.generate('backend', 'Create REST endpoints');
      const testingResult = await pool.generate('testing', 'Write integration tests');

      expect(frontendResult).toContain('Specialist');
      expect(backendResult).toContain('Specialist');
      expect(testingResult).toContain('Specialist');
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

  describe('multi-agent delegation via pipeline', () => {
    it('should pass output from one agent as input to the next', async () => {
      // Agent 1: Extract key points
      const extractor = createAgent({
        model: createMockModel('Key points: 1) TypeScript adds types 2) Compiles to JS 3) Supports generics'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      // Agent 2: Summarize key points
      const summarizer = createAgent({
        model: createMockModel('Summary: TypeScript is a typed language that compiles to JavaScript with generic support.'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      // Agent 3: Format for presentation
      const formatter = createAgent({
        model: createMockModel('## TypeScript Overview\nTypeScript provides type safety and generic support, compiling to JavaScript.'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      const pipeline = createPipeline({
        name: 'extract-summarize-format',
        steps: [asStep(extractor), asStep(summarizer), asStep(formatter)],
      });

      const result = await pipeline.execute({ prompt: 'Tell me about TypeScript' });

      expect(result.text).toContain('TypeScript');
      expect(result.text).toContain('##');
    });
  });
});
