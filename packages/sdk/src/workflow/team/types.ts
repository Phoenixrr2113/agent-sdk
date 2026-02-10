/**
 * @fileoverview Types for the Team coordination system.
 */

import type { Agent } from '../../agent';
import type { WorkflowStep, WorkflowOutput } from '../builders/types';

// ============================================================================
// Team Configuration
// ============================================================================

/** Configuration for creating a team. */
export interface TeamConfig {
  /** Team name. */
  name: string;
  /** The lead agent that coordinates the team. */
  lead: TeamMemberConfig;
  /** Team member configurations. */
  members: TeamMemberConfig[];
  /** Initial tasks for the task board. */
  tasks?: TaskDefinition[];
  /** Function to synthesize the final result from all completed outputs. */
  synthesize?: (outputs: TeamOutput[]) => string | Promise<string>;
}

/** Configuration for a team member (lead or member). */
export interface TeamMemberConfig {
  /** Unique name for this team member. */
  name: string;
  /** The agent instance or factory. */
  agent: Agent;
  /** Role description for this member. */
  role?: string;
}

// ============================================================================
// Task Board
// ============================================================================

/** A task definition on the team task board. */
export interface TaskDefinition {
  /** Unique task ID. */
  id: string;
  /** Task description. */
  description: string;
  /** Task IDs that must be completed before this task can be claimed. */
  dependsOn?: string[];
}

/** Runtime state of a task on the board. */
export interface TaskState {
  /** Task definition. */
  task: TaskDefinition;
  /** Current status. */
  status: 'pending' | 'claimed' | 'completed';
  /** Name of the member who claimed this task. */
  claimedBy?: string;
  /** Result produced by the member. */
  result?: string;
  /** When the task was claimed. */
  claimedAt?: number;
  /** When the task was completed. */
  completedAt?: number;
}

// ============================================================================
// Messages
// ============================================================================

/** A message between team members. */
export interface TeamMessage {
  /** Sender name. */
  from: string;
  /** Recipient name (or 'all' for broadcast). */
  to: string;
  /** Message content. */
  content: string;
  /** When the message was sent. */
  timestamp: number;
}

// ============================================================================
// Team Output
// ============================================================================

/** Output from a team member's work. */
export interface TeamOutput {
  /** Member name. */
  memberName: string;
  /** Task ID (if task-based). */
  taskId?: string;
  /** The output text. */
  text: string;
}

// ============================================================================
// Team Lifecycle States
// ============================================================================

export type TeamPhase = 'planning' | 'executing' | 'synthesizing' | 'completed' | 'error';
export type TeammatePhase = 'idle' | 'working' | 'completed' | 'error';

// ============================================================================
// Team (public interface)
// ============================================================================

/** A Team that satisfies the Workflow interface. */
export interface Team extends WorkflowStep {
  /** Team name. */
  name: string;
  /** Number of members (including lead). */
  memberCount: number;
  /** Get the current task board state. */
  getTaskBoard(): TaskState[];
  /** Get all messages exchanged. */
  getMessages(): TeamMessage[];
  /** Get the team's current phase. */
  getPhase(): TeamPhase;
  /** Send a direct message between members. */
  sendMessage(from: string, to: string, content: string): void;
  /** Broadcast a message to all members. */
  broadcast(from: string, content: string): void;
  /** Claim a task from the board. */
  claimTask(taskId: string, memberName: string): boolean;
  /** Complete a task with a result. */
  completeTask(taskId: string, result: string): boolean;
  /** Get a serializable snapshot of the team state. */
  getPersistedSnapshot(): TeamSnapshot;
}

/** Serializable team state snapshot. */
export interface TeamSnapshot {
  name: string;
  phase: TeamPhase;
  members: Array<{ name: string; phase: TeammatePhase }>;
  tasks: TaskState[];
  messages: TeamMessage[];
  outputs: TeamOutput[];
}
