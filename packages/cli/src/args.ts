/**
 * @fileoverview CLI argument parsing for agntk.
 * Lightweight hand-rolled parser — keeps dependencies at zero.
 */

export interface ParsedArgs {
  /** The prompt text (positional argument) */
  prompt: string | null;
  /** -i / --interactive */
  interactive: boolean;
  /** -r / --role <role> */
  role: string | null;
  /** -m / --model <model> */
  model: string | null;
  /** --memory */
  memory: boolean;
  /** --init */
  init: boolean;
  /** --tools <preset> */
  tools: string | null;
  /** --workspace <path> */
  workspace: string | null;
  /** --dry-run */
  dryRun: boolean;
  /** --verbose */
  verbose: boolean;
  /** --config <path> */
  config: string | null;
  /** --max-steps <n> */
  maxSteps: number | null;
  /** -v / --version */
  version: boolean;
  /** -h / --help */
  help: boolean;
}

const FLAGS_WITH_VALUES = new Set([
  '-r', '--role',
  '-m', '--model',
  '--tools',
  '--workspace',
  '--config',
  '--max-steps',
]);

/**
 * Parse CLI arguments into a typed structure.
 * Supports: flags, flags with values, and a positional prompt.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    prompt: null,
    interactive: false,
    role: null,
    model: null,
    memory: false,
    init: false,
    tools: null,
    workspace: null,
    dryRun: false,
    verbose: false,
    config: null,
    maxSteps: null,
    version: false,
    help: false,
  };

  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === '-i' || arg === '--interactive') {
      result.interactive = true;
    } else if (arg === '-r' || arg === '--role') {
      result.role = argv[++i] ?? null;
    } else if (arg === '-m' || arg === '--model') {
      result.model = argv[++i] ?? null;
    } else if (arg === '--memory') {
      result.memory = true;
    } else if (arg === '--init') {
      result.init = true;
    } else if (arg === '--tools') {
      result.tools = argv[++i] ?? null;
    } else if (arg === '--workspace') {
      result.workspace = argv[++i] ?? null;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--verbose') {
      result.verbose = true;
    } else if (arg === '--config') {
      result.config = argv[++i] ?? null;
    } else if (arg === '--max-steps') {
      const val = argv[++i];
      result.maxSteps = val ? parseInt(val, 10) : null;
    } else if (arg === '-v' || arg === '--version') {
      result.version = true;
    } else if (arg === '-h' || arg === '--help') {
      result.help = true;
    } else if (arg.startsWith('-')) {
      // Unknown flag — ignore for forward compatibility
    } else {
      positionals.push(arg);
    }
  }

  // Join all positionals as the prompt
  if (positionals.length > 0) {
    result.prompt = positionals.join(' ');
  }

  return result;
}
