/**
 * @fileoverview Tests for SpecialistPool: LRU+TTL caching, spawn, list, history strategies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@agent/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(() => vi.fn()),
  }),
}));

vi.mock('../skills', () => ({
  loadSkillsFromPaths: vi.fn().mockReturnValue([
    { name: 'test-skill', description: 'A test skill', content: 'Skill instructions here.' },
  ]),
  buildSkillsSystemPrompt: vi.fn().mockReturnValue('\n<skills>\nSkill instructions here.\n</skills>'),
}));

import { SpecialistPool } from '../pool/specialist-pool';
import { createPoolTools } from '../pool/tools';
import type { SpecialistPoolConfig } from '../pool/types';
import { loadSkillsFromPaths, buildSkillsSystemPrompt } from '../skills';

const mockLoadSkills = loadSkillsFromPaths as unknown as ReturnType<typeof vi.fn>;
const mockBuildPrompt = buildSkillsSystemPrompt as unknown as ReturnType<typeof vi.fn>;

// ============================================================================
// Helpers
// ============================================================================

function createMockFactory() {
  return vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({ text: 'specialist response' }),
  }));
}

function createPool(overrides: Partial<SpecialistPoolConfig> = {}): {
  pool: SpecialistPool;
  factory: ReturnType<typeof vi.fn>;
} {
  const factory = createMockFactory();
  const pool = new SpecialistPool({
    createAgent: factory,
    ...overrides,
  });
  return { pool, factory };
}

beforeEach(() => {
  mockLoadSkills.mockClear();
  mockBuildPrompt.mockClear();
});

// ============================================================================
// Basic spawn/reuse
// ============================================================================

describe('SpecialistPool — spawn', () => {
  it('should create a new specialist on first spawn', async () => {
    const { pool, factory } = createPool();

    const result = await pool.spawn({ domain: 'security' });

    expect(result.domain).toBe('security');
    expect(result.useCount).toBe(1);
    expect(factory).toHaveBeenCalledTimes(1);
    expect(pool.size).toBe(1);
  });

  it('should return cached specialist on second spawn (same domain)', async () => {
    const { pool, factory } = createPool();

    const first = await pool.spawn({ domain: 'security' });
    const second = await pool.spawn({ domain: 'security' });

    expect(factory).toHaveBeenCalledTimes(1); // Only one creation
    expect(second.useCount).toBe(2);
    expect(second).toBe(first); // Same object reference
  });

  it('should create separate specialists for different domains', async () => {
    const { pool, factory } = createPool();

    await pool.spawn({ domain: 'security' });
    await pool.spawn({ domain: 'performance' });

    expect(factory).toHaveBeenCalledTimes(2);
    expect(pool.size).toBe(2);
  });

  it('should pass role to createAgent', async () => {
    const { pool, factory } = createPool();

    await pool.spawn({ domain: 'code-review', role: 'coder' });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'coder' }),
    );
  });

  it('should inject skills into system prompt', async () => {
    const { pool } = createPool();

    await pool.spawn({
      domain: 'frontend',
      skills: ['/path/to/skill1', '/path/to/skill2'],
    });

    expect(mockLoadSkills).toHaveBeenCalledWith(['/path/to/skill1', '/path/to/skill2']);
    expect(mockBuildPrompt).toHaveBeenCalled();
  });

  it('should combine instructions with skills prompt', async () => {
    const { pool, factory } = createPool();

    await pool.spawn({
      domain: 'backend',
      instructions: 'You are a backend expert.',
      skills: ['/path/to/skill'],
    });

    const callArgs = factory.mock.calls[0][0];
    expect(callArgs.systemPrompt).toContain('You are a backend expert.');
    expect(callArgs.systemPrompt).toContain('<skills>');
  });

  it('should use instructions without skills', async () => {
    const { pool, factory } = createPool();

    await pool.spawn({
      domain: 'ops',
      instructions: 'You are a DevOps specialist.',
    });

    const callArgs = factory.mock.calls[0][0];
    expect(callArgs.systemPrompt).toBe('You are a DevOps specialist.');
    expect(mockLoadSkills).not.toHaveBeenCalled();
  });

  it('should forward agentOptions to createAgent', async () => {
    const { pool, factory } = createPool();

    await pool.spawn({
      domain: 'research',
      agentOptions: { maxSteps: 20, toolPreset: 'full' },
    });

    expect(factory).toHaveBeenCalledWith(
      expect.objectContaining({ maxSteps: 20, toolPreset: 'full' }),
    );
  });
});

// ============================================================================
// LRU eviction
// ============================================================================

describe('SpecialistPool — LRU eviction', () => {
  it('should evict least-recently-used when at max capacity', async () => {
    const { pool } = createPool({ maxAgents: 2 });

    await pool.spawn({ domain: 'A' });
    await pool.spawn({ domain: 'B' });

    // A was used first and not touched since → LRU
    await pool.spawn({ domain: 'C' });

    expect(pool.size).toBe(2);
    expect(pool.get('A')).toBeUndefined();
    expect(pool.get('B')).toBeDefined();
    expect(pool.get('C')).toBeDefined();
  });

  it('should evict correctly when LRU is updated', async () => {
    const { pool } = createPool({ maxAgents: 2 });

    await pool.spawn({ domain: 'A' });
    await pool.spawn({ domain: 'B' });

    // Manually set lastUsedAt to ensure B is clearly older
    const entryA = pool.get('A')!;
    const entryB = pool.get('B')!;
    entryB.lastUsedAt = Date.now() - 1000;
    entryA.lastUsedAt = Date.now(); // A was recently touched

    await pool.spawn({ domain: 'C' });

    expect(pool.size).toBe(2);
    expect(pool.get('B')).toBeUndefined(); // B was LRU
    expect(pool.get('A')).toBeDefined();
    expect(pool.get('C')).toBeDefined();
  });
});

// ============================================================================
// TTL expiration
// ============================================================================

describe('SpecialistPool — TTL expiration', () => {
  it('should recreate expired specialist', async () => {
    const { pool, factory } = createPool({ ttlMs: 100 });

    await pool.spawn({ domain: 'security' });
    expect(factory).toHaveBeenCalledTimes(1);

    // Simulate time passing
    const cached = pool.get('security')!;
    cached.createdAt = Date.now() - 200; // Expired

    await pool.spawn({ domain: 'security' });
    expect(factory).toHaveBeenCalledTimes(2); // Recreated
  });

  it('should report expired specialists in list', async () => {
    const { pool } = createPool({ ttlMs: 100 });

    await pool.spawn({ domain: 'test' });
    const cached = pool.get('test')!;
    cached.createdAt = Date.now() - 200;

    const list = pool.list();
    expect(list[0].expired).toBe(true);
  });
});

// ============================================================================
// generate with history
// ============================================================================

describe('SpecialistPool — generate', () => {
  it('should generate a response and record history', async () => {
    const { pool } = createPool();

    await pool.spawn({ domain: 'qa' });
    const response = await pool.generate('qa', 'test this feature');

    expect(response).toBe('specialist response');

    const cached = pool.get('qa')!;
    expect(cached.history).toHaveLength(2);
    expect(cached.history[0].role).toBe('user');
    expect(cached.history[0].content).toBe('test this feature');
    expect(cached.history[1].role).toBe('assistant');
    expect(cached.history[1].content).toBe('specialist response');
  });

  it('should throw if domain not found', async () => {
    const { pool } = createPool();

    await expect(pool.generate('nonexistent', 'hi')).rejects.toThrow(
      'No specialist found for domain: nonexistent',
    );
  });

  it('should throw if specialist expired', async () => {
    const { pool } = createPool({ ttlMs: 50 });

    await pool.spawn({ domain: 'test' });
    const cached = pool.get('test')!;
    cached.createdAt = Date.now() - 100;

    await expect(pool.generate('test', 'hi')).rejects.toThrow('expired');
  });

  it('should include history context in subsequent prompts', async () => {
    const { pool } = createPool();

    await pool.spawn({ domain: 'chat' });
    await pool.generate('chat', 'first message');

    // Now the agent should be called with history context
    const cached = pool.get('chat')!;
    const generateFn = cached.agent.generate as ReturnType<typeof vi.fn>;

    await pool.generate('chat', 'second message');

    const lastCall = generateFn.mock.calls[generateFn.mock.calls.length - 1][0];
    expect(lastCall.prompt).toContain('Previous conversation');
    expect(lastCall.prompt).toContain('first message');
    expect(lastCall.prompt).toContain('second message');
  });
});

// ============================================================================
// History strategies
// ============================================================================

describe('SpecialistPool — history strategies', () => {
  it('full strategy should keep all history', async () => {
    const { pool } = createPool({ defaultHistoryStrategy: 'full' });

    await pool.spawn({ domain: 'test' });

    // Generate multiple exchanges
    for (let i = 0; i < 5; i++) {
      await pool.generate('test', `message ${i}`);
    }

    const cached = pool.get('test')!;
    expect(cached.history).toHaveLength(10); // 5 user + 5 assistant
  });

  it('sliding-window strategy should truncate old history', async () => {
    const { pool } = createPool({
      defaultHistoryStrategy: 'sliding-window',
      defaultWindowSize: 4, // Keep last 4 messages
    });

    await pool.spawn({ domain: 'test' });

    // Generate 5 exchanges (10 messages)
    for (let i = 0; i < 5; i++) {
      await pool.generate('test', `message ${i}`);
    }

    // The actual history keeps all messages
    const cached = pool.get('test')!;
    expect(cached.history).toHaveLength(10);

    // But contextual prompt should only use the window
    const generateFn = cached.agent.generate as ReturnType<typeof vi.fn>;
    await pool.generate('test', 'final');

    const lastCall = generateFn.mock.calls[generateFn.mock.calls.length - 1][0];
    // Should not contain the first messages (they're outside the window)
    expect(lastCall.prompt).not.toContain('message 0');
    expect(lastCall.prompt).toContain('message 4');
  });

  it('summary strategy should keep first and last messages', async () => {
    const { pool } = createPool({ defaultHistoryStrategy: 'summary' });

    await pool.spawn({ domain: 'test' });

    // Generate 5 exchanges (10 messages)
    for (let i = 0; i < 5; i++) {
      await pool.generate('test', `message ${i}`);
    }

    const cached = pool.get('test')!;
    const generateFn = cached.agent.generate as ReturnType<typeof vi.fn>;
    await pool.generate('test', 'final');

    const lastCall = generateFn.mock.calls[generateFn.mock.calls.length - 1][0];
    // Should contain first exchange context
    expect(lastCall.prompt).toContain('message 0');
    // Should contain last exchange context
    expect(lastCall.prompt).toContain('message 4');
  });
});

// ============================================================================
// list / remove / clear
// ============================================================================

describe('SpecialistPool — list, remove, clear', () => {
  it('list should return metadata for all specialists', async () => {
    const { pool } = createPool();

    await pool.spawn({ domain: 'A', skills: ['/skill-a'] });
    await pool.spawn({ domain: 'B' });

    const list = pool.list();
    expect(list).toHaveLength(2);
    expect(list[0].domain).toBe('A');
    expect(list[0].skills).toEqual(['/skill-a']);
    expect(list[1].domain).toBe('B');
  });

  it('remove should delete a specialist', async () => {
    const { pool } = createPool();

    await pool.spawn({ domain: 'removeme' });
    expect(pool.size).toBe(1);

    const removed = pool.remove('removeme');
    expect(removed).toBe(true);
    expect(pool.size).toBe(0);
  });

  it('remove returns false for non-existent domain', () => {
    const { pool } = createPool();
    expect(pool.remove('nope')).toBe(false);
  });

  it('clear should remove all specialists', async () => {
    const { pool } = createPool();

    await pool.spawn({ domain: 'A' });
    await pool.spawn({ domain: 'B' });
    await pool.spawn({ domain: 'C' });
    expect(pool.size).toBe(3);

    pool.clear();
    expect(pool.size).toBe(0);
  });
});

// ============================================================================
// Tools
// ============================================================================

describe('createPoolTools', () => {
  it('should create spawn_specialist and list_specialists tools', () => {
    const { pool } = createPool();
    const tools = createPoolTools(pool);

    expect(tools).toHaveProperty('spawn_specialist');
    expect(tools).toHaveProperty('list_specialists');
  });
});
