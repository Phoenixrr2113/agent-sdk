/**
 * @agntk/core - Evals Framework Types
 */

import type { StepResult, ToolSet } from 'ai';
import type { Agent } from '../agent';

// ============================================================================
// Core Types
// ============================================================================

/** Result of a single eval case. */
export interface EvalCaseResult {
  name: string;
  passed: boolean;
  duration: number;
  assertions: AssertionResult[];
  error?: string;
}

/** Result of a single assertion check. */
export interface AssertionResult {
  name: string;
  passed: boolean;
  message?: string;
}

/** A single eval case definition. */
export interface EvalCase {
  name: string;
  prompt: string;
  assertions: Assertion[];
  /** Timeout in ms. Default: 30000 */
  timeout?: number;
}

/** An assertion function that checks agent output. */
export interface Assertion {
  name: string;
  check: (result: EvalAgentResult) => AssertionResult | Promise<AssertionResult>;
}

/** Agent execution result passed to assertions. */
export interface EvalAgentResult {
  text: string;
  steps: StepResult<ToolSet>[];
  totalUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

/** Eval suite configuration. */
export interface EvalSuiteConfig {
  name: string;
  agent: Agent;
  cases: EvalCase[];
  /** Max concurrent eval cases. Default: 1 */
  maxConcurrency?: number;
  /** Reporter for results. Default: 'console' */
  reporter?: 'console' | 'json' | EvalReporter;
}

/** Eval suite runner result. */
export interface EvalSuiteResult {
  name: string;
  totalCases: number;
  passed: number;
  failed: number;
  duration: number;
  cases: EvalCaseResult[];
}

/** Custom reporter interface. */
export interface EvalReporter {
  onCaseStart?: (caseName: string) => void;
  onCaseEnd?: (result: EvalCaseResult) => void;
  onSuiteEnd?: (result: EvalSuiteResult) => void;
}
