/**
 * @agent/sdk - Agent → WorkflowStep Adapter
 *
 * Converts an Agent to a WorkflowStep so agents and workflows are interchangeable.
 */

import type { Agent } from '../../agent';
import type { WorkflowStep, WorkflowInput, WorkflowOutput } from './types';

/**
 * Adapt an Agent to a WorkflowStep.
 * The agent's generate() method is called with the workflow input prompt.
 *
 * @example
 * ```typescript
 * const pipeline = createPipeline({
 *   steps: [asStep(researchAgent), asStep(writerAgent)],
 * });
 * ```
 */
export function asStep(agent: Agent): WorkflowStep {
  return {
    async execute(input: WorkflowInput): Promise<WorkflowOutput> {
      const result = await agent.generate({ prompt: input.prompt });
      return {
        text: result.text ?? '',
        metadata: {
          agentId: agent.agentId,
          role: agent.role,
          steps: result.steps?.length ?? 0,
          usage: result.totalUsage,
        },
      };
    },
  };
}
