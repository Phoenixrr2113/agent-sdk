/**
 * @agntk/core - Parallel Workflow Builder
 *
 * Fan out to multiple agents/workflows concurrently,
 * then synthesize the results.
 */

import { createLogger } from '@agntk/logger';
import type { Workflow, WorkflowInput, WorkflowOutput, ParallelConfig } from './types';

const log = createLogger('@agntk/core:workflow:parallel');

/**
 * Create a parallel workflow that fans out to multiple steps concurrently.
 * All steps receive the same input prompt. Results are merged by the synthesize function.
 *
 * @example
 * ```typescript
 * const parallel = createParallel({
 *   name: 'multi-analysis',
 *   steps: [securityAgent, performanceAgent, codeQualityAgent],
 *   synthesize: (outputs) => ({
 *     text: outputs.map(o => o.text).join('\n\n---\n\n'),
 *   }),
 * });
 * const result = await parallel.execute({ prompt: 'Analyze this codebase' });
 * ```
 */
export function createParallel(config: ParallelConfig): Workflow {
  const { name = 'parallel', steps, synthesize } = config;

  if (steps.length === 0) {
    throw new Error('Parallel workflow must have at least one step');
  }

  return {
    name,
    stepCount: steps.length,

    async execute(input: WorkflowInput): Promise<WorkflowOutput> {
      log.info('Parallel started', { name, stepCount: steps.length, promptLength: input.prompt.length });

      const results = await Promise.allSettled(
        steps.map((step, i) => {
          log.debug('Parallel step launched', { name, step: i + 1 });
          return step.execute(input);
        }),
      );

      const outputs: WorkflowOutput[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled') {
          outputs.push(result.value);
        } else {
          log.error('Parallel step failed', { name, step: i + 1, error: String(result.reason) });
          outputs.push({
            text: `[Step ${i + 1} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}]`,
            metadata: { error: true },
          });
        }
      }

      log.debug('Synthesizing parallel outputs', { name, outputCount: outputs.length });
      const synthesized = await synthesize(outputs);

      log.info('Parallel completed', { name, textLength: synthesized.text.length });

      return synthesized;
    },
  };
}
