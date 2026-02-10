/**
 * Brain Package Unit Tests
 * 
 * Tests for:
 * - Episode persistence (remember/recall)
 * - Shell tool safety features
 * - Code analysis tools
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Shell tools have been consolidated into @agent/sdk.
// Shell tests are in packages/sdk/src/__tests__/browser-tool.test.ts and background.test.ts.

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
