/**
 * @fileoverview Types for workflow builders (Pipeline, Parallel).
 */

/**
 * A Workflow step that can execute with a prompt and return text.
 * Compatible with the Agent interface so agents and workflows are interchangeable.
 */
export interface WorkflowStep {
  /** Execute the step with a prompt. */
  execute: (input: WorkflowInput) => Promise<WorkflowOutput>;
}

/** Input to a workflow step. */
export interface WorkflowInput {
  prompt: string;
}

/** Output from a workflow step. */
export interface WorkflowOutput {
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * A Workflow that composes multiple steps.
 * Implements WorkflowStep so it can nest inside other workflows.
 */
export interface Workflow extends WorkflowStep {
  /** Name of this workflow. */
  name: string;
  /** Number of steps in this workflow. */
  stepCount: number;
}

/**
 * Synthesize function for parallel workflows.
 * Receives all outputs and produces a merged result.
 */
export type SynthesizeFn = (outputs: WorkflowOutput[]) => WorkflowOutput | Promise<WorkflowOutput>;

/** Configuration for createPipeline. */
export interface PipelineConfig {
  /** Pipeline name. */
  name?: string;
  /** Steps to execute sequentially. */
  steps: WorkflowStep[];
  /** Optional transform between steps (receives previous output, returns next prompt). */
  transform?: (output: WorkflowOutput, stepIndex: number) => string;
}

/** Configuration for createParallel. */
export interface ParallelConfig {
  /** Parallel workflow name. */
  name?: string;
  /** Steps to execute concurrently. */
  steps: WorkflowStep[];
  /** Function to synthesize/merge parallel outputs. */
  synthesize: SynthesizeFn;
}
