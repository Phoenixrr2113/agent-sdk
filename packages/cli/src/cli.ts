#!/usr/bin/env node

/**
 * @fileoverview CLI entry point for agntk.
 *
 * Usage:
 *   npx agntk "do something"
 *   npx agntk --role coder "fix the tests"
 *   npx agntk -i --memory
 *   cat error.log | npx agntk "explain these errors"
 */

import { getVersion } from './version.js';
import { parseArgs } from './args.js';
import { resolveConfig } from './config.js';
// Note: environment.js and runner.js are dynamically imported below
// to avoid loading @agntk/core for --version and --help (fast paths)

// ============================================================================
// Help Text
// ============================================================================

function printHelp(): void {
  const version = getVersion();
  console.log(`
  agntk v${version} — portable AI agent

  Usage:
    agntk [options] [prompt]

  Options:
    -i, --interactive     Interactive REPL mode
    -r, --role <role>     Agent role (coder, researcher, analyst, generic)
    -m, --model <model>   Model to use (provider:model format)
    --memory              Enable persistent memory
    --init                Initialize .agntk/ directory with templates
    --tools <preset>      Tool preset (minimal, standard, full)
    --workspace <path>    Workspace root (default: cwd)
    --dry-run             Preview actions without executing
    --verbose             Show detailed logging
    --config <path>       Config file path
    --max-steps <n>       Maximum agent steps
    -v, --version         Show version
    -h, --help            Show help

  Examples:
    agntk "organize this folder by date"
    agntk -i --memory
    agntk --role coder "fix the failing tests"
    cat error.log | agntk "explain these errors"
`);
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Handle --version
  if (args.version) {
    console.log(`agntk v${getVersion()}`);
    process.exit(0);
  }

  // Handle --help
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Resolve configuration
  const config = resolveConfig(args);

  // Handle --init (will be fully implemented in P2-MEM-001)
  if (config.init) {
    console.log('[agntk] --init not yet implemented. Coming in Phase 2.');
    process.exit(0);
  }

  // Handle interactive mode
  if (config.interactive) {
    const { detectEnvironment } = await import('./environment.js');
    const { runRepl } = await import('./repl.js');
    const environment = detectEnvironment(config.workspace);
    const result = await runRepl({ config, environment });
    process.exit(result.success ? 0 : 1);
  }

  // Quick "no prompt" check before loading heavy modules
  // If stdin is a TTY and no prompt was given, bail early
  if (!config.prompt && process.stdin.isTTY) {
    console.error(
      'Error: No prompt provided.\n' +
      'Usage: agntk "your prompt here"\n' +
      '       agntk -i  (for interactive mode)\n' +
      '       agntk -h  (for help)',
    );
    process.exit(1);
  }

  // ── Lazy-load heavy modules (only when actually running an agent) ────
  const { detectEnvironment } = await import('./environment.js');
  const { runOneShot, readStdin } = await import('./runner.js');

  // Build final prompt, combining piped input if available
  let prompt = config.prompt;

  const pipedInput = await readStdin();
  if (pipedInput) {
    if (prompt) {
      prompt = `${pipedInput}\n\n${prompt}`;
    } else {
      prompt = pipedInput;
    }
  }

  if (!prompt) {
    console.error(
      'Error: No prompt provided.\n' +
      'Usage: agntk "your prompt here"\n' +
      '       agntk -i  (for interactive mode)\n' +
      '       agntk -h  (for help)',
    );
    process.exit(1);
  }

  // Detect environment
  const environment = detectEnvironment(config.workspace);

  // Run the agent
  const result = await runOneShot(prompt, { config, environment });

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
