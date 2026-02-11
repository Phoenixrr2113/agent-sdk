/**
 * @fileoverview Initializes .agntk/ directory with template memory files.
 *
 * Usage: npx agntk --init
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DIR_NAME = '.agntk';

const TEMPLATES: Record<string, string> = {
  'project.md': `# Project Context

<!-- Describe your project here. This file is always loaded into the agent's context. -->

## Overview

<!-- What does this project do? -->

## Tech Stack

<!-- Languages, frameworks, key dependencies -->

## Conventions

<!-- Coding style, naming conventions, patterns to follow -->
`,

  'memory.md': `# Memory

<!-- Agent-curated facts. The agent updates this file automatically when you use "remember". -->

## World Facts

## Decisions

## Entity Knowledge

## Preferences & Patterns
`,

  'context.md': `# Current Context

<!-- The agent rewrites this file each session to summarize the current working state. -->

No context yet. Start a session with \`agntk --memory\` to populate this file.
`,

  'decisions.md': `# Decision Log

<!-- Append-only log of key decisions. The agent adds entries automatically. -->
`,
};

/**
 * Create .agntk/ directory with template files.
 * Skips files that already exist.
 */
export async function initMemoryDirectory(workspace: string): Promise<void> {
  const dir = resolve(workspace, DIR_NAME);

  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    console.log(`Created ${DIR_NAME}/`);
  } else {
    console.log(`${DIR_NAME}/ already exists`);
  }

  let created = 0;
  let skipped = 0;

  for (const [filename, content] of Object.entries(TEMPLATES)) {
    const filePath = join(dir, filename);
    if (existsSync(filePath)) {
      skipped++;
    } else {
      await writeFile(filePath, content, 'utf-8');
      created++;
      console.log(`  Created ${DIR_NAME}/${filename}`);
    }
  }

  if (skipped > 0) {
    console.log(`  Skipped ${skipped} existing file(s)`);
  }

  console.log(`\nDone! Run \`agntk --memory "your prompt"\` to use persistent memory.`);
}
