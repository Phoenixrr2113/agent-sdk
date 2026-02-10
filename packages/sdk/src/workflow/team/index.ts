/**
 * @fileoverview Team module barrel exports.
 */

export { createTeam } from './create-team';
export { TaskBoard } from './task-board';
export { createTeamTools } from './tools';
export { teamCoordinationMachine, teammateMachine } from './machines';
export type {
  TeamConfig,
  TeamMemberConfig,
  Team,
  TeamPhase,
  TeammatePhase,
  TeamMessage,
  TeamOutput,
  TaskDefinition,
  TaskState,
  TeamSnapshot,
} from './types';
