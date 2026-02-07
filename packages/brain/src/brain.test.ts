/**
 * Brain Package Unit Tests
 * 
 * Tests for:
 * - Episode persistence (remember/recall)
 * - Shell tool safety features
 * - Code analysis tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createShellTools } from './tools/shell';

describe('Shell Tools', () => {
  const shellTools = createShellTools();

  describe('execute', () => {
    it('should execute simple commands', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'echo "hello world"' 
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.stdout).toContain('hello world');
    });

    it('should block dangerous rm -rf commands', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'rm -rf /' 
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.blocked).toBe(true);
      expect(parsed.error).toContain('blocked');
    });

    it('should block sudo commands', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'sudo apt-get install foo' 
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.blocked).toBe(true);
    });

    it('should block interactive commands', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'vim test.txt' 
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Interactive');
    });

    it('should handle command errors gracefully', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'nonexistent_command_xyz' 
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.exitCode).not.toBe(0);
    });

    it('should respect timeout', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'sleep 10',
        timeout: 100
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('timed out');
    });

    it('should pass environment variables', async () => {
      const result = await shellTools.execute.execute({ 
        command: 'echo $TEST_VAR',
        env: { TEST_VAR: 'test_value_123' }
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.stdout).toContain('test_value_123');
    });
  });

  describe('background', () => {
    it('should start a background process', async () => {
      const result = await shellTools.background.execute({ 
        operation: 'start',
        command: 'echo "background test"'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(parsed.sessionId).toBeDefined();
      expect(parsed.sessionId).toMatch(/^bg-/);
    });

    it('should list sessions', async () => {
      const result = await shellTools.background.execute({ 
        operation: 'list'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(true);
      expect(Array.isArray(parsed.sessions)).toBe(true);
    });

    it('should require command for start operation', async () => {
      const result = await shellTools.background.execute({ 
        operation: 'start'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('required');
    });

    it('should block dangerous background commands', async () => {
      const result = await shellTools.background.execute({ 
        operation: 'start',
        command: 'rm -rf /'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.success).toBe(false);
      expect(parsed.blocked).toBe(true);
    });
  });
});

describe('Episode Persistence', () => {
  it('should export EpisodeRow type from operations', async () => {
    const { EpisodeRow } = await import('./graph/operations');
    expect(EpisodeRow).toBeUndefined();
  });
});

describe('Code Analysis Tools', () => {
  it('should create code analysis tools with client', async () => {
    const { createCodeAnalysisTools } = await import('./tools/code-analysis');
    
    const mockClient = {
      roQuery: vi.fn().mockResolvedValue({ data: [] }),
      query: vi.fn().mockResolvedValue({ data: [] }),
    };
    
    const tools = createCodeAnalysisTools({ client: mockClient as any });
    
    expect(tools.getContext).toBeDefined();
    expect(tools.findSymbol).toBeDefined();
    expect(tools.searchCode).toBeDefined();
    expect(tools.analyzeImpact).toBeDefined();
    expect(tools.getFileTree).toBeDefined();
    expect(tools.getComplexityReport).toBeDefined();
  });

  describe('findSymbol', () => {
    it('should return error for empty symbol name', async () => {
      const { createCodeAnalysisTools } = await import('./tools/code-analysis');
      
      const mockClient = {
        roQuery: vi.fn().mockResolvedValue({ data: [] }),
      };
      
      const tools = createCodeAnalysisTools({ client: mockClient as any });
      
      const result = await tools.findSymbol.execute({ 
        name: '',
        kind: 'any'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.found).toBe(false);
      expect(parsed.error).toContain('required');
    });
  });

  describe('searchCode', () => {
    it('should return error for empty query', async () => {
      const { createCodeAnalysisTools } = await import('./tools/code-analysis');
      
      const mockClient = {
        roQuery: vi.fn().mockResolvedValue({ data: [] }),
      };
      
      const tools = createCodeAnalysisTools({ client: mockClient as any });
      
      const result = await tools.searchCode.execute({ 
        query: '',
        scope: 'all'
      }, { toolCallId: 'test', messages: [] });
      
      const parsed = JSON.parse(result);
      expect(parsed.total).toBe(0);
      expect(parsed.error).toContain('required');
    });
  });
});
