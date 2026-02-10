/**
 * @fileoverview Type definitions for the Skills system.
 * Skills are SKILL.md files that agents can discover and inject into their system prompt.
 */

/**
 * Metadata extracted from a SKILL.md file's YAML frontmatter.
 * Supports both native and skills.sh fields.
 */
export interface SkillMeta {
  /** Skill name from frontmatter */
  name: string;

  /** Short description from frontmatter */
  description: string;

  /** Absolute path to the SKILL.md file */
  path: string;

  /** Directory containing the skill (may include templates/, scripts/, resources/) */
  directory: string;

  // ---- Extended fields ----

  /** Tags for search and categorization */
  tags?: string[];

  /** When this skill should be used (natural language guidance for the agent) */
  whenToUse?: string;

  /** Recommended model tier for this skill */
  model?: 'fast' | 'standard' | 'reasoning' | 'powerful';

  /** Maximum steps recommended for this skill */
  maxSteps?: number;

  /** Runtime requirements */
  requires?: SkillRequirements;

  // ---- skills.sh compatibility fields ----

  /** License (skills.sh: license) */
  license?: string;

  /** Compatibility info (skills.sh: compatibility) */
  compatibility?: string;

  /** Arbitrary metadata (skills.sh: metadata) */
  metadata?: Record<string, string>;

  /** Tools the skill is allowed to use (skills.sh: allowed-tools) */
  allowedTools?: string[];

  /** Tools the skill should NOT use (inverse of allowed-tools) */
  toolsDeny?: string[];

  /** Additional unknown frontmatter fields (forward-compatible) */
  extra?: Record<string, unknown>;
}

/** Runtime requirements a skill needs to function. */
export interface SkillRequirements {
  /** Binary executables required on PATH (e.g. ['git', 'node', 'docker']) */
  binaries?: string[];
  /** Environment variables required (e.g. ['OPENAI_API_KEY', 'DATABASE_URL']) */
  env?: string[];
}

/**
 * Full skill content including the markdown body.
 */
export interface SkillContent extends SkillMeta {
  /** Full SKILL.md markdown content (excluding frontmatter) */
  content: string;
}

/**
 * Configuration for skill loading.
 */
export interface SkillsConfig {
  /** Directories to scan for skills. Default: ['.agents/skills'] */
  directories?: string[];

  /** Auto-discover all skills in configured directories. Default: true */
  autoDiscover?: boolean;

  /** Specific skill names to include (if set, only these are loaded) */
  include?: string[];
}
