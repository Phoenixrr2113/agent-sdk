/**
 * @fileoverview Task board with dependency DAG for team coordination.
 * Provides atomic task claiming and dependency gating.
 */

import type { TaskDefinition, TaskState } from './types';

export class TaskBoard {
  private tasks = new Map<string, TaskState>();

  constructor(definitions: TaskDefinition[] = []) {
    for (const task of definitions) {
      this.tasks.set(task.id, {
        task,
        status: 'pending',
      });
    }
  }

  /**
   * Add a task to the board.
   */
  addTask(task: TaskDefinition): void {
    if (this.tasks.has(task.id)) {
      throw new Error(`Task "${task.id}" already exists on the board.`);
    }
    this.tasks.set(task.id, { task, status: 'pending' });
  }

  /**
   * Attempt to claim a task (atomic — no double-claim).
   * Returns true if claimed successfully, false otherwise.
   */
  claim(taskId: string, memberName: string): boolean {
    const entry = this.tasks.get(taskId);
    if (!entry) return false;
    if (entry.status !== 'pending') return false;

    // Check dependency gating
    if (!this.areDependenciesMet(entry.task)) return false;

    // Atomic claim
    entry.status = 'claimed';
    entry.claimedBy = memberName;
    entry.claimedAt = Date.now();
    return true;
  }

  /**
   * Complete a claimed task with a result.
   */
  complete(taskId: string, result: string): boolean {
    const entry = this.tasks.get(taskId);
    if (!entry) return false;
    if (entry.status !== 'claimed') return false;

    entry.status = 'completed';
    entry.result = result;
    entry.completedAt = Date.now();
    return true;
  }

  /**
   * Check if all dependencies for a task are completed.
   */
  areDependenciesMet(task: TaskDefinition): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) return true;

    return task.dependsOn.every((depId) => {
      const dep = this.tasks.get(depId);
      return dep?.status === 'completed';
    });
  }

  /**
   * Get all available (claimable) tasks.
   */
  getAvailable(): TaskState[] {
    return this.getAll().filter(
      (entry) => entry.status === 'pending' && this.areDependenciesMet(entry.task),
    );
  }

  /**
   * Get all tasks.
   */
  getAll(): TaskState[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Check if all tasks are completed.
   */
  isAllCompleted(): boolean {
    if (this.tasks.size === 0) return true;
    return Array.from(this.tasks.values()).every((t) => t.status === 'completed');
  }

  /**
   * Get task count by status.
   */
  getCounts(): { pending: number; claimed: number; completed: number } {
    let pending = 0;
    let claimed = 0;
    let completed = 0;

    for (const entry of this.tasks.values()) {
      switch (entry.status) {
        case 'pending':
          pending++;
          break;
        case 'claimed':
          claimed++;
          break;
        case 'completed':
          completed++;
          break;
      }
    }

    return { pending, claimed, completed };
  }
}
