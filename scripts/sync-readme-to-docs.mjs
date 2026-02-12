#!/usr/bin/env node

/**
 * @fileoverview Syncs README.md sections into Starlight docs pages.
 *
 * The README is the single source of truth. This script parses it into
 * sections using H2 (##) headings and maps them to docs pages.
 *
 * Usage: node scripts/sync-readme-to-docs.mjs
 *
 * Run automatically as part of `pnpm docs:build` or the docs CI workflow.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const README_PATH = join(ROOT, 'README.md');
const DOCS_DIR = join(ROOT, 'apps/docs/src/content/docs');

// ============================================================================
// Section-to-page mapping
// ============================================================================

/**
 * Maps README H2 section titles to docs page paths and frontmatter.
 * Sections not listed here are skipped.
 */
const SECTION_MAP = {
  'Core: `@agntk/core`': {
    path: 'packages/sdk.md',
    title: 'SDK Core',
    description: 'Core agent factory — tools, roles, config, streaming, durability, hooks, scheduling',
  },
  'CLI: `@agntk/cli`': {
    path: 'packages/cli.md',
    title: 'CLI',
    description: 'CLI agent — one-shot prompts, interactive REPL, persistent memory',
  },
  'Server: `@agntk/server`': {
    path: 'packages/sdk-server.md',
    title: 'SDK Server',
    description: 'Hono HTTP server — REST + SSE + WebSocket endpoints',
  },
  'Client: `@agntk/client`': {
    path: 'packages/sdk-client.md',
    title: 'SDK Client',
    description: 'Client library — HTTP, SSE streams, WebSocket, session management',
  },
  'Logger: `@agntk/logger`': {
    path: 'packages/logger.md',
    title: 'Logger',
    description: 'Structured logging — namespace filtering, file/SSE transports, formatters',
  },
};

// ============================================================================
// README Parser
// ============================================================================

/**
 * Parse README into H2 sections.
 * Returns a Map of section title → content (without the H2 heading itself).
 */
function parseReadmeSections(readme) {
  const sections = new Map();
  const lines = readme.split('\n');

  let currentTitle = null;
  let currentLines = [];

  for (const line of lines) {
    const h2Match = line.match(/^## (.+)$/);
    if (h2Match) {
      // Save previous section
      if (currentTitle !== null) {
        sections.set(currentTitle, currentLines.join('\n').trim());
      }
      currentTitle = h2Match[1].trim();
      currentLines = [];
    } else if (currentTitle !== null) {
      currentLines.push(line);
    }
  }

  // Save last section
  if (currentTitle !== null) {
    sections.set(currentTitle, currentLines.join('\n').trim());
  }

  return sections;
}

/**
 * Demote H3 (###) to H2 (##), H4 to H3, etc.
 * Since each page gets the section as its own H1 via frontmatter title,
 * the sub-headings need to be promoted one level.
 */
function demoteHeadings(content) {
  return content.replace(/^(#{2,6}) /gm, (match, hashes) => {
    // ### → ##, #### → ###, etc.
    return hashes.slice(1) + ' ';
  });
}

/**
 * Build a Starlight-compatible markdown page.
 */
function buildPage(config, content) {
  const frontmatter = [
    '---',
    `title: "${config.title}"`,
    `description: "${config.description}"`,
    '---',
    '',
  ].join('\n');

  return frontmatter + '\n' + demoteHeadings(content) + '\n';
}

// ============================================================================
// Index page builder
// ============================================================================

function buildIndexPage(readme) {
  // Extract the top-level content before the first major section
  const lines = readme.split('\n');
  let introLines = [];
  let foundFirstH1 = false;

  for (const line of lines) {
    if (line.startsWith('# ') && !foundFirstH1) {
      foundFirstH1 = true;
      continue; // Skip the H1
    }
    if (line.startsWith('## ')) break; // Stop at first H2
    if (foundFirstH1) introLines.push(line);
  }

  const intro = introLines.join('\n').trim();

  // Also extract the Packages table and Quick Start from the readme
  const sections = parseReadmeSections(readme);
  const packagesTable = sections.get('Packages') || '';
  const quickStart = sections.get('Quick Start') || '';
  const requirements = sections.get('Requirements') || '';

  const content = [
    '---',
    'title: Welcome',
    'description: Agent SDK Documentation',
    '---',
    '',
    '# Agent SDK',
    '',
    intro,
    '',
    '## Packages',
    '',
    packagesTable,
    '',
    '## Quick Start',
    '',
    quickStart,
    '',
    '## Documentation',
    '',
    '- **[Getting Started](/agntk/getting-started/introduction)** — Introduction and setup',
    '- **[Installation](/agntk/getting-started/installation)** — Install Agent SDK',
    '- **[Quick Start](/agntk/getting-started/quick-start)** — Build your first agent',
    '- **[SDK Core](/agntk/packages/sdk)** — Agents, tools, and configuration',
    '- **[CLI](/agntk/packages/cli)** — Command-line interface',
    '- **[SDK Server](/agntk/packages/sdk-server)** — Serve agents over HTTP',
    '- **[SDK Client](/agntk/packages/sdk-client)** — Connect to a remote agent server',
    '- **[Logger](/agntk/packages/logger)** — Structured logging',
    '- **[Configuration](/agntk/configuration/yaml-config)** — Configuration system',
    '',
    '## Requirements',
    '',
    requirements,
    '',
    '## License',
    '',
    'MIT',
    '',
  ].join('\n');

  return content;
}

// ============================================================================
// Introduction page builder
// ============================================================================

function buildIntroPage(readme) {
  const lines = readme.split('\n');
  let introLines = [];
  let foundFirstH1 = false;

  for (const line of lines) {
    if (line.startsWith('# ') && !foundFirstH1) {
      foundFirstH1 = true;
      continue;
    }
    if (line.startsWith('## ')) break;
    if (foundFirstH1) introLines.push(line);
  }

  const intro = introLines.join('\n').trim();
  const sections = parseReadmeSections(readme);
  const packagesTable = sections.get('Packages') || '';

  const content = [
    '---',
    'title: Introduction',
    'description: Welcome to Agent SDK — a modular AI agent framework',
    '---',
    '',
    '# Agent SDK',
    '',
    intro,
    '',
    '## Core Packages',
    '',
    packagesTable,
    '',
    '## Next Steps',
    '',
    '- [Installation](/agntk/getting-started/installation) — Set up Agent SDK in your project',
    '- [Quick Start](/agntk/getting-started/quick-start) — Build your first agent',
    '- [SDK Core](/agntk/packages/sdk) — Learn about agents, tools, and configuration',
    '',
  ].join('\n');

  return content;
}

// ============================================================================
// Quick Start page builder
// ============================================================================

function buildQuickStartPage(readme) {
  const sections = parseReadmeSections(readme);
  const quickStart = sections.get('Quick Start') || '';

  // Also grab the first code example from Core section
  const coreContent = sections.get('Core: `@agntk/core`') || '';
  const creatingAgent = coreContent.split('### ').find(s => s.startsWith('Creating an Agent'));
  const streamingSection = coreContent.split('### ').find(s => s.startsWith('Streaming'));

  const content = [
    '---',
    'title: Quick Start',
    'description: Build your first agent with Agent SDK',
    '---',
    '',
    '# Quick Start',
    '',
    quickStart,
    '',
  ];

  if (creatingAgent) {
    content.push('## Creating an Agent', '', creatingAgent.replace('Creating an Agent\n', '').trim(), '');
  }

  if (streamingSection) {
    content.push('## Streaming', '', streamingSection.replace('Streaming\n', '').trim(), '');
  }

  content.push(
    '',
    '## Next Steps',
    '',
    '- [SDK Core](/agntk/packages/sdk) — Full agent configuration reference',
    '- [CLI](/agntk/packages/cli) — Use agents from the command line',
    '- [Configuration](/agntk/configuration/yaml-config) — Configuration system',
    '',
  );

  return content.join('\n');
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const readme = readFileSync(README_PATH, 'utf-8');
  const sections = parseReadmeSections(readme);
  let generated = 0;

  // Generate index page
  const indexContent = buildIndexPage(readme);
  writeFileSafe(join(DOCS_DIR, 'index.md'), indexContent);
  generated++;

  // Generate introduction page
  const introContent = buildIntroPage(readme);
  writeFileSafe(join(DOCS_DIR, 'getting-started/introduction.md'), introContent);
  generated++;

  // Generate quick start page
  const quickStartContent = buildQuickStartPage(readme);
  writeFileSafe(join(DOCS_DIR, 'getting-started/quick-start.md'), quickStartContent);
  generated++;

  // Generate section-mapped pages
  for (const [sectionTitle, config] of Object.entries(SECTION_MAP)) {
    const sectionContent = sections.get(sectionTitle);
    if (!sectionContent) {
      console.warn(`⚠ Section "${sectionTitle}" not found in README — skipping ${config.path}`);
      continue;
    }

    const page = buildPage(config, sectionContent);
    writeFileSafe(join(DOCS_DIR, config.path), page);
    generated++;
  }

  console.log(`✓ Generated ${generated} docs pages from README.md`);
}

function writeFileSafe(filePath, content) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, content, 'utf-8');
  console.log(`  → ${filePath.replace(ROOT + '/', '')}`);
}

main();
