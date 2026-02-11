/**
 * @agntk/core - Evals Framework
 *
 * Build eval suites to test agent behavior with assertions.
 */

export { createEvalSuite } from './runner';
export {
  toolCalled,
  noToolCalled,
  toolCalledTimes,
  outputMatches,
  outputContains,
  stepCount,
  tokenUsage,
  llmJudge,
  custom,
} from './assertions';
export type {
  EvalSuiteConfig,
  EvalSuiteResult,
  EvalCaseResult,
  EvalCase,
  EvalAgentResult,
  Assertion,
  AssertionResult,
  EvalReporter,
} from './types';
