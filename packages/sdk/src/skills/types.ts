/**
 * @fileoverview Type definitions for the Skills system.
 * Skills are SKILL.md files that agents can discover and inject into their system prompt.
 */

/**
 * Metadata extracted from a SKILL.md file's YAML frontmatter.
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
