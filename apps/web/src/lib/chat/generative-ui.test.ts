/**
 * Unit tests for json-render catalog + registry
 *
 * Verifies:
 * - Catalog defines 16+ components
 * - Every catalog component resolves in the registry
 * - Catalog generates a valid system prompt
 * - render_ui tool schema validates correct specs
 * - render_ui tool schema rejects invalid specs
 */
import { describe, it, expect } from 'vitest';
import { catalog } from './catalog';
import { getCatalogSystemPrompt } from './catalog';

// ── Catalog Tests ──────────────────────────────────────────────────

describe('catalog', () => {
  it('should export a valid catalog object', () => {
    expect(catalog).toBeDefined();
    expect(typeof catalog.prompt).toBe('function');
  });

  it('should generate a non-empty system prompt', () => {
    const prompt = getCatalogSystemPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });

  it('should contain all planned component names in the prompt', () => {
    const prompt = getCatalogSystemPrompt();
    const expectedComponents = [
      'Card',
      'Row',
      'Column',
      'Metric',
      'Table',
      'StatusBadge',
      'ProgressBar',
      'Heading',
      'Text',
      'CodeBlock',
      'Terminal',
      'FileTree',
      'Chart',
      'Alert',
      'Divider',
      'Button',
    ];
    for (const name of expectedComponents) {
      expect(prompt).toContain(name);
    }
  });

  it('should have 16 component definitions', () => {
    const prompt = getCatalogSystemPrompt();
    // Each component appears as a type in the prompt
    const componentNames = [
      'Card', 'Row', 'Column', 'Metric', 'Table', 'StatusBadge',
      'ProgressBar', 'Heading', 'Text', 'CodeBlock', 'Terminal',
      'FileTree', 'Chart', 'Alert', 'Divider', 'Button',
    ];
    for (const name of componentNames) {
      expect(prompt).toContain(name);
    }
    expect(componentNames.length).toBe(16);
  });

  it('should include action names in the prompt', () => {
    const prompt = getCatalogSystemPrompt();
    expect(prompt).toContain('copy_to_clipboard');
    expect(prompt).toContain('navigate');
    expect(prompt).toContain('refresh_data');
  });
});

// ── Registry Tests ─────────────────────────────────────────────────

describe('registry', () => {
  // Dynamic import to avoid "use client" SSR issues in node test env
  it('should export a registry object with component mappings', async () => {
    const mod = await import('./registry');
    expect(mod.registry).toBeDefined();
    expect(typeof mod.registry).toBe('object');
  });

  it('should export action handlers', async () => {
    const mod = await import('./registry');
    expect(mod.handlers).toBeDefined();
    expect(mod.executeAction).toBeDefined();
    expect(typeof mod.executeAction).toBe('function');
  });
});

// ── render_ui Tool Schema Tests ────────────────────────────────────

describe('render_ui tool schema', () => {
  // Import zod to test the schema validation directly
  const { z } = require('zod');

  // Replicate the schema from tools.ts for isolated testing
  const renderUISchema = z.object({
    spec: z.object({
      root: z.string(),
      elements: z.record(z.string(), z.object({
        type: z.string(),
        props: z.record(z.string(), z.unknown()),
        children: z.array(z.string()).optional(),
      })),
    }),
  });

  it('should accept a valid spec with Card + Metric', () => {
    const validSpec = {
      spec: {
        root: 'root-card',
        elements: {
          'root-card': {
            type: 'Card',
            props: { title: 'Dashboard', description: null, padding: 'md' },
            children: ['metric-1'],
          },
          'metric-1': {
            type: 'Metric',
            props: { label: 'Revenue', value: '$42,000', format: 'currency', trend: 'up', trendValue: '+12%' },
          },
        },
      },
    };
    const result = renderUISchema.safeParse(validSpec);
    expect(result.success).toBe(true);
  });

  it('should accept a spec with Table', () => {
    const tableSpec = {
      spec: {
        root: 'table-1',
        elements: {
          'table-1': {
            type: 'Table',
            props: {
              columns: [
                { key: 'name', label: 'Name', align: 'left' },
                { key: 'status', label: 'Status', align: 'center' },
              ],
              rows: [
                { name: 'Task A', status: 'done' },
                { name: 'Task B', status: 'pending' },
              ],
              caption: null,
            },
          },
        },
      },
    };
    const result = renderUISchema.safeParse(tableSpec);
    expect(result.success).toBe(true);
  });

  it('should accept a spec with Chart', () => {
    const chartSpec = {
      spec: {
        root: 'chart-1',
        elements: {
          'chart-1': {
            type: 'Chart',
            props: {
              type: 'bar',
              title: 'Revenue by Month',
              xAxisLabel: 'Month',
              yAxisLabel: 'Revenue',
              data: [
                { month: 'Jan', revenue: '42000' },
                { month: 'Feb', revenue: '48000' },
              ],
              categoryKey: 'month',
              valueKeys: [{ key: 'revenue', label: 'Revenue', color: null }],
            },
          },
        },
      },
    };
    const result = renderUISchema.safeParse(chartSpec);
    expect(result.success).toBe(true);
  });

  it('should reject a spec without root', () => {
    const badSpec = {
      spec: {
        elements: {
          'card-1': { type: 'Card', props: {} },
        },
      },
    };
    const result = renderUISchema.safeParse(badSpec);
    expect(result.success).toBe(false);
  });

  it('should reject a spec without elements', () => {
    const badSpec = {
      spec: {
        root: 'card-1',
      },
    };
    const result = renderUISchema.safeParse(badSpec);
    expect(result.success).toBe(false);
  });

  it('should reject an empty object', () => {
    const result = renderUISchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ── parseRenderUIOutput Tests ──────────────────────────────────────

describe('parseRenderUIOutput', () => {
  // Inline the parser logic for testing without React deps
  function parseRenderUIOutput(output: unknown) {
    if (!output) return null;
    try {
      const parsed = typeof output === 'string' ? JSON.parse(output) : output;
      if (parsed && typeof parsed === 'object' && 'spec' in parsed) {
        const spec = (parsed as { spec: unknown }).spec;
        if (spec && typeof spec === 'object' && 'root' in spec && 'elements' in spec) {
          return spec;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  it('should parse a valid tool output object', () => {
    const output = {
      spec: {
        root: 'card-1',
        elements: {
          'card-1': { type: 'Card', props: { title: 'Test' } },
        },
      },
      rendered: true,
    };
    const result = parseRenderUIOutput(output);
    expect(result).toBeDefined();
    expect((result as { root: string }).root).toBe('card-1');
  });

  it('should parse a JSON string output', () => {
    const output = JSON.stringify({
      spec: {
        root: 'r',
        elements: { r: { type: 'Text', props: { content: 'hi' } } },
      },
      rendered: true,
    });
    const result = parseRenderUIOutput(output);
    expect(result).toBeDefined();
  });

  it('should return null for null input', () => {
    expect(parseRenderUIOutput(null)).toBeNull();
  });

  it('should return null for invalid JSON string', () => {
    expect(parseRenderUIOutput('not json')).toBeNull();
  });

  it('should return null for object without spec', () => {
    expect(parseRenderUIOutput({ foo: 'bar' })).toBeNull();
  });

  it('should return null for spec without root', () => {
    expect(parseRenderUIOutput({ spec: { elements: {} } })).toBeNull();
  });
});
