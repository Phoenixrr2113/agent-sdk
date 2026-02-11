/**
 * @fileoverview Tests for createTeam, TaskBoard, and team coordination.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Agent } from '../agent';

vi.mock('@agntk/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    time: vi.fn(() => vi.fn()),
  }),
}));

import { createTeam } from '../workflow/team/create-team';
import { TaskBoard } from '../workflow/team/task-board';
import { createTeamTools } from '../workflow/team/tools';
import type { TeamConfig, TeamMemberConfig } from '../workflow/team/types';

// ============================================================================
// Helpers
// ============================================================================

function createMockAgent(textFn: (prompt: string) => string = () => 'agent output'): Agent {
  return {
    agentId: 'test-agent',
    role: 'generic',
    stream: vi.fn(),
    generate: vi.fn().mockImplementation(async ({ prompt }: { prompt: string }) => ({
      text: textFn(prompt),
      steps: [],
      totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    })),
    getToolLoopAgent: vi.fn(),
    getSystemPrompt: () => 'test prompt',
  } as unknown as Agent;
}

function createMember(name: string, textFn?: (prompt: string) => string): TeamMemberConfig {
  return {
    name,
    agent: createMockAgent(textFn),
    role: `${name} role`,
  };
}

// ============================================================================
// TaskBoard
// ============================================================================

describe('TaskBoard', () => {
  it('should initialize with task definitions', () => {
    const board = new TaskBoard([
      { id: 'a', description: 'Task A' },
      { id: 'b', description: 'Task B' },
    ]);

    expect(board.getAll()).toHaveLength(2);
    expect(board.getCounts()).toEqual({ pending: 2, claimed: 0, completed: 0 });
  });

  it('should claim a pending task', () => {
    const board = new TaskBoard([{ id: 'a', description: 'Task A' }]);

    const claimed = board.claim('a', 'alice');
    expect(claimed).toBe(true);

    const all = board.getAll();
    expect(all[0].status).toBe('claimed');
    expect(all[0].claimedBy).toBe('alice');
  });

  it('should prevent double-claiming (atomic)', () => {
    const board = new TaskBoard([{ id: 'a', description: 'Task A' }]);

    const first = board.claim('a', 'alice');
    const second = board.claim('a', 'bob');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(board.getAll()[0].claimedBy).toBe('alice');
  });

  it('should complete a claimed task', () => {
    const board = new TaskBoard([{ id: 'a', description: 'Task A' }]);

    board.claim('a', 'alice');
    const completed = board.complete('a', 'result text');

    expect(completed).toBe(true);
    expect(board.getAll()[0].status).toBe('completed');
    expect(board.getAll()[0].result).toBe('result text');
  });

  it('should not complete a pending task', () => {
    const board = new TaskBoard([{ id: 'a', description: 'Task A' }]);
    expect(board.complete('a', 'result')).toBe(false);
  });

  it('should enforce dependency gating', () => {
    const board = new TaskBoard([
      { id: 'a', description: 'First' },
      { id: 'b', description: 'Second', dependsOn: ['a'] },
    ]);

    // Can't claim b until a is completed
    expect(board.claim('b', 'alice')).toBe(false);

    // Complete a
    board.claim('a', 'bob');
    board.complete('a', 'done');

    // Now b can be claimed
    expect(board.claim('b', 'alice')).toBe(true);
  });

  it('should track available tasks', () => {
    const board = new TaskBoard([
      { id: 'a', description: 'First' },
      { id: 'b', description: 'Second', dependsOn: ['a'] },
      { id: 'c', description: 'Third' },
    ]);

    // a and c are available; b depends on a
    const available = board.getAvailable();
    expect(available).toHaveLength(2);
    expect(available.map((t) => t.task.id)).toEqual(['a', 'c']);
  });

  it('should report isAllCompleted correctly', () => {
    const board = new TaskBoard([
      { id: 'a', description: 'Task A' },
    ]);

    expect(board.isAllCompleted()).toBe(false);

    board.claim('a', 'alice');
    board.complete('a', 'done');

    expect(board.isAllCompleted()).toBe(true);
  });

  it('should return true for empty board isAllCompleted', () => {
    const board = new TaskBoard([]);
    expect(board.isAllCompleted()).toBe(true);
  });

  it('should reject duplicate task IDs in addTask', () => {
    const board = new TaskBoard([{ id: 'a', description: 'Task A' }]);
    expect(() => board.addTask({ id: 'a', description: 'Duplicate' })).toThrow('already exists');
  });
});

// ============================================================================
// createTeam — basic
// ============================================================================

describe('createTeam', () => {
  it('should create a functioning team', () => {
    const team = createTeam({
      name: 'test-team',
      lead: createMember('lead'),
      members: [createMember('worker1'), createMember('worker2')],
    });

    expect(team.name).toBe('test-team');
    expect(team.memberCount).toBe(3);
    expect(team.getPhase()).toBe('planning');
  });

  it('should throw without a lead', () => {
    expect(() =>
      createTeam({
        name: 'bad',
        lead: undefined as unknown as TeamMemberConfig,
        members: [createMember('a')],
      }),
    ).toThrow('must have a lead');
  });

  it('should throw without members', () => {
    expect(() =>
      createTeam({
        name: 'bad',
        lead: createMember('lead'),
        members: [],
      }),
    ).toThrow('at least one member');
  });
});

// ============================================================================
// createTeam — messaging
// ============================================================================

describe('createTeam — messaging', () => {
  it('should send direct messages', () => {
    const team = createTeam({
      name: 'msg-team',
      lead: createMember('lead'),
      members: [createMember('alice'), createMember('bob')],
    });

    team.sendMessage('alice', 'bob', 'hello bob');

    const messages = team.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].from).toBe('alice');
    expect(messages[0].to).toBe('bob');
    expect(messages[0].content).toBe('hello bob');
  });

  it('should broadcast messages', () => {
    const team = createTeam({
      name: 'broadcast-team',
      lead: createMember('lead'),
      members: [createMember('a'), createMember('b')],
    });

    team.broadcast('lead', 'attention everyone');

    const messages = team.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].to).toBe('all');
  });

  it('should reject unknown sender', () => {
    const team = createTeam({
      name: 't',
      lead: createMember('lead'),
      members: [createMember('a')],
    });

    expect(() => team.sendMessage('unknown', 'a', 'hi')).toThrow('Unknown sender');
  });

  it('should reject unknown recipient', () => {
    const team = createTeam({
      name: 't',
      lead: createMember('lead'),
      members: [createMember('a')],
    });

    expect(() => team.sendMessage('a', 'unknown', 'hi')).toThrow('Unknown recipient');
  });
});

// ============================================================================
// createTeam — task claiming
// ============================================================================

describe('createTeam — task claiming', () => {
  it('should claim and complete tasks', () => {
    const team = createTeam({
      name: 'task-team',
      lead: createMember('lead'),
      members: [createMember('worker')],
      tasks: [{ id: 'task1', description: 'Do something' }],
    });

    const claimed = team.claimTask('task1', 'worker');
    expect(claimed).toBe(true);

    const completed = team.completeTask('task1', 'done');
    expect(completed).toBe(true);

    const board = team.getTaskBoard();
    expect(board[0].status).toBe('completed');
    expect(board[0].result).toBe('done');
  });

  it('should prevent double-claiming', () => {
    const team = createTeam({
      name: 'claim-team',
      lead: createMember('lead'),
      members: [createMember('a'), createMember('b')],
      tasks: [{ id: 'task1', description: 'Shared task' }],
    });

    const first = team.claimTask('task1', 'a');
    const second = team.claimTask('task1', 'b');

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it('should enforce dependency gating', () => {
    const team = createTeam({
      name: 'dep-team',
      lead: createMember('lead'),
      members: [createMember('worker')],
      tasks: [
        { id: 'research', description: 'Research' },
        { id: 'write', description: 'Write', dependsOn: ['research'] },
      ],
    });

    // Can't claim 'write' before 'research' is done
    expect(team.claimTask('write', 'worker')).toBe(false);

    // Complete research
    team.claimTask('research', 'worker');
    team.completeTask('research', 'research done');

    // Now write is available
    expect(team.claimTask('write', 'worker')).toBe(true);
  });
});

// ============================================================================
// createTeam — execution
// ============================================================================

describe('createTeam — execution', () => {
  it('should execute with task-based workflow', async () => {
    const team = createTeam({
      name: 'exec-team',
      lead: createMember('lead', () => 'plan: assign tasks'),
      members: [
        createMember('researcher', () => 'research results'),
        createMember('writer', () => 'written article'),
      ],
      tasks: [
        { id: 'research', description: 'Research the topic' },
        { id: 'write', description: 'Write the article', dependsOn: ['research'] },
      ],
    });

    const result = await team.execute({ prompt: 'quantum computing' });

    expect(result.text).toBeDefined();
    expect(typeof result.text).toBe('string');
    expect(team.getPhase()).toBe('completed');
  });

  it('should execute with prompt-based workflow (no tasks)', async () => {
    const team = createTeam({
      name: 'prompt-team',
      lead: createMember('lead', () => 'synthesized result'),
      members: [
        createMember('analyst', () => 'analysis done'),
        createMember('reviewer', () => 'review done'),
      ],
    });

    const result = await team.execute({ prompt: 'analyze this' });

    expect(result.text).toBeDefined();
    expect(team.getPhase()).toBe('completed');
  });

  it('should use custom synthesize function', async () => {
    const team = createTeam({
      name: 'synth-team',
      lead: createMember('lead', () => 'plan'),
      members: [createMember('a', () => 'output-a')],
      synthesize: (outputs) => outputs.map((o) => o.text).join(' + '),
    });

    const result = await team.execute({ prompt: 'task' });
    expect(result.text).toBe('output-a');
  });

  it('should satisfy Workflow interface (usable in pipeline)', async () => {
    // Import pipeline
    const { createPipeline } = await import('../workflow/builders/pipeline');
    const { asStep } = await import('../workflow/builders/adapt');

    const preprocessor = createMockAgent((p) => `preprocessed: ${p}`);

    const team = createTeam({
      name: 'pipeline-team',
      lead: createMember('lead', () => 'team result'),
      members: [createMember('worker', () => 'work output')],
    });

    // Team satisfies WorkflowStep via execute()
    const pipeline = createPipeline({
      name: 'team-pipeline',
      steps: [asStep(preprocessor), team],
    });

    const result = await pipeline.execute({ prompt: 'start' });
    expect(result.text).toBeDefined();
  });
});

// ============================================================================
// createTeam — snapshot
// ============================================================================

describe('createTeam — getPersistedSnapshot', () => {
  it('should capture full team state', async () => {
    const team = createTeam({
      name: 'snap-team',
      lead: createMember('lead'),
      members: [createMember('a'), createMember('b')],
      tasks: [
        { id: 't1', description: 'Task 1' },
        { id: 't2', description: 'Task 2' },
      ],
    });

    team.sendMessage('a', 'b', 'hello');
    team.claimTask('t1', 'a');

    const snapshot = team.getPersistedSnapshot();

    expect(snapshot.name).toBe('snap-team');
    expect(snapshot.phase).toBe('planning');
    expect(snapshot.members).toHaveLength(3);
    expect(snapshot.tasks).toHaveLength(2);
    expect(snapshot.messages).toHaveLength(1);
    expect(snapshot.members.find((m) => m.name === 'a')?.phase).toBe('working');
  });

  it('should include all teammate actor states', async () => {
    const team = createTeam({
      name: 'state-team',
      lead: createMember('lead', () => 'plan'),
      members: [
        createMember('alpha', () => 'alpha-done'),
        createMember('beta', () => 'beta-done'),
      ],
    });

    await team.execute({ prompt: 'go' });

    const snapshot = team.getPersistedSnapshot();
    expect(snapshot.phase).toBe('completed');
    for (const member of snapshot.members) {
      expect(member.phase).toBe('completed');
    }
  });
});

// ============================================================================
// Team tools
// ============================================================================

describe('createTeamTools', () => {
  it('should create all 6 tools', () => {
    const team = createTeam({
      name: 'tool-team',
      lead: createMember('lead'),
      members: [createMember('a')],
    });

    const tools = createTeamTools(team, 'a');

    expect(tools).toHaveProperty('team_message');
    expect(tools).toHaveProperty('team_broadcast');
    expect(tools).toHaveProperty('team_tasks');
    expect(tools).toHaveProperty('team_claim');
    expect(tools).toHaveProperty('team_complete');
    expect(tools).toHaveProperty('team_status');
  });
});
