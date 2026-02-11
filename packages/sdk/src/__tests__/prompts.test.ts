/**
 * @agntk/core - Prompts Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { systemPrompt, rolePrompts } from '../prompts/templates';
import { 
  buildSystemContext, 
  formatSystemContextBlock,
  buildDynamicSystemPrompt,
  type SystemContext 
} from '../prompts/context';

describe('systemPrompt', () => {
  it('should export a non-empty system prompt', () => {
    expect(systemPrompt).toBeDefined();
    expect(typeof systemPrompt).toBe('string');
    expect(systemPrompt.length).toBeGreaterThan(100);
  });

  it('should include key sections', () => {
    expect(systemPrompt).toContain('Philosophy');
    expect(systemPrompt).toContain('Tools');
    expect(systemPrompt).toContain('Completion');
  });
});

describe('rolePrompts', () => {
  it('should export role prompts object', () => {
    expect(rolePrompts).toBeDefined();
    expect(typeof rolePrompts).toBe('object');
  });

  it('should have generic role', () => {
    expect(rolePrompts.generic).toBeDefined();
    expect(rolePrompts.generic).toBe(systemPrompt);
  });

  it('should have coder role with code-specific content', () => {
    expect(rolePrompts.coder).toBeDefined();
    expect(rolePrompts.coder).toContain('code');
  });

  it('should have researcher role', () => {
    expect(rolePrompts.researcher).toBeDefined();
    expect(rolePrompts.researcher).toContain('research');
  });

  it('should have analyst role', () => {
    expect(rolePrompts.analyst).toBeDefined();
    expect(rolePrompts.analyst).toContain('analysis');
  });

  it('should extend base systemPrompt for specialized roles', () => {
    expect(rolePrompts.coder).toContain(systemPrompt);
    expect(rolePrompts.researcher).toContain(systemPrompt);
    expect(rolePrompts.analyst).toContain(systemPrompt);
  });
});

describe('buildSystemContext', () => {
  it('should return context with required fields', async () => {
    const context = await buildSystemContext();

    expect(context).toHaveProperty('currentTime');
    expect(context).toHaveProperty('currentDate');
    expect(context).toHaveProperty('timezone');
    expect(context).toHaveProperty('platform');
    expect(context).toHaveProperty('hostname');
    expect(context).toHaveProperty('username');
  });

  it('should include workspace root when provided', async () => {
    const context = await buildSystemContext({ workspaceRoot: '/test/workspace' });
    expect(context.workspaceRoot).toBe('/test/workspace');
  });

  it('should format current time correctly', async () => {
    const context = await buildSystemContext();
    // Should be in format like "10:30 AM"
    expect(context.currentTime).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
  });

  it('should format current date correctly', async () => {
    const context = await buildSystemContext();
    // Should contain day of week and month
    expect(context.currentDate).toMatch(/\w+,\s+\w+\s+\d+,\s+\d{4}/);
  });
});

describe('formatSystemContextBlock', () => {
  it('should format context as markdown', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
    };

    const block = formatSystemContextBlock(context);

    expect(block).toContain('# Current Environment');
    expect(block).toContain('**Date**: Tuesday, January 14, 2026');
    expect(block).toContain('**Time**: 10:30 AM');
    expect(block).toContain('**Platform**: darwin');
    expect(block).toContain('**User**: testuser');
  });

  it('should include workspace when provided', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
      workspaceRoot: '/my/project',
    };

    const block = formatSystemContextBlock(context);
    expect(block).toContain('**Workspace**: /my/project');
  });

  it('should include workspace map when provided', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
      workspaceRoot: '/my/project',
      workspaceMap: 'src/: index.ts, utils\npackage.json',
    };

    const block = formatSystemContextBlock(context);
    expect(block).toContain('## Workspace Structure');
    expect(block).toContain('src/: index.ts, utils');
  });
});

describe('buildDynamicSystemPrompt', () => {
  it('should combine base prompt with context', async () => {
    const basePrompt = 'You are a helpful assistant.';
    const dynamicPrompt = await buildDynamicSystemPrompt(basePrompt);

    expect(dynamicPrompt).toContain(basePrompt);
    expect(dynamicPrompt).toContain('# Current Environment');
  });

  it('should include workspace info when provided', async () => {
    const basePrompt = 'Base prompt.';
    const dynamicPrompt = await buildDynamicSystemPrompt(basePrompt, { workspaceRoot: '/test/workspace' });

    expect(dynamicPrompt).toContain('/test/workspace');
  });
});

describe('buildSystemContext with memory integration', () => {
  it('should accept memoryStore option without error', async () => {
    // Mock memory store
    const mockMemoryStore = {
      remember: vi.fn(),
      recall: vi.fn().mockResolvedValue([]),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    };

    const context = await buildSystemContext({
      memoryStore: mockMemoryStore as any,
      autoLoadPreferences: true,
    });

    expect(context).toHaveProperty('currentTime');
    expect(context).toHaveProperty('userPreferences');
  });

  it('should load preferences from memory when autoLoadPreferences is true', async () => {
    const mockMemoryStore = {
      remember: vi.fn(),
      recall: vi.fn().mockResolvedValue([
        {
          item: {
            id: 'mem_1',
            text: 'User prefers concise responses',
            metadata: { tags: ['preference'], name: 'John' },
            timestamp: new Date(),
          },
          score: 0.9,
        },
      ]),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    };

    const context = await buildSystemContext({
      memoryStore: mockMemoryStore as any,
      autoLoadPreferences: true,
    });

    expect(mockMemoryStore.recall).toHaveBeenCalled();
    expect(context.userPreferences).toBeDefined();
    expect(context.userPreferences?.name).toBe('John');
    expect(context.userPreferences?.communicationStyle).toBe('concise');
  });

  it('should merge explicit preferences with memory preferences (explicit wins)', async () => {
    const mockMemoryStore = {
      remember: vi.fn(),
      recall: vi.fn().mockResolvedValue([
        {
          item: {
            id: 'mem_1',
            text: 'User prefers detailed responses',
            metadata: { name: 'Jane' },
            timestamp: new Date(),
          },
          score: 0.9,
        },
      ]),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    };

    const context = await buildSystemContext({
      memoryStore: mockMemoryStore as any,
      autoLoadPreferences: true,
      userPreferences: {
        name: 'Override Name',
        language: 'Spanish',
      },
    });

    // Explicit should override memory
    expect(context.userPreferences?.name).toBe('Override Name');
    expect(context.userPreferences?.language).toBe('Spanish');
    // Memory should fill in gaps
    expect(context.userPreferences?.communicationStyle).toBe('detailed');
  });

  it('should not call memory store when autoLoadPreferences is false', async () => {
    const mockMemoryStore = {
      remember: vi.fn(),
      recall: vi.fn(),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    };

    await buildSystemContext({
      memoryStore: mockMemoryStore as any,
      autoLoadPreferences: false,
    });

    expect(mockMemoryStore.recall).not.toHaveBeenCalled();
  });

  it('should handle memory store errors gracefully', async () => {
    const mockMemoryStore = {
      remember: vi.fn(),
      recall: vi.fn().mockRejectedValue(new Error('Memory error')),
      forget: vi.fn(),
      forgetAll: vi.fn(),
      count: vi.fn(),
      close: vi.fn(),
    };

    const context = await buildSystemContext({
      memoryStore: mockMemoryStore as any,
      autoLoadPreferences: true,
    });

    // Should not throw, just return empty preferences
    expect(context).toHaveProperty('currentTime');
  });
});

describe('formatSystemContextBlock with user preferences', () => {
  it('should include user preferences in formatted output', () => {
    const context: SystemContext = {
      currentTime: '10:30 AM',
      currentDate: 'Tuesday, January 14, 2026',
      timezone: 'America/New_York',
      platform: 'darwin',
      hostname: 'test-machine',
      username: 'testuser',
      locale: 'en-US',
      userPreferences: {
        name: 'Test User',
        language: 'English',
        communicationStyle: 'concise',
        codeStyle: {
          indentation: 'spaces',
          indentSize: 2,
        },
      },
    };

    const block = formatSystemContextBlock(context);

    expect(block).toContain('## User Preferences');
    expect(block).toContain('**Name**: Test User');
    expect(block).toContain('**Preferred Language**: English');
    expect(block).toContain('**Communication Style**: concise');
    expect(block).toContain('Indentation: spaces');
    expect(block).toContain('Indent Size: 2');
  });
});
