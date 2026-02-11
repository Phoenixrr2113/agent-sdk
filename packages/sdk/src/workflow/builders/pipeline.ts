/**
 * @agntk/core - Pipeline Workflow Builder
 *
 * Chain agents/workflows sequentially. Each step's output
 * becomes the next step's input prompt.
 */

import { createLogger } from '@agntk/logger';
import type { Workflow, WorkflowInput, WorkflowOutput, PipelineConfig } from './types';

const log = createLogger('@agntk/core:workflow:pipeline');

/**
 * Create a pipeline that chains steps sequentially.
 * Each step's text output becomes the next step's prompt.
 *
 * @example
 * ```typescript
 * const pipeline = createPipeline({
 *   name: 'research-then-write',
 *   steps: [researchAgent, writerAgent],
 * });
 * const result = await pipeline.execute({ prompt: 'Write about quantum computing' });
 * ```
 */
export function createPipeline(config: PipelineConfig): Workflow {
  const { name = 'pipeline', steps, transform } = config;

  if (steps.length === 0) {
    throw new Error('Pipeline must have at least one step');
  }

  return {
    name,
    stepCount: steps.length,

    async execute(input: WorkflowInput): Promise<WorkflowOutput> {
      log.info('Pipeline started', { name, stepCount: steps.length, promptLength: input.prompt.length });

      let currentOutput: WorkflowOutput = { text: input.prompt };

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const prompt = i === 0
          ? input.prompt
          : transform
            ? transform(currentOutput, i)
            : currentOutput.text;

        log.debug('Pipeline step', { name, step: i + 1, total: steps.length, promptLength: prompt.length });

        currentOutput = await step.execute({ prompt });
      }

      log.info('Pipeline completed', { name, textLength: currentOutput.text.length });

      return currentOutput;
    },
  };
}
