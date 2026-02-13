/**
 * @fileoverview Integration tests for model configuration and sub-agent configs.
 */

import { describe, it, expect } from 'vitest';
import {
  createAgent,
  resolveModel,
} from '@agntk/core';
import { subAgentConfigs, getSubAgentConfig } from '@agntk/core/advanced';
import { createMockModel } from './setup';

describe('Models & Agent Config', () => {
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

  describe('createAgent with different configs', () => {
    it('should create agent with name only', () => {
      const agent = createAgent({
        name: 'minimal-agent',
        model: createMockModel('Hello'),
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('minimal-agent');
    });

    it('should create agent with instructions', () => {
      const agent = createAgent({
        name: 'coder-agent',
        model: createMockModel('Code output'),
        instructions: 'You are an expert coder.',
      });

      expect(agent.name).toBe('coder-agent');
      expect(agent.getSystemPrompt()).toContain('expert coder');
    });

    it('should create agent with custom maxSteps', () => {
      const agent = createAgent({
        name: 'custom-steps-agent',
        model: createMockModel('Output'),
        maxSteps: 50,
      });

      expect(agent).toBeDefined();
    });
  });
});
