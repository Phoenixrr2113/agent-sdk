/**
 * @agntk/core - Progress Tracking Tools
 *
 * Manages a progress.json file in the workspace for long-running agents
 * to track task completion across sessions. Session log is append-only.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { tool } from 'ai';
import { z } from 'zod';
import { createLogger } from '@agntk/logger';

const log = createLogger('@agntk/core:progress');

// ============================================================================
// Types
// ============================================================================

/** Status of a tracked feature/task. */
export type FeatureStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** A tracked feature or task in the progress file. */
export interface ProgressFeature {
  id: string;
  name: string;
  status: FeatureStatus;
  description?: string;
  updatedAt: string;
  notes?: string;
}

/** A session log entry (append-only). */
export interface SessionLogEntry {
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  actions: string[];
}

/** The full progress.json structure. */
export interface ProgressData {
  version: 1;
  features: ProgressFeature[];
  sessions: SessionLogEntry[];
}

// ============================================================================
// File Operations
// ============================================================================

const PROGRESS_FILENAME = 'progress.json';

function getProgressPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, PROGRESS_FILENAME);
}

function readProgressFile(workspaceRoot: string): ProgressData {
  const filePath = getProgressPath(workspaceRoot);

  if (!fs.existsSync(filePath)) {
    return { version: 1, features: [], sessions: [] };
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ProgressData;
    // Validate structure
    if (!data.version || !Array.isArray(data.features) || !Array.isArray(data.sessions)) {
      log.warn('Invalid progress.json structure, returning empty');
      return { version: 1, features: [], sessions: [] };
    }
    return data;
  } catch (error) {
    log.warn('Failed to read progress.json', { error: String(error) });
    return { version: 1, features: [], sessions: [] };
  }
}

function writeProgressFile(workspaceRoot: string, data: ProgressData): void {
  const filePath = getProgressPath(workspaceRoot);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ============================================================================
// Tool Factory
// ============================================================================

/**
 * Create progress tracking tools.
 *
 * @example
 * ```typescript
 * const tools = createProgressTools('/my/project');
 * // Returns { progress_read, progress_update }
 * ```
 */
export function createProgressTools(workspaceRoot: string) {
  const progress_read = tool({
    description: `Read the current progress tracking data (features, session logs). Use this at the start of a session to understand what has been completed and what remains.`,
    inputSchema: z.object({}),
    execute: async () => {
      log.debug('progress_read called');
      try {
        const data = readProgressFile(workspaceRoot);
        const summary = {
          totalFeatures: data.features.length,
          pending: data.features.filter(f => f.status === 'pending').length,
          inProgress: data.features.filter(f => f.status === 'in_progress').length,
          completed: data.features.filter(f => f.status === 'completed').length,
          blocked: data.features.filter(f => f.status === 'blocked').length,
          totalSessions: data.sessions.length,
        };
        return JSON.stringify({ success: true, summary, data });
      } catch (error) {
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  const progress_update = tool({
    description: `Update progress tracking: add/update features, log session actions. Features are upserted by ID. Session log is append-only.`,
    inputSchema: z.object({
      featureId: z.string().optional().describe('Feature ID to add or update'),
      featureName: z.string().optional().describe('Feature name (required when adding)'),
      featureStatus: z.enum(['pending', 'in_progress', 'completed', 'blocked']).optional().describe('Feature status'),
      featureDescription: z.string().optional().describe('Feature description'),
      featureNotes: z.string().optional().describe('Notes about the feature update'),
      sessionId: z.string().optional().describe('Session ID for logging an action'),
      action: z.string().optional().describe('Action to log in the session'),
    }),
    execute: async ({ featureId, featureName, featureStatus, featureDescription, featureNotes, sessionId, action }) => {
      log.debug('progress_update called', { featureId, featureStatus, sessionId });
      try {
        const data = readProgressFile(workspaceRoot);
        const now = new Date().toISOString();

        // Upsert feature if featureId provided
        if (featureId) {
          const existing = data.features.find(f => f.id === featureId);
          if (existing) {
            if (featureStatus) existing.status = featureStatus;
            if (featureName) existing.name = featureName;
            if (featureDescription !== undefined) existing.description = featureDescription;
            if (featureNotes !== undefined) existing.notes = featureNotes;
            existing.updatedAt = now;
          } else {
            data.features.push({
              id: featureId,
              name: featureName ?? featureId,
              status: featureStatus ?? 'pending',
              description: featureDescription,
              notes: featureNotes,
              updatedAt: now,
            });
          }
        }

        // Append to session log if sessionId + action provided
        if (sessionId && action) {
          let session = data.sessions.find(s => s.sessionId === sessionId);
          if (!session) {
            session = { sessionId, startedAt: now, actions: [] };
            data.sessions.push(session);
          }
          session.actions.push(`[${now}] ${action}`);
        }

        writeProgressFile(workspaceRoot, data);

        return JSON.stringify({
          success: true,
          message: featureId
            ? `Feature '${featureId}' updated to '${featureStatus ?? 'unchanged'}'`
            : 'Session log updated',
        });
      } catch (error) {
        return JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Failed' });
      }
    },
  });

  return { progress_read, progress_update };
}

// Re-export types
export type { ProgressData as ProgressFileData };
