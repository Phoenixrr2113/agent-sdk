/**
 * @fileoverview Tests for the Skills module.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  parseSkillFrontmatter,
  discoverSkills,
  loadSkillContent,
  loadSkills,
  loadSkillsFromPaths,
  buildSkillsSystemPrompt,
} from '../skills/loader';
import type { SkillContent } from '../skills/types';

// ============================================================================
// Test Fixtures
// ============================================================================

let tmpDir: string;

function createSkillFile(dirName: string, frontmatter: Record<string, string>, body: string): string {
  const skillDir = path.join(tmpDir, dirName);
  fs.mkdirSync(skillDir, { recursive: true });
  const lines = [`---`];
  for (const [key, value] of Object.entries(frontmatter)) {
    lines.push(`${key}: ${value}`);
  }
  lines.push(`---`, body);
  const skillFile = path.join(skillDir, 'SKILL.md');
  fs.writeFileSync(skillFile, lines.join('\n'));
  return skillDir;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ============================================================================
// parseSkillFrontmatter
// ============================================================================

describe('parseSkillFrontmatter', () => {
  it('parses name and description from frontmatter', () => {
    const content = `---
name: my-skill
description: Does cool things
---
Some instructions here.`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('my-skill');
    expect(result.description).toBe('Does cool things');
    expect(result.body).toBe('Some instructions here.');
  });

  it('handles quoted values', () => {
    const content = `---
name: "quoted-skill"
description: 'single quoted'
---
Body.`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('quoted-skill');
    expect(result.description).toBe('single quoted');
  });

  it('returns full content as body when no frontmatter', () => {
    const content = 'No frontmatter here.';
    const result = parseSkillFrontmatter(content);
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.body).toBe('No frontmatter here.');
  });

  it('handles empty body after frontmatter', () => {
    const content = `---
name: empty-body
description: No body
---
`;

    const result = parseSkillFrontmatter(content);
    expect(result.name).toBe('empty-body');
    expect(result.body).toBe('');
  });

  it('preserves multiline body content', () => {
    const content = `---
name: multiline
description: Has multiple lines
---
Line 1

Line 3
  Indented line`;

    const result = parseSkillFrontmatter(content);
    expect(result.body).toContain('Line 1');
    expect(result.body).toContain('Line 3');
    expect(result.body).toContain('  Indented line');
  });
});

// ============================================================================
// discoverSkills
// ============================================================================

describe('discoverSkills', () => {
  it('discovers skills in directories', () => {
    createSkillFile('skill-a', { name: 'alpha', description: 'First skill' }, 'Alpha instructions');
    createSkillFile('skill-b', { name: 'beta', description: 'Second skill' }, 'Beta instructions');

    // Discover from tmpDir directly  
    const skills = discoverSkills([tmpDir]);
    expect(skills).toHaveLength(2);
    expect(skills.map(s => s.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('skips directories without SKILL.md', () => {
    createSkillFile('has-skill', { name: 'present', description: 'Here' }, 'Content');
    // Create empty directory
    fs.mkdirSync(path.join(tmpDir, 'no-skill'), { recursive: true });

    const skills = discoverSkills([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('present');
  });

  it('uses directory name when no name in frontmatter', () => {
    const skillDir = path.join(tmpDir, 'my-tool');
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, 'SKILL.md'),
      'No frontmatter skill.',
    );

    const skills = discoverSkills([tmpDir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('my-tool');
  });

  it('returns empty array for non-existent directory', () => {
    const skills = discoverSkills(['/nonexistent/path']);
    expect(skills).toEqual([]);
  });

  it('resolves relative paths against basePath', () => {
    // Create .agents/skills/my-skill/SKILL.md relative to tmpDir
    const skillsBase = path.join(tmpDir, '.agents', 'skills');
    fs.mkdirSync(path.join(skillsBase, 'my-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(skillsBase, 'my-skill', 'SKILL.md'),
      `---\nname: relative-skill\ndescription: Relative\n---\nContent`,
    );

    const skills = discoverSkills(['.agents/skills'], tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('relative-skill');
  });
});

// ============================================================================
// loadSkillContent
// ============================================================================

describe('loadSkillContent', () => {
  it('loads full content for a discovered skill', () => {
    createSkillFile('test-skill', { name: 'test', description: 'Test skill' }, 'Detailed instructions here.');

    const discovered = discoverSkills([tmpDir]);
    expect(discovered).toHaveLength(1);

    const loaded = loadSkillContent(discovered[0]);
    expect(loaded.name).toBe('test');
    expect(loaded.content).toBe('Detailed instructions here.');
  });
});

// ============================================================================
// loadSkills
// ============================================================================

describe('loadSkills', () => {
  it('loads all skills with auto-discover', () => {
    createSkillFile('s1', { name: 'one', description: 'First' }, 'Body 1');
    createSkillFile('s2', { name: 'two', description: 'Second' }, 'Body 2');

    const skills = loadSkills({ directories: [tmpDir] });
    expect(skills).toHaveLength(2);
    expect(skills.every(s => s.content.length > 0)).toBe(true);
  });

  it('filters by include list', () => {
    createSkillFile('s1', { name: 'wanted', description: 'Keep' }, 'Body 1');
    createSkillFile('s2', { name: 'unwanted', description: 'Skip' }, 'Body 2');

    const skills = loadSkills({ directories: [tmpDir], include: ['wanted'] });
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('wanted');
  });

  it('returns empty when include matches nothing', () => {
    createSkillFile('s1', { name: 'existing', description: 'Here' }, 'Body');

    const skills = loadSkills({ directories: [tmpDir], include: ['nonexistent'] });
    expect(skills).toEqual([]);
  });
});

// ============================================================================
// loadSkillsFromPaths
// ============================================================================

describe('loadSkillsFromPaths', () => {
  it('loads skills from explicit paths', () => {
    const dir = createSkillFile('explicit', { name: 'direct', description: 'Directly loaded' }, 'Direct content');

    const skills = loadSkillsFromPaths([dir]);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('direct');
    expect(skills[0].content).toBe('Direct content');
  });

  it('skips paths without SKILL.md', () => {
    const emptyDir = path.join(tmpDir, 'empty');
    fs.mkdirSync(emptyDir, { recursive: true });

    const skills = loadSkillsFromPaths([emptyDir]);
    expect(skills).toEqual([]);
  });
});

// ============================================================================
// buildSkillsSystemPrompt
// ============================================================================

describe('buildSkillsSystemPrompt', () => {
  it('builds prompt with skill sections', () => {
    const skills: SkillContent[] = [
      {
        name: 'code-review',
        description: 'Reviews code for quality',
        path: '/fake/path',
        directory: '/fake',
        content: 'When reviewing code, check for:\n1. Security\n2. Performance',
      },
    ];

    const prompt = buildSkillsSystemPrompt(skills);
    expect(prompt).toContain('<skills>');
    expect(prompt).toContain('</skills>');
    expect(prompt).toContain('### code-review');
    expect(prompt).toContain('Reviews code for quality');
    expect(prompt).toContain('When reviewing code');
    expect(prompt).toContain('1 skill(s) available');
  });

  it('returns empty string when no skills', () => {
    expect(buildSkillsSystemPrompt([])).toBe('');
  });

  it('includes multiple skills', () => {
    const skills: SkillContent[] = [
      { name: 'a', description: 'A', path: '', directory: '', content: 'Alpha' },
      { name: 'b', description: 'B', path: '', directory: '', content: 'Beta' },
    ];

    const prompt = buildSkillsSystemPrompt(skills);
    expect(prompt).toContain('### a');
    expect(prompt).toContain('### b');
    expect(prompt).toContain('2 skill(s) available');
  });
});
