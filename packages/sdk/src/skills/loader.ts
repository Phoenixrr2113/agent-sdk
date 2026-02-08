/**
 * @fileoverview Skills discovery and loading.
 * Scans directories for SKILL.md files, parses YAML frontmatter,
 * and builds system prompt injections.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createLogger } from '@agent/logger';
import type { SkillMeta, SkillContent, SkillsConfig } from './types';

const log = createLogger('@agent/sdk:skills');

const DEFAULT_SKILLS_DIRS = ['.agents/skills'];
const SKILL_FILENAME = 'SKILL.md';

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Expects format:
 * ---
 * name: skill-name
 * description: Short description
 * ---
 * ... markdown content ...
 */
export function parseSkillFrontmatter(content: string): { name?: string; description?: string; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { body: content };
  }

  const [, yaml, body] = match;
  const result: { name?: string; description?: string; body: string } = { body: body.trim() };

  // Simple YAML key-value parsing (avoids adding a YAML dep to the SDK)
  for (const line of yaml.split('\n')) {
    const kvMatch = line.match(/^\s*(name|description)\s*:\s*(.+?)\s*$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      // Strip surrounding quotes if present
      const cleanValue = value.replace(/^['"]|['"]$/g, '');
      if (key === 'name') result.name = cleanValue;
      if (key === 'description') result.description = cleanValue;
    }
  }

  return result;
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
        const { name, description } = parseSkillFrontmatter(content);

        skills.push({
          name: name ?? entry.name,
          description: description ?? `Skill from ${entry.name}`,
          path: skillFile,
          directory: skillDir,
        });

        log.debug('Discovered skill', { name: name ?? entry.name, path: skillFile });
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
      const { name, description, body } = parseSkillFrontmatter(content);
      const dirName = path.basename(absoluteDir);

      skills.push({
        name: name ?? dirName,
        description: description ?? `Skill from ${dirName}`,
        path: skillFile,
        directory: absoluteDir,
        content: body,
      });
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
