/**
 * @agntk/core - File Tool Implementations
 *
 * Provides file_read, file_write, file_edit, file_create tools.
 * All paths are resolved relative to and scoped within workspaceRoot.
 */

import { tool } from 'ai';
import { z } from 'zod';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { success, error } from '../utils/tool-result';

// ============================================================================
// Path Safety
// ============================================================================

function resolveAndValidatePath(filePath: string, workspaceRoot: string): string {
  const resolved = path.resolve(workspaceRoot, filePath);
  if (!resolved.startsWith(path.resolve(workspaceRoot))) {
    throw new Error(`Path "${filePath}" is outside workspace root`);
  }
  return resolved;
}

// ============================================================================
// file_read
// ============================================================================

const FILE_READ_DESCRIPTION = `Read a file from the workspace.
Supports optional line range (startLine/endLine) for reading specific sections.
Returns the file content with line numbers.`;

const fileReadSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
  startLine: z.number().optional().describe('Start line (1-indexed, inclusive)'),
  endLine: z.number().optional().describe('End line (1-indexed, inclusive)'),
});

export function createFileReadTool(workspaceRoot: string = process.cwd()) {
  return tool({
    description: FILE_READ_DESCRIPTION,
    inputSchema: fileReadSchema,
    execute: async ({ path: filePath, startLine, endLine }) => {
      try {
        const resolved = resolveAndValidatePath(filePath, workspaceRoot);

        if (!fs.existsSync(resolved)) {
          return error(`File not found: ${filePath}`);
        }

        const content = await fsPromises.readFile(resolved, 'utf-8');
        const lines = content.split('\n');

        const start = Math.max(1, startLine ?? 1);
        const end = Math.min(lines.length, endLine ?? lines.length);

        const selected = lines.slice(start - 1, end);
        const numbered = selected.map((line, i) => `${String(start + i).padStart(4)}│ ${line}`).join('\n');

        return success({
          path: filePath,
          totalLines: lines.length,
          range: { start, end },
          content: numbered,
        });
      } catch (err) {
        return error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

// ============================================================================
// file_write
// ============================================================================

const FILE_WRITE_DESCRIPTION = `Write content to a file. Creates parent directories automatically.
Overwrites the file if it already exists. Use file_create if you want to fail on existing files.`;

const fileWriteSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
  content: z.string().describe('Content to write to the file'),
});

export function createFileWriteTool(workspaceRoot: string = process.cwd()) {
  return tool({
    description: FILE_WRITE_DESCRIPTION,
    inputSchema: fileWriteSchema,
    execute: async ({ path: filePath, content }) => {
      try {
        const resolved = resolveAndValidatePath(filePath, workspaceRoot);

        // Create parent directories
        await fsPromises.mkdir(path.dirname(resolved), { recursive: true });
        await fsPromises.writeFile(resolved, content, 'utf-8');

        return success({
          path: filePath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          message: `File written: ${filePath}`,
        });
      } catch (err) {
        return error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

// ============================================================================
// file_edit
// ============================================================================

const FILE_EDIT_DESCRIPTION = `Edit a file using context-based search and replace.
Provide the exact text to find (oldText) and the replacement text (newText).
Uses surrounding code as anchors — no line numbers needed.
The oldText must match exactly (including whitespace) for the edit to succeed.`;

const fileEditSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
  oldText: z.string().describe('Exact text to find in the file (must be unique)'),
  newText: z.string().describe('Replacement text'),
});

export function createFileEditTool(workspaceRoot: string = process.cwd()) {
  return tool({
    description: FILE_EDIT_DESCRIPTION,
    inputSchema: fileEditSchema,
    execute: async ({ path: filePath, oldText, newText }) => {
      try {
        const resolved = resolveAndValidatePath(filePath, workspaceRoot);

        if (!fs.existsSync(resolved)) {
          return error(`File not found: ${filePath}`);
        }

        const content = await fsPromises.readFile(resolved, 'utf-8');

        // Count occurrences
        const occurrences = content.split(oldText).length - 1;

        if (occurrences === 0) {
          return error(`Text not found in ${filePath}. Ensure oldText matches exactly (including whitespace).`);
        }

        if (occurrences > 1) {
          return error(`Found ${String(occurrences)} matches for oldText in ${filePath}. Provide more surrounding context to make the match unique.`);
        }

        const newContent = content.replace(oldText, newText);
        await fsPromises.writeFile(resolved, newContent, 'utf-8');

        return success({
          path: filePath,
          message: `Edit applied to ${filePath}`,
          linesChanged: newText.split('\n').length - oldText.split('\n').length,
        });
      } catch (err) {
        return error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

// ============================================================================
// file_create
// ============================================================================

const FILE_CREATE_DESCRIPTION = `Create a new file. Fails if the file already exists.
Creates parent directories automatically.
Use file_write if you want to overwrite existing files.`;

const fileCreateSchema = z.object({
  path: z.string().describe('File path relative to workspace root'),
  content: z.string().describe('Content for the new file'),
});

export function createFileCreateTool(workspaceRoot: string = process.cwd()) {
  return tool({
    description: FILE_CREATE_DESCRIPTION,
    inputSchema: fileCreateSchema,
    execute: async ({ path: filePath, content }) => {
      try {
        const resolved = resolveAndValidatePath(filePath, workspaceRoot);

        if (fs.existsSync(resolved)) {
          return error(`File already exists: ${filePath}. Use file_write to overwrite, or file_edit to modify.`);
        }

        // Create parent directories
        await fsPromises.mkdir(path.dirname(resolved), { recursive: true });
        await fsPromises.writeFile(resolved, content, 'utf-8');

        return success({
          path: filePath,
          bytesWritten: Buffer.byteLength(content, 'utf-8'),
          message: `File created: ${filePath}`,
        });
      } catch (err) {
        return error(err instanceof Error ? err : new Error(String(err)));
      }
    },
  });
}

// ============================================================================
// Convenience: Create all file tools
// ============================================================================

export function createFileTools(workspaceRoot: string = process.cwd()) {
  return {
    file_read: createFileReadTool(workspaceRoot),
    file_write: createFileWriteTool(workspaceRoot),
    file_edit: createFileEditTool(workspaceRoot),
    file_create: createFileCreateTool(workspaceRoot),
  };
}
