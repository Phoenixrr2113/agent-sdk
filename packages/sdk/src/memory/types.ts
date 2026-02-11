/**
 * @agntk/core - Memory Types
 *
 * Defines the MemoryStore interface and configuration types
 * for the markdown-based memory system.
 */

// ============================================================================
// MemoryStore Interface
// ============================================================================

/**
 * Interface for reading/writing agent memory files.
 *
 * The default implementation (MarkdownMemoryStore) reads/writes .agntk/
 * markdown files. Custom implementations can back memory with any storage.
 */
export interface MemoryStore {
  // ── Always-loaded files ────────────────────────────────────────────────

  /** Load ~/.agntk/identity.md (human-authored, optional) */
  loadIdentity(): Promise<string | null>;

  /** Load ~/.agntk/preferences.md (agent-curated, cross-project) */
  loadPreferences(): Promise<string | null>;

  /** Load .agntk/project.md (human-authored). Falls back to CLAUDE.md / AGENTS.md */
  loadProject(): Promise<string | null>;

  /** Load .agntk/memory.md (agent-curated facts) */
  loadMemory(): Promise<string | null>;

  /** Load .agntk/context.md (agent-rewritten each session) */
  loadContext(): Promise<string | null>;

  // ── On-demand files ────────────────────────────────────────────────────

  /** Load .agntk/decisions.md (append-only decision log) */
  loadDecisions(): Promise<string | null>;

  // ── Write operations ───────────────────────────────────────────────────

  /** Overwrite .agntk/context.md entirely */
  saveContext(content: string): Promise<void>;

  /** Overwrite .agntk/memory.md entirely (after LLM curation) */
  saveMemory(content: string): Promise<void>;

  /** Overwrite ~/.agntk/preferences.md */
  savePreferences(content: string): Promise<void>;

  /** Append an entry to .agntk/decisions.md */
  appendDecision(entry: string): Promise<void>;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for the memory system.
 */
export interface MemoryConfig {
  /** Directory for project-local memory files. Default: '.agntk' */
  projectDir?: string;

  /** Directory for global (cross-project) memory files. Default: '~/.agntk' */
  globalDir?: string;

  /** Custom MemoryStore implementation. Overrides file-based defaults. */
  store?: MemoryStore;
}
