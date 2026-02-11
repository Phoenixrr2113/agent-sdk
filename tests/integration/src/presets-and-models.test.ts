/**
 * @fileoverview Integration tests for presets and model configuration.
 * Tests toolPresets, roleConfigs, resolveModel, and their interaction with createAgent.
 */

import { describe, it, expect } from 'vitest';
import {
  createAgent,
  toolPresets,
  roleConfigs,
  resolveModel,
} from '@agntk/core';
import { subAgentConfigs, getSubAgentConfig } from '@agntk/core/advanced';
import { createMockModel } from './setup';

describe('Presets & Models', () => {
  describe('toolPresets', () => {
    it('should export preset definitions', () => {
      expect(toolPresets).toBeDefined();
      expect(typeof toolPresets).toBe('object');
    });
  });

  describe('roleConfigs', () => {
    it('should export role configurations', () => {
      expect(roleConfigs).toBeDefined();
      expect(typeof roleConfigs).toBe('object');
    });

    it('should have standard roles defined', () => {
      const roleNames = Object.keys(roleConfigs);
      expect(roleNames).toContain('generic');
      expect(roleNames).toContain('coder');
      expect(roleNames).toContain('researcher');
      expect(roleNames).toContain('analyst');
    });

    it('should have system prompts for each role', () => {
      for (const [name, config] of Object.entries(roleConfigs)) {
        expect(config.systemPrompt).toBeDefined();
        expect(typeof config.systemPrompt).toBe('string');
        expect(config.systemPrompt.length).toBeGreaterThan(0);
      }
    });
  });

  describe('subAgentConfigs', () => {
    it('should export sub-agent configurations', () => {
      expect(subAgentConfigs).toBeDefined();
      expect(typeof subAgentConfigs).toBe('object');
    });

    it('should have sub-agent roles defined', () => {
      const roles = Object.keys(subAgentConfigs);
      expect(roles.length).toBeGreaterThan(0);
    });
  });

  describe('getSubAgentConfig', () => {
    it('should return config for known roles', () => {
      const config = getSubAgentConfig('coder');
      expect(config).toBeDefined();
    });

    it('should return generic config for unknown roles', () => {
      const config = getSubAgentConfig('unknown-role' as any);
      expect(config).toBeDefined();
    });
  });

  describe('createAgent with different presets', () => {
    it('should create agent with none preset (no tools)', () => {
      const agent = createAgent({
        model: createMockModel('No tools'),
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(agent).toBeDefined();
      expect(agent.getToolLoopAgent()).toBeDefined();
    });

    it('should create agent with minimal preset', () => {
      const agent = createAgent({
        model: createMockModel('Minimal tools'),
        toolPreset: 'minimal',
        maxSteps: 1,
      });

      expect(agent).toBeDefined();
    });

    it('should create agent with standard preset', () => {
      const agent = createAgent({
        model: createMockModel('Standard tools'),
        toolPreset: 'standard',
        maxSteps: 1,
      });

      expect(agent).toBeDefined();
    });

    it('should create agent with full preset', () => {
      const agent = createAgent({
        model: createMockModel('Full tools'),
        toolPreset: 'full',
        maxSteps: 1,
      });

      expect(agent).toBeDefined();
    });
  });

  describe('createAgent with different roles', () => {
    it('should create coder agent', async () => {
      const agent = createAgent({
        model: createMockModel('Code output'),
        role: 'coder',
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(agent.role).toBe('coder');
      const result = await agent.generate({ prompt: 'Write code' });
      expect(result.text).toBe('Code output');
    });

    it('should create researcher agent', async () => {
      const agent = createAgent({
        model: createMockModel('Research output'),
        role: 'researcher',
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(agent.role).toBe('researcher');
      const result = await agent.generate({ prompt: 'Research topic' });
      expect(result.text).toBe('Research output');
    });

    it('should create analyst agent', async () => {
      const agent = createAgent({
        model: createMockModel('Analysis output'),
        role: 'analyst',
        toolPreset: 'none',
        maxSteps: 1,
      });

      expect(agent.role).toBe('analyst');
      const result = await agent.generate({ prompt: 'Analyze data' });
      expect(result.text).toBe('Analysis output');
    });
  });
});
