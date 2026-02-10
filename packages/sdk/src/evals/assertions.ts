/**
 * @agent/sdk - Eval Assertions Library
 *
 * Built-in assertions for agent eval suites.
 */

import type { LanguageModel } from 'ai';
import type { Assertion, AssertionResult, EvalAgentResult } from './types';

// ============================================================================
// Tool Assertions
// ============================================================================

/**
 * Assert that a specific tool was called at least once.
 */
export function toolCalled(toolName: string): Assertion {
  return {
    name: `toolCalled(${toolName})`,
    check: (result) => {
      const called = result.steps.some(
        (step) => step.toolCalls?.some((tc) => tc.toolName === toolName),
      );
      return {
        name: `toolCalled(${toolName})`,
        passed: called,
        message: called ? undefined : `Tool '${toolName}' was not called`,
      };
    },
  };
}

/**
 * Assert that a specific tool was NOT called.
 */
export function noToolCalled(toolName: string): Assertion {
  return {
    name: `noToolCalled(${toolName})`,
    check: (result) => {
      const called = result.steps.some(
        (step) => step.toolCalls?.some((tc) => tc.toolName === toolName),
      );
      return {
        name: `noToolCalled(${toolName})`,
        passed: !called,
        message: called ? `Tool '${toolName}' was unexpectedly called` : undefined,
      };
    },
  };
}

/**
 * Assert that a tool was called a specific number of times.
 */
export function toolCalledTimes(toolName: string, expectedCount: number): Assertion {
  return {
    name: `toolCalledTimes(${toolName}, ${expectedCount})`,
    check: (result) => {
      let count = 0;
      for (const step of result.steps) {
        if (step.toolCalls) {
          count += step.toolCalls.filter((tc) => tc.toolName === toolName).length;
        }
      }
      return {
        name: `toolCalledTimes(${toolName}, ${expectedCount})`,
        passed: count === expectedCount,
        message: count !== expectedCount ? `Expected ${expectedCount} calls, got ${count}` : undefined,
      };
    },
  };
}

// ============================================================================
// Output Assertions
// ============================================================================

/**
 * Assert that the output matches a regex pattern.
 */
export function outputMatches(pattern: RegExp): Assertion {
  return {
    name: `outputMatches(${pattern})`,
    check: (result) => {
      const matches = pattern.test(result.text);
      return {
        name: `outputMatches(${pattern})`,
        passed: matches,
        message: matches ? undefined : `Output did not match ${pattern}`,
      };
    },
  };
}

/**
 * Assert that the output contains a specific string.
 */
export function outputContains(text: string): Assertion {
  return {
    name: `outputContains("${text.slice(0, 30)}")`,
    check: (result) => {
      const contains = result.text.includes(text);
      return {
        name: `outputContains("${text.slice(0, 30)}")`,
        passed: contains,
        message: contains ? undefined : `Output does not contain "${text.slice(0, 50)}"`,
      };
    },
  };
}

// ============================================================================
// Step / Usage Assertions
// ============================================================================

/**
 * Assert the number of steps is within a range.
 */
export function stepCount(min: number, max?: number): Assertion {
  const desc = max !== undefined ? `stepCount(${min}-${max})` : `stepCount(>=${min})`;
  return {
    name: desc,
    check: (result) => {
      const count = result.steps.length;
      const inRange = max !== undefined ? count >= min && count <= max : count >= min;
      return {
        name: desc,
        passed: inRange,
        message: inRange ? undefined : `Step count ${count} not in range [${min}, ${max ?? '∞'}]`,
      };
    },
  };
}

/**
 * Assert total token usage is within a budget.
 */
export function tokenUsage(maxTokens: number): Assertion {
  return {
    name: `tokenUsage(<=${maxTokens})`,
    check: (result) => {
      const total = result.totalUsage.totalTokens ?? 0;
      const withinBudget = total <= maxTokens;
      return {
        name: `tokenUsage(<=${maxTokens})`,
        passed: withinBudget,
        message: withinBudget ? undefined : `Total tokens ${total} exceeds budget ${maxTokens}`,
      };
    },
  };
}

// ============================================================================
// LLM Judge
// ============================================================================

/**
 * Assert output quality using an LLM judge.
 *
 * The judge model receives the prompt, output, and criteria, then
 * returns PASS/FAIL with reasoning.
 */
export function llmJudge(options: {
  model: LanguageModel;
  criteria: string;
  name?: string;
}): Assertion {
  const { model, criteria, name: assertionName } = options;
  return {
    name: assertionName ?? `llmJudge("${criteria.slice(0, 30)}")`,
    check: async (result) => {
      try {
        // Dynamic import to avoid hard dependency on ai's generateText
        const { generateText } = await import('ai');
        const judgeResult = await generateText({
          model,
          prompt: `You are an evaluation judge. Given an agent's output, determine if it meets the criteria.

Criteria: ${criteria}

Agent output:
${result.text.slice(0, 2000)}

Respond with EXACTLY one line: "PASS" or "FAIL: <reason>"`,
          maxOutputTokens: 200,
        });

        const verdict = judgeResult.text.trim();
        const passed = verdict.startsWith('PASS');
        return {
          name: assertionName ?? `llmJudge("${criteria.slice(0, 30)}")`,
          passed,
          message: passed ? undefined : verdict,
        };
      } catch (error) {
        return {
          name: assertionName ?? `llmJudge("${criteria.slice(0, 30)}")`,
          passed: false,
          message: `LLM judge failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    },
  };
}

// ============================================================================
// Custom Assertion
// ============================================================================

/**
 * Create a custom assertion from a function.
 */
export function custom(
  name: string,
  checkFn: (result: EvalAgentResult) => boolean | { passed: boolean; message?: string },
): Assertion {
  return {
    name,
    check: (result) => {
      const outcome = checkFn(result);
      if (typeof outcome === 'boolean') {
        return { name, passed: outcome };
      }
      return { name, ...outcome };
    },
  };
}
