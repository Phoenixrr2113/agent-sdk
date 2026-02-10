/**
 * @fileoverview Skills discovery and loading.
 * Scans directories for SKILL.md files, parses YAML frontmatter,
 * and builds system prompt injections.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@agent/logger';
import type { SkillMeta, SkillContent, SkillsConfig, SkillRequirements } from './types';

const log = createLogger('@agent/sdk:skills');

const DEFAULT_SKILLS_DIRS = [
  '.claude/skills',
  '.cursor/skills',
  '.agents/skills',
  'skills',
];
const SKILL_FILENAME = 'SKILL.md';

/** Known frontmatter fields from both native and skills.sh formats */
const KNOWN_FIELDS = new Set([
  'name', 'description', 'license', 'compatibility',
  'metadata', 'allowed-tools', 'allowedTools', 'tools_deny', 'toolsDeny',
  'tags', 'when_to_use', 'whenToUse', 'when-to-use',
  'model', 'max_steps', 'maxSteps', 'max-steps',
  'requires', 'requires-binaries', 'requires-env',
]);

export interface ParsedSkillFrontmatter {
  name?: string;
  description?: string;
  tags?: string[];
  whenToUse?: string;
  model?: 'fast' | 'standard' | 'reasoning' | 'powerful';
  maxSteps?: number;
  requires?: SkillRequirements;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  toolsDeny?: string[];
  extra?: Record<string, unknown>;
  body: string;
}

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Accepts both native and skills.sh fields. Unknown fields are preserved in `extra`.
 *
 * Expects format:
 * ---
 * name: skill-name
 * description: Short description
 * license: MIT
 * allowed-tools: [glob, grep, shell]
 * ---
 * ... markdown content ...
 */
export function parseSkillFrontmatter(content: string): ParsedSkillFrontmatter {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { body: content };
  }

  const [, yaml, body] = match;
  const result: ParsedSkillFrontmatter = { body: body.trim() };
  const extra: Record<string, unknown> = {};

  // Simple YAML key-value parsing (avoids adding a YAML dep to the SDK)
  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^\s*([a-zA-Z_-]+)\s*:\s*(.+?)\s*$/);
    if (!kvMatch) continue;

    const [, rawKey, value] = kvMatch;
    const cleanValue = value.replace(/^['"]|['"]$/g, '');
    const key = rawKey.toLowerCase();

    switch (key) {
      case 'name':
        result.name = cleanValue;
        break;
      case 'description':
        result.description = cleanValue;
        break;
      case 'tags':
        result.tags = parseYamlList(cleanValue);
        break;
      case 'when_to_use':
      case 'whentouse':
      case 'when-to-use':
        result.whenToUse = cleanValue;
        break;
      case 'model':
        if (['fast', 'standard', 'reasoning', 'powerful'].includes(cleanValue)) {
          result.model = cleanValue as 'fast' | 'standard' | 'reasoning' | 'powerful';
        }
        break;
      case 'max_steps':
      case 'maxsteps':
      case 'max-steps': {
        const parsed = parseInt(cleanValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
          result.maxSteps = parsed;
        }
        break;
      }
      case 'requires-binaries':
        result.requires = { ...result.requires, binaries: parseYamlList(cleanValue) };
        break;
      case 'requires-env':
        result.requires = { ...result.requires, env: parseYamlList(cleanValue) };
        break;
      case 'license':
        result.license = cleanValue;
        break;
      case 'compatibility':
        result.compatibility = cleanValue;
        break;
      case 'allowed-tools':
      case 'allowedtools':
        result.allowedTools = parseYamlList(cleanValue);
        break;
      case 'tools_deny':
      case 'toolsdeny':
        result.toolsDeny = parseYamlList(cleanValue);
        break;
      default:
        // Forward-compatible: store unknown fields in extra
        extra[rawKey] = cleanValue;
        break;
    }
  }

  if (Object.keys(extra).length > 0) {
    result.extra = extra;
  }

  // Map allowed-tools → tools_deny (inverse logic)
  // If allowedTools is set but toolsDeny is not, compute toolsDeny
  if (result.allowedTools && !result.toolsDeny) {
    result.toolsDeny = mapAllowedToolsToToolsDeny(result.allowedTools);
  }

  return result;
}

/**
 * Parse a simple YAML list value: "[a, b, c]" or "a, b, c"
 */
function parseYamlList(value: string): string[] {
  // Handle bracket syntax: [a, b, c]
  const bracketMatch = value.match(/^\[(.+)\]$/);
  const inner = bracketMatch ? bracketMatch[1] : value;
  return inner.split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

/** All known tool names in the SDK */
const ALL_TOOLS = [
  'glob', 'grep', 'shell', 'web', 'ast_grep_search',
  'plan', 'deep_reasoning', 'spawn_agent', 'memory',
  'file_read', 'file_write', 'file_edit', 'file_create',
  'progress_read', 'progress_update',
];

/**
 * Map skills.sh allowed-tools (allowlist) to our tools_deny (denylist).
 * Inverse logic: tools NOT in allowed-tools go into tools_deny.
 */
function mapAllowedToolsToToolsDeny(allowedTools: string[]): string[] {
  const allowed = new Set(allowedTools.map(t => t.toLowerCase()));
  return ALL_TOOLS.filter(t => !allowed.has(t));
}

/**
 * Discover SKILL.md files in the given directories.
 * Returns metadata for each discovered skill.
 */
export function discoverSkills(directories?: string[], basePath?: string): SkillMeta[] {
  const dirs = directories ?? DEFAULT_SKILLS_DIRS;
  const base = basePath ?? process.cwd();
  const skills: SkillMeta[] = [];

  for (const dir of dirs) {
    const absoluteDir = path.isAbsolute(dir) ? dir : path.resolve(base, dir);

    if (!fs.existsSync(absoluteDir)) {
      log.debug('Skills directory does not exist, skipping', { dir: absoluteDir });
      continue;
    }

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    } catch (error) {
      log.warn('Failed to read skills directory', { dir: absoluteDir, error: String(error) });
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(absoluteDir, entry.name);
      const skillFile = path.join(skillDir, SKILL_FILENAME);

      if (!fs.existsSync(skillFile)) {
        log.debug('No SKILL.md found in directory', { dir: skillDir });
        continue;
      }

      try {
        const content = fs.readFileSync(skillFile, 'utf-8');
        const parsed = parseSkillFrontmatter(content);

        const meta: SkillMeta = {
          name: parsed.name ?? entry.name,
          description: parsed.description ?? `Skill from ${entry.name}`,
          path: skillFile,
          directory: skillDir,
        };

        if (parsed.tags) meta.tags = parsed.tags;
        if (parsed.whenToUse) meta.whenToUse = parsed.whenToUse;
        if (parsed.model) meta.model = parsed.model;
        if (parsed.maxSteps) meta.maxSteps = parsed.maxSteps;
        if (parsed.requires) meta.requires = parsed.requires;
        if (parsed.license) meta.license = parsed.license;
        if (parsed.compatibility) meta.compatibility = parsed.compatibility;
        if (parsed.metadata) meta.metadata = parsed.metadata;
        if (parsed.allowedTools) meta.allowedTools = parsed.allowedTools;
        if (parsed.toolsDeny) meta.toolsDeny = parsed.toolsDeny;
        if (parsed.extra) meta.extra = parsed.extra;

        skills.push(meta);

        log.debug('Discovered skill', { name: meta.name, path: skillFile });
      } catch (error) {
        log.warn('Failed to parse skill', { path: skillFile, error: String(error) });
      }
    }
  }

  log.info('Skills discovery complete', { count: skills.length });
  return skills;
}

/**
 * Load the full content of a skill, including the markdown body.
 */
export function loadSkillContent(meta: SkillMeta): SkillContent {
  const content = fs.readFileSync(meta.path, 'utf-8');
  const { body } = parseSkillFrontmatter(content);

  return {
    ...meta,
    content: body,
  };
}

/**
 * Load skills based on configuration.
 * Supports both explicit paths and auto-discovery.
 */
export function loadSkills(config: SkillsConfig, basePath?: string): SkillContent[] {
  const discovered = discoverSkills(config.directories, basePath);

  // Filter by include list if provided
  const filtered = config.include
    ? discovered.filter(s => config.include!.includes(s.name))
    : discovered;

  return filtered.map(loadSkillContent);
}

/**
 * Load skills from explicit directory paths (each path IS the skill directory).
 */
export function loadSkillsFromPaths(paths: string[]): SkillContent[] {
  const skills: SkillContent[] = [];

  for (const skillDir of paths) {
    const absoluteDir = path.isAbsolute(skillDir) ? skillDir : path.resolve(process.cwd(), skillDir);
    const skillFile = path.join(absoluteDir, SKILL_FILENAME);

    if (!fs.existsSync(skillFile)) {
      log.warn('SKILL.md not found', { path: skillFile });
      continue;
    }

    try {
      const content = fs.readFileSync(skillFile, 'utf-8');
      const parsed = parseSkillFrontmatter(content);
      const dirName = path.basename(absoluteDir);

      const skill: SkillContent = {
        name: parsed.name ?? dirName,
        description: parsed.description ?? `Skill from ${dirName}`,
        path: skillFile,
        directory: absoluteDir,
        content: parsed.body,
      };

      if (parsed.tags) skill.tags = parsed.tags;
      if (parsed.whenToUse) skill.whenToUse = parsed.whenToUse;
      if (parsed.model) skill.model = parsed.model;
      if (parsed.maxSteps) skill.maxSteps = parsed.maxSteps;
      if (parsed.requires) skill.requires = parsed.requires;
      if (parsed.license) skill.license = parsed.license;
      if (parsed.compatibility) skill.compatibility = parsed.compatibility;
      if (parsed.metadata) skill.metadata = parsed.metadata;
      if (parsed.allowedTools) skill.allowedTools = parsed.allowedTools;
      if (parsed.toolsDeny) skill.toolsDeny = parsed.toolsDeny;
      if (parsed.extra) skill.extra = parsed.extra;

      skills.push(skill);
    } catch (error) {
      log.warn('Failed to load skill', { path: skillFile, error: String(error) });
    }
  }

  return skills;
}

/**
 * Build a system prompt section from loaded skills.
 * Injects skill descriptions and instructions for the LLM.
 */
export function buildSkillsSystemPrompt(skills: SkillContent[]): string {
  if (skills.length === 0) return '';

  const sections = skills.map(skill => {
    const header = `### ${skill.name}`;
    const desc = skill.description ? `> ${skill.description}` : '';
    return [header, desc, '', skill.content].filter(Boolean).join('\n');
  });

  return [
    '',
    '<skills>',
    `You have ${skills.length} skill(s) available. Follow the instructions in each skill when relevant.`,
    '',
    ...sections,
    '</skills>',
  ].join('\n');
}

// ============================================================================
// Search & Filtering
// ============================================================================

/** A skill search result with relevance score. */
export interface SkillSearchResult {
  skill: SkillMeta;
  score: number;
}

/**
 * Search skills by keyword against name, description, tags, and whenToUse.
 * Returns top matches ranked by relevance score.
 */
export function searchSkills(
  skills: SkillMeta[],
  query: string,
  limit = 5,
): SkillSearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];

  const scored: SkillSearchResult[] = [];

  for (const skill of skills) {
    let score = 0;
    const nameLower = skill.name.toLowerCase();
    const descLower = skill.description.toLowerCase();
    const tagsLower = (skill.tags ?? []).map(t => t.toLowerCase());
    const whenLower = (skill.whenToUse ?? '').toLowerCase();

    for (const term of terms) {
      // Name match: highest weight
      if (nameLower.includes(term)) score += 3;
      // Tag match: high weight (exact match preferred)
      if (tagsLower.some(t => t === term)) score += 2.5;
      else if (tagsLower.some(t => t.includes(term))) score += 1.5;
      // whenToUse match
      if (whenLower.includes(term)) score += 2;
      // Description match: moderate weight
      if (descLower.includes(term)) score += 1;
    }

    if (score > 0) {
      scored.push({ skill, score });
    }
  }

  // Sort by score descending, then by name for stability
  scored.sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name));

  return scored.slice(0, limit);
}

/**
 * Filter skills to only those whose runtime requirements are met.
 *
 * Checks:
 * - `requires.binaries`: each binary is found on PATH
 * - `requires.env`: each env var is defined in process.env
 *
 * Skills with no requirements are always eligible.
 */
export function filterEligibleSkills(skills: SkillMeta[]): SkillMeta[] {
  return skills.filter(skill => isSkillEligible(skill));
}

/**
 * Check if a single skill's runtime requirements are met.
 */
export function isSkillEligible(skill: SkillMeta): boolean {
  if (!skill.requires) return true;

  // Check binaries on PATH
  if (skill.requires.binaries) {
    const pathDirs = (process.env.PATH ?? '').split(path.delimiter);
    for (const binary of skill.requires.binaries) {
      const found = pathDirs.some(dir => {
        try {
          return fs.existsSync(path.join(dir, binary));
        } catch (_e: unknown) {
          return false;
        }
      });
      if (!found) {
        log.debug('Skill requirement not met: missing binary', { skill: skill.name, binary });
        return false;
      }
    }
  }

  // Check env vars
  if (skill.requires.env) {
    for (const envVar of skill.requires.env) {
      if (!(envVar in process.env)) {
        log.debug('Skill requirement not met: missing env var', { skill: skill.name, envVar });
        return false;
      }
    }
  }

  return true;
}
