/**
 * @agntk/core - Best-of-N Test-Time Scaling
 *
 * Run an agent N times and pick the best output via LLM judge.
 * Supports parallel/sequential execution, list-wise/pair-wise judging,
 * and budget caps via UsageLimits.
 */

import { createLogger } from '@agntk/logger';
import type { LanguageModel } from 'ai';
import type { Agent } from '../types/agent';
import type { UsageLimits } from '../usage-limits';

const log = createLogger('@agntk/core:best-of-n');

// ============================================================================
// Types
// ============================================================================

export interface BestOfNConfig {
  /** Number of times to run the agent. */
  n: number;
  /** Judge model for ranking outputs. */
  judgeModel: LanguageModel;
  /** Judging strategy. 'list-wise' ranks all at once; 'pair-wise' does tournament. Default: 'list-wise'. */
  strategy?: 'list-wise' | 'pair-wise';
  /** Run agent instances in parallel or sequentially. Default: 'parallel'. */
  execution?: 'parallel' | 'sequential';
  /** Criteria for the judge to evaluate outputs against. */
  criteria: string;
  /** Optional budget cap. Stops early if total tokens across all runs exceed this. */
  budget?: UsageLimits;
}

export interface BestOfNCandidate {
  /** The output text from this run. */
  text: string;
  /** The score assigned by the judge (higher is better). */
  score: number;
  /** Index of this candidate (0-based). */
  index: number;
  /** Token usage for this run. */
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}

export interface BestOfNResult {
  /** The winning candidate. */
  best: BestOfNCandidate;
  /** All candidates with scores. */
  candidates: BestOfNCandidate[];
  /** Total token usage across all agent runs. */
  totalUsage: { inputTokens: number; outputTokens: number; totalTokens: number };
  /** Whether the run was stopped early due to budget. */
  budgetExceeded: boolean;
  /** Number of candidates actually generated (may be < n if budget exceeded). */
  runsCompleted: number;
}

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * Run an agent N times and pick the best output via LLM judge.
 *
 * @example
 * ```typescript
 * const result = await withBestOfN(agent, 'Write a haiku about coding', {
 *   n: 3,
 *   judgeModel: myModel,
 *   criteria: 'Quality, creativity, and adherence to haiku format',
 * });
 * console.log(result.best.text); // Best haiku
 * ```
 */
export async function withBestOfN(
  agent: Agent,
  prompt: string,
  config: BestOfNConfig,
): Promise<BestOfNResult> {
  const {
    n,
    judgeModel,
    strategy = 'list-wise',
    execution = 'parallel',
    criteria,
    budget,
  } = config;

  log.info('Starting best-of-N', { n, strategy, execution, criteria: criteria.slice(0, 50) });

  // Generate candidates
  const candidates: BestOfNCandidate[] = [];
  const totalUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let budgetExceeded = false;

  if (execution === 'parallel') {
    const promises = Array.from({ length: n }, (_, i) => generateCandidate(agent, prompt, i));
    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        candidates.push(result.value);
        if (result.value.usage) {
          totalUsage.inputTokens += result.value.usage.inputTokens;
          totalUsage.outputTokens += result.value.usage.outputTokens;
          totalUsage.totalTokens += result.value.usage.totalTokens;
        }
      }
    }
  } else {
    // Sequential with budget check
    for (let i = 0; i < n; i++) {
      if (budget && isOverBudget(totalUsage, budget)) {
        budgetExceeded = true;
        log.info('Budget exceeded, stopping early', { runsCompleted: i, totalUsage });
        break;
      }

      const candidate = await generateCandidate(agent, prompt, i);
      if (candidate) {
        candidates.push(candidate);
        if (candidate.usage) {
          totalUsage.inputTokens += candidate.usage.inputTokens;
          totalUsage.outputTokens += candidate.usage.outputTokens;
          totalUsage.totalTokens += candidate.usage.totalTokens;
        }
      }
    }
  }

  if (candidates.length === 0) {
    throw new Error('All agent runs failed — no candidates generated');
  }

  if (candidates.length === 1) {
    candidates[0].score = 1;
    return {
      best: candidates[0],
      candidates,
      totalUsage,
      budgetExceeded,
      runsCompleted: candidates.length,
    };
  }

  // Judge candidates
  log.info('Judging candidates', { count: candidates.length, strategy });

  let scoredCandidates: BestOfNCandidate[];
  if (strategy === 'pair-wise') {
    scoredCandidates = await pairWiseJudge(candidates, judgeModel, criteria);
  } else {
    scoredCandidates = await listWiseJudge(candidates, judgeModel, criteria);
  }

  // Sort by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  const result: BestOfNResult = {
    best: scoredCandidates[0],
    candidates: scoredCandidates,
    totalUsage,
    budgetExceeded,
    runsCompleted: candidates.length,
  };

  log.info('Best-of-N complete', {
    bestIndex: result.best.index,
    bestScore: result.best.score,
    runsCompleted: result.runsCompleted,
  });

  return result;
}

// ============================================================================
// Candidate Generation
// ============================================================================

async function generateCandidate(
  agent: Agent,
  prompt: string,
  index: number,
): Promise<BestOfNCandidate | null> {
  try {
    const result = await agent.stream({ prompt });
    // Consume the stream to get the final text
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _chunk of result.fullStream) { /* drain */ }
    const text = await result.text;
    const usage = await result.usage;
    return {
      text: text ?? '',
      score: 0,
      index,
      usage: usage
        ? {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            totalTokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
          }
        : undefined,
    };
  } catch (error) {
    log.error('Candidate generation failed', { index, error: String(error) });
    return null;
  }
}

// ============================================================================
// List-Wise Judge
// ============================================================================

/**
 * Rank all candidates at once using a single LLM call.
 * Returns candidates with scores assigned.
 */
async function listWiseJudge(
  candidates: BestOfNCandidate[],
  model: LanguageModel,
  criteria: string,
): Promise<BestOfNCandidate[]> {
  const { generateText } = await import('ai');

  const outputList = candidates
    .map((c, i) => `--- Output ${i + 1} ---\n${c.text.slice(0, 2000)}\n`)
    .join('\n');

  const judgePrompt = `You are a judge evaluating ${candidates.length} outputs for the same task.

Criteria: ${criteria}

${outputList}

Rank ALL outputs from best to worst. Respond with EXACTLY one line per output in the format:
OUTPUT_NUMBER:SCORE

Where SCORE is 1-10 (10 = best). Example for 3 outputs:
2:9
1:7
3:4`;

  try {
    const result = await generateText({
      model,
      prompt: judgePrompt,
      maxOutputTokens: 500,
    });

    const scored = [...candidates];
    const lines = result.text.trim().split('\n');

    for (const line of lines) {
      const match = line.match(/(\d+)\s*:\s*(\d+)/);
      if (match) {
        const outputNum = parseInt(match[1], 10) - 1; // 0-indexed
        const score = parseInt(match[2], 10);
        if (outputNum >= 0 && outputNum < scored.length) {
          scored[outputNum].score = score;
        }
      }
    }

    return scored;
  } catch (error) {
    log.error('List-wise judge failed', { error: String(error) });
    // Fallback: assign equal scores
    return candidates.map((c) => ({ ...c, score: 5 }));
  }
}

// ============================================================================
// Pair-Wise Judge
// ============================================================================

/**
 * Tournament-style judging: compare pairs and accumulate wins as scores.
 */
async function pairWiseJudge(
  candidates: BestOfNCandidate[],
  model: LanguageModel,
  criteria: string,
): Promise<BestOfNCandidate[]> {
  const { generateText } = await import('ai');
  const scores = new Array(candidates.length).fill(0);

  // Compare all pairs
  const comparisons: Array<[number, number]> = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      comparisons.push([i, j]);
    }
  }

  // Run comparisons in parallel
  await Promise.all(
    comparisons.map(async ([i, j]) => {
      try {
        const result = await generateText({
          model,
          prompt: `You are a judge comparing two outputs for the same task.

Criteria: ${criteria}

--- Output A ---
${candidates[i].text.slice(0, 2000)}

--- Output B ---
${candidates[j].text.slice(0, 2000)}

Which output is better based on the criteria? Respond with EXACTLY one word: "A" or "B"`,
          maxOutputTokens: 10,
        });

        const verdict = result.text.trim().toUpperCase();
        if (verdict === 'A' || verdict.startsWith('A')) {
          scores[i]++;
        } else {
          scores[j]++;
        }
      } catch (error) {
        log.error('Pair-wise comparison failed', { i, j, error: String(error) });
        // Tie — both get a point
        scores[i] += 0.5;
        scores[j] += 0.5;
      }
    }),
  );

  return candidates.map((c, i) => ({ ...c, score: scores[i] }));
}

// ============================================================================
// Budget Check
// ============================================================================

function isOverBudget(
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  limits: UsageLimits,
): boolean {
  if (limits.maxTotalTokens && usage.totalTokens >= limits.maxTotalTokens) return true;
  if (limits.maxInputTokens && usage.inputTokens >= limits.maxInputTokens) return true;
  if (limits.maxOutputTokens && usage.outputTokens >= limits.maxOutputTokens) return true;
  return false;
}
