import { describe, it, expect } from 'vitest';
import { parseArgs } from '../args';

describe('parseArgs', () => {
  it('parses a simple prompt', () => {
    const result = parseArgs(['organize this folder']);
    expect(result.prompt).toBe('organize this folder');
  });

  it('parses prompt with multiple words', () => {
    const result = parseArgs(['fix', 'the', 'failing', 'tests']);
    expect(result.prompt).toBe('fix the failing tests');
  });

  it('parses --interactive / -i flag', () => {
    expect(parseArgs(['-i']).interactive).toBe(true);
    expect(parseArgs(['--interactive']).interactive).toBe(true);
    expect(parseArgs([]).interactive).toBe(false);
  });

  it('parses --role / -r with value', () => {
    expect(parseArgs(['--role', 'coder']).role).toBe('coder');
    expect(parseArgs(['-r', 'researcher']).role).toBe('researcher');
    expect(parseArgs([]).role).toBeNull();
  });

  it('parses --model / -m with value', () => {
    expect(parseArgs(['--model', 'anthropic:claude-sonnet-4']).model).toBe('anthropic:claude-sonnet-4');
    expect(parseArgs(['-m', 'gpt-4']).model).toBe('gpt-4');
    expect(parseArgs([]).model).toBeNull();
  });

  it('parses --memory flag', () => {
    expect(parseArgs(['--memory']).memory).toBe(true);
    expect(parseArgs([]).memory).toBe(false);
  });

  it('parses --init flag', () => {
    expect(parseArgs(['--init']).init).toBe(true);
    expect(parseArgs([]).init).toBe(false);
  });

  it('parses --tools with value', () => {
    expect(parseArgs(['--tools', 'full']).tools).toBe('full');
    expect(parseArgs([]).tools).toBeNull();
  });

  it('parses --workspace with value', () => {
    expect(parseArgs(['--workspace', '/my/project']).workspace).toBe('/my/project');
    expect(parseArgs([]).workspace).toBeNull();
  });

  it('parses --dry-run flag', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true);
    expect(parseArgs([]).dryRun).toBe(false);
  });

  it('parses --verbose flag', () => {
    expect(parseArgs(['--verbose']).verbose).toBe(true);
    expect(parseArgs([]).verbose).toBe(false);
  });

  it('parses --config with value', () => {
    expect(parseArgs(['--config', './my-config.json']).config).toBe('./my-config.json');
    expect(parseArgs([]).config).toBeNull();
  });

  it('parses --max-steps with numeric value', () => {
    expect(parseArgs(['--max-steps', '20']).maxSteps).toBe(20);
    expect(parseArgs([]).maxSteps).toBeNull();
  });

  it('parses --version / -v flag', () => {
    expect(parseArgs(['--version']).version).toBe(true);
    expect(parseArgs(['-v']).version).toBe(true);
  });

  it('parses --help / -h flag', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['-h']).help).toBe(true);
  });

  it('handles mixed flags and prompt', () => {
    const result = parseArgs(['--role', 'coder', '--memory', 'fix the tests']);
    expect(result.role).toBe('coder');
    expect(result.memory).toBe(true);
    expect(result.prompt).toBe('fix the tests');
  });

  it('handles no arguments', () => {
    const result = parseArgs([]);
    expect(result.prompt).toBeNull();
    expect(result.interactive).toBe(false);
    expect(result.memory).toBe(false);
  });

  it('ignores unknown flags', () => {
    const result = parseArgs(['--unknown-flag', 'hello']);
    expect(result.prompt).toBe('hello');
  });
});
