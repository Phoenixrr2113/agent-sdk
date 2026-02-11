/**
 * @agntk/core - MarkdownMemoryStore
 *
 * File-based MemoryStore implementation that reads/writes .agntk/ markdown files.
 * Zero dependencies beyond Node.js built-ins.
 */

import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createLogger } from '@agntk/logger';
import type { MemoryStore } from './types';

const log = createLogger('@agntk/core:memory-store');

// ============================================================================
// Constants
// ============================================================================

const PROJECT_DIR_DEFAULT = '.agntk';
const GLOBAL_DIR_DEFAULT = '.agntk';

const FILES = {
  identity: 'identity.md',
  preferences: 'preferences.md',
  project: 'project.md',
  memory: 'memory.md',
  context: 'context.md',
  decisions: 'decisions.md',
} as const;

/** Fallback project context files (checked in order) */
const PROJECT_FALLBACKS = ['CLAUDE.md', 'AGENTS.md'] as const;

// ============================================================================
// MarkdownMemoryStore
// ============================================================================

export interface MarkdownMemoryStoreOptions {
  /** Project-local memory directory. Default: '.agntk' (relative to workspaceRoot) */
  projectDir?: string;
  /** Global memory directory. Default: '~/.agntk' */
  globalDir?: string;
  /** Workspace root for resolving project directory. Default: process.cwd() */
  workspaceRoot?: string;
}

/**
 * Reads/writes markdown memory files from .agntk/ and ~/.agntk/ directories.
 */
export class MarkdownMemoryStore implements MemoryStore {
  private readonly projectPath: string;
  private readonly globalPath: string;
  private readonly workspaceRoot: string;

  constructor(options: MarkdownMemoryStoreOptions = {}) {
    this.workspaceRoot = options.workspaceRoot ?? process.cwd();
    this.projectPath = resolve(this.workspaceRoot, options.projectDir ?? PROJECT_DIR_DEFAULT);
    this.globalPath = resolve(homedir(), options.globalDir ?? GLOBAL_DIR_DEFAULT);
  }

  // ── Load methods ─────────────────────────────────────────────────────

  async loadIdentity(): Promise<string | null> {
    return this.readFileOrNull(join(this.globalPath, FILES.identity));
  }

  async loadPreferences(): Promise<string | null> {
    return this.readFileOrNull(join(this.globalPath, FILES.preferences));
  }

  async loadProject(): Promise<string | null> {
    // Try .agntk/project.md first
    const projectFile = await this.readFileOrNull(join(this.projectPath, FILES.project));
    if (projectFile) return projectFile;

    // Fall back to CLAUDE.md or AGENTS.md in workspace root
    for (const fallback of PROJECT_FALLBACKS) {
      const content = await this.readFileOrNull(join(this.workspaceRoot, fallback));
      if (content) {
        log.debug('Using fallback project file', { file: fallback });
        return content;
      }
    }

    return null;
  }

  async loadMemory(): Promise<string | null> {
    return this.readFileOrNull(join(this.projectPath, FILES.memory));
  }

  async loadContext(): Promise<string | null> {
    return this.readFileOrNull(join(this.projectPath, FILES.context));
  }

  async loadDecisions(): Promise<string | null> {
    return this.readFileOrNull(join(this.projectPath, FILES.decisions));
  }

  // ── Save methods ─────────────────────────────────────────────────────

  async saveContext(content: string): Promise<void> {
    await this.writeFileSafe(join(this.projectPath, FILES.context), content);
  }

  async saveMemory(content: string): Promise<void> {
    await this.writeFileSafe(join(this.projectPath, FILES.memory), content);
  }

  async savePreferences(content: string): Promise<void> {
    await this.writeFileSafe(join(this.globalPath, FILES.preferences), content);
  }

  async appendDecision(entry: string): Promise<void> {
    const filePath = join(this.projectPath, FILES.decisions);
    await this.ensureDir(this.projectPath);
    const separator = existsSync(filePath) ? '\n\n' : '';
    await appendFile(filePath, separator + entry, 'utf-8');
    log.debug('Decision appended', { path: filePath });
  }

  // ── Utilities ────────────────────────────────────────────────────────

  /** Get the resolved project directory path */
  getProjectPath(): string {
    return this.projectPath;
  }

  /** Get the resolved global directory path */
  getGlobalPath(): string {
    return this.globalPath;
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async readFileOrNull(filePath: string): Promise<string | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return content.trim() || null;
    } catch {
      return null;
    }
  }

  private async writeFileSafe(filePath: string, content: string): Promise<void> {
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    await this.ensureDir(dir);
    await writeFile(filePath, content, 'utf-8');
    log.debug('File written', { path: filePath, length: content.length });
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      log.debug('Directory created', { path: dir });
    }
  }
}
