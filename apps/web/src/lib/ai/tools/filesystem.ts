import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { tool } from 'ai';
import { z } from 'zod';

const MAX_READ_LINES = 2000;
const MAX_LIST_ENTRIES = 1000;

let allowedDirectories: string[] = [];

function expandHome(filepath: string): string {
  if (filepath.startsWith('~')) {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

function normalizePath(p: string): string {
  let cleaned = p.normalize('NFC').trim().replaceAll(/^["']|["']$/g, '');

  if (cleaned.startsWith('/mnt/')) {
    return cleaned;
  }

  if (process.platform === 'win32') {
    if (/^\/[a-zA-Z]\//.test(cleaned)) {
      cleaned = cleaned[1] + ':' + cleaned.slice(2);
    }

    if (cleaned.startsWith('\\\\')) {
      cleaned = cleaned.replace(/^\\+/, '\\\\');
    }

    if (/^[a-z]:/.test(cleaned)) {
      if (cleaned && cleaned.length > 0 && typeof cleaned[0] === 'string') {
        cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
      }
    }

    return cleaned.replaceAll('/', '\\');
  }

  return cleaned;
}

function isPathWithinAllowedDirectories(targetPath: string): boolean {
  if (typeof targetPath !== 'string' || !targetPath) {
    throw new Error('Path must be a non-empty string');
  }

  if (!Array.isArray(allowedDirectories) || allowedDirectories.length === 0) {
    throw new Error('No allowed directories configured');
  }

  if (targetPath.includes('\x00')) {
    throw new Error('Path contains null bytes');
  }

  if (process.platform === 'win32' && targetPath.includes('::$')) {
    throw new Error('Path contains Windows Alternate Data Stream pattern');
  }

  let normalizedPath: string;
  try {
    normalizedPath = path.normalize(path.resolve(targetPath));
  } catch {
    throw new Error(`Failed to normalize path: ${targetPath}`);
  }

  if (!path.isAbsolute(normalizedPath)) {
    throw new Error(`Path is not absolute after normalization: ${targetPath}`);
  }

  const isCaseInsensitive = process.platform === 'win32' || process.platform === 'darwin';

  for (const allowedDir of allowedDirectories) {
    let normalizedAllowedDir: string;
    try {
      normalizedAllowedDir = path.normalize(path.resolve(allowedDir));
    } catch {
      continue;
    }

    let pPath = normalizedPath;
    let aDir = normalizedAllowedDir;

    if (isCaseInsensitive) {
      pPath = pPath.toLowerCase();
      aDir = aDir.toLowerCase();
    }

    if (pPath === aDir) {
      return true;
    }

    if (aDir === path.sep) {
      return true;
    }

    const separator = path.sep;
    const suffix = aDir.endsWith(separator) ? '' : separator;
    if (pPath.startsWith(aDir + suffix)) {
      return true;
    }
  }

  return false;
}

async function validatePath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  let realPath: string;
  try {
    realPath = await fs.realpath(resolvedPath);
  } catch {
    realPath = resolvedPath;
  }

  if (!isPathWithinAllowedDirectories(realPath)) {
    throw new Error(
      `Access denied: ${targetPath} is outside allowed directories (${allowedDirectories.join(', ')})`
    );
  }

  return realPath;
}

async function validateNewPath(targetPath: string): Promise<string> {
  const expandedPath = expandHome(normalizePath(targetPath));
  const resolvedPath = path.resolve(expandedPath);

  if (!isPathWithinAllowedDirectories(resolvedPath)) {
    throw new Error(`Access denied: ${targetPath} is outside allowed directories`);
  }

  let currentPath = resolvedPath;
  let existingParent: string | null = null;

  while (currentPath !== path.dirname(currentPath)) {
    try {
      await fs.access(currentPath);
      existingParent = currentPath;
      break;
    } catch {
      currentPath = path.dirname(currentPath);
    }
  }

  if (existingParent) {
    try {
      const realParent = await fs.realpath(existingParent);
      if (!isPathWithinAllowedDirectories(realParent)) {
        throw new Error(`Access denied: parent directory is outside allowed directories`);
      }
    } catch {
      throw new Error(`Parent directory validation failed`);
    }
  }

  return resolvedPath;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function searchFiles(
  basePath: string,
  pattern: string,
  maxResults = 500
): Promise<string[]> {
  const results: string[] = [];
  const regex = new RegExp(
    pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\?/g, '.'),
    'i'
  );

  async function walk(dir: string, depth: number): Promise<void> {
    if (results.length >= maxResults || depth > 10) return;

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (regex.test(relativePath) || regex.test(entry.name)) {
          results.push(relativePath);
        }

        if (entry.isDirectory()) {
          await walk(fullPath, depth + 1);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walk(basePath, 0);
  return results;
}

const fsInputSchema = z.object({
  action: z
    .enum(['read', 'write', 'list', 'glob', 'grep', 'info', 'mkdir'])
    .describe('File system operation to perform'),
  path: z.string().max(4096).describe('Path to file or directory'),
  content: z.string().optional().describe('Content for write action'),
  offset: z.number().optional().describe('Start line for read (1-indexed)'),
  limit: z
    .number()
    .max(MAX_READ_LINES)
    .optional()
    .describe(`Max lines to read (max ${MAX_READ_LINES})`),
  pattern: z.string().optional().describe('Glob pattern for glob action'),
  query: z.string().optional().describe('Regex pattern for grep action'),
  sizes: z.boolean().optional().describe('Include file sizes in list'),
});

type FsInput = z.infer<typeof fsInputSchema>;

const DESCRIPTION = `A unified tool for all filesystem operations within the workspace.
This tool provides safe, validated access to read, write, and search files and directories.
All paths are validated against allowed directories to prevent unauthorized access.

When to use this tool:
- Reading or viewing file contents
- Writing or updating text files
- Searching for files by name pattern (glob) or content (grep)
- Exploring directory structure
- Getting file metadata (size, timestamps)

Supported file formats:
- Text files: .txt, .md, .json, .csv, .xml, .yaml, .log, .html
- Code files: .js, .ts, .py, .go, .rs, .java, etc.

Key features:
- Automatic pagination for large files (max ${MAX_READ_LINES} lines per read)
- Parent directories are auto-created on write
- Path security prevents access outside workspace

Actions:
- read: Read file contents. Use offset/limit for large files.
- write: Create new file or overwrite existing. Auto-creates parent dirs.
- list: List directory contents.
- glob: Find files matching pattern (e.g., "**/*.txt", "docs/*.md")
- grep: Search file contents with regex query
- info: Get file metadata (size, timestamps)
- mkdir: Create directory (with parents)

Parameters:
- action: Required. The operation to perform.
- path: Required. Target file or directory path.
- content: For write action. The text content to write.
- offset: For read action. Start line (1-indexed). Use when file was truncated.
- limit: For read action. Max lines to return (max ${MAX_READ_LINES}).
- pattern: For glob action. Glob pattern like "*.txt" or "**/*.csv".
- query: For grep action. Regular expression to search for.
- sizes: For list action. If true, includes file sizes.`;

export function createFilesystemTool(workspaceRoot: string) {
  allowedDirectories = [path.resolve(workspaceRoot)];

  return tool({
    description: DESCRIPTION,
    inputSchema: fsInputSchema,
    execute: async (input: FsInput) => {
      const { action, path: targetPath } = input;

      try {
        switch (action) {
          case 'read': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);

            if (stats.isDirectory()) {
              return { success: false, error: 'Path is a directory, use action: list' };
            }

            const fileContent = await fs.readFile(validPath, 'utf-8');
            const lines = fileContent.split('\n');
            const totalLines = lines.length;
            const start = Math.max(0, (input.offset ?? 1) - 1);
            const end = Math.min(totalLines, start + (input.limit ?? MAX_READ_LINES));

            const content = lines.slice(start, end).join('\n');
            const truncated = end < totalLines;

            if (truncated) {
              return {
                success: true,
                path: targetPath,
                content,
                truncated: true,
                linesShown: [start + 1, end],
                totalLines,
                nextOffset: end + 1,
                hint: `Showing lines ${start + 1}-${end} of ${totalLines}. Use offset: ${end + 1} to continue.`,
              };
            }

            return { success: true, path: targetPath, content };
          }

          case 'write': {
            if (!input.content) {
              return { success: false, error: 'content is required for write action' };
            }
            const validPath = await validateNewPath(targetPath);
            const dir = path.dirname(validPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(validPath, input.content, 'utf-8');
            return { success: true, path: targetPath, message: 'File written successfully' };
          }

          case 'list': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);

            if (!stats.isDirectory()) {
              return { success: false, error: 'Path is not a directory' };
            }

            const entries = await fs.readdir(validPath);
            const items = await Promise.all(
              entries.slice(0, MAX_LIST_ENTRIES).map(async (entry) => {
                const fullPath = path.join(validPath, entry);
                try {
                  const entryStats = await fs.stat(fullPath);
                  const item: Record<string, unknown> = {
                    name: entry,
                    type: entryStats.isDirectory() ? 'directory' : 'file',
                  };
                  if (input.sizes) {
                    item['size'] = entryStats.size;
                    item['formattedSize'] = formatSize(entryStats.size);
                  }
                  return item;
                } catch {
                  return { name: entry, type: 'unknown' };
                }
              })
            );

            const result: Record<string, unknown> = {
              success: true,
              path: targetPath,
              entries: items,
            };
            if (entries.length > MAX_LIST_ENTRIES) {
              result['truncated'] = true;
              result['totalEntries'] = entries.length;
            }
            return result;
          }

          case 'glob': {
            if (!input.pattern) {
              return { success: false, error: 'pattern is required for glob action' };
            }
            const validPath = await validatePath(targetPath);
            const results = await searchFiles(validPath, input.pattern);
            return {
              success: true,
              path: targetPath,
              pattern: input.pattern,
              results: results.slice(0, 500),
              count: results.length,
              truncated: results.length > 500,
            };
          }

          case 'grep': {
            if (!input.query) {
              return { success: false, error: 'query is required for grep action' };
            }
            const validPath = await validatePath(targetPath);
            const content = await fs.readFile(validPath, 'utf-8');
            const lines = content.split('\n');
            const regex = new RegExp(input.query, 'g');
            const matches: Array<{ line: number; content: string }> = [];

            for (let i = 0; i < lines.length && matches.length < 100; i++) {
              if (regex.test(lines[i]!)) {
                matches.push({ line: i + 1, content: lines[i]! });
              }
              regex.lastIndex = 0;
            }

            return {
              success: true,
              path: targetPath,
              query: input.query,
              matches,
              count: matches.length,
              truncated: matches.length >= 100,
            };
          }

          case 'info': {
            const validPath = await validatePath(targetPath);
            const stats = await fs.stat(validPath);
            return {
              success: true,
              path: targetPath,
              info: {
                size: stats.size,
                formattedSize: formatSize(stats.size),
                created: stats.birthtime,
                modified: stats.mtime,
                accessed: stats.atime,
                isDirectory: stats.isDirectory(),
                isFile: stats.isFile(),
              },
            };
          }

          case 'mkdir': {
            const validPath = await validateNewPath(targetPath);
            await fs.mkdir(validPath, { recursive: true });
            return { success: true, path: targetPath, message: 'Directory created' };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (err) {
        const nodeError = err as NodeJS.ErrnoException;
        if (nodeError.code === 'ENOENT') {
          return {
            success: false,
            error: `File not found: ${targetPath}`,
            path: targetPath,
          };
        }
        if (nodeError.code === 'EACCES') {
          return {
            success: false,
            error: `Permission denied: ${targetPath}`,
            path: targetPath,
          };
        }
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          path: targetPath,
        };
      }
    },
  });
}
