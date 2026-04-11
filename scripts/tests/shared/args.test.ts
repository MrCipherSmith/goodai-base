import { describe, it, expect } from 'bun:test';
import { parseArgs, getOption, getFlag } from '../../src/shared/args';

describe('parseArgs', () => {
  it('empty array returns all empty', () => {
    const result = parseArgs([]);
    expect(result.flags).toEqual({});
    expect(result.options).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('--flag sets flags.flag = true', () => {
    const result = parseArgs(['--flag']);
    expect(result.flags.flag).toBe(true);
    expect(result.options).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('--option value sets options.option = "value"', () => {
    const result = parseArgs(['--option', 'value']);
    expect(result.options.option).toBe('value');
    expect(result.flags).toEqual({});
    expect(result.positional).toEqual([]);
  });

  it('positional arg without -- goes to positional array', () => {
    const result = parseArgs(['positional']);
    expect(result.positional).toEqual(['positional']);
    expect(result.flags).toEqual({});
    expect(result.options).toEqual({});
  });

  it('--flag --option value pos1 → all three kinds', () => {
    const result = parseArgs(['--flag', '--option', 'value', 'pos1']);
    expect(result.flags.flag).toBe(true);
    expect(result.options.option).toBe('value');
    expect(result.positional).toEqual(['pos1']);
  });

  it('--option at end with no value is treated as flag', () => {
    const result = parseArgs(['--option']);
    expect(result.flags.option).toBe(true);
    expect(result.options).toEqual({});
  });

  it('--option followed by another --flag is treated as flag', () => {
    const result = parseArgs(['--option', '--flag']);
    expect(result.flags.option).toBe(true);
    expect(result.flags.flag).toBe(true);
    expect(result.options).toEqual({});
  });

  it('multiple positional args', () => {
    const result = parseArgs(['a', 'b', 'c']);
    expect(result.positional).toEqual(['a', 'b', 'c']);
  });

  it('multiple flags', () => {
    const result = parseArgs(['--verbose', '--dry-run']);
    expect(result.flags.verbose).toBe(true);
    expect(result.flags['dry-run']).toBe(true);
  });

  it('multiple options', () => {
    const result = parseArgs(['--output', 'dist', '--format', 'json']);
    expect(result.options.output).toBe('dist');
    expect(result.options.format).toBe('json');
  });
});

describe('getOption', () => {
  it('returns default when option is missing', () => {
    const args = parseArgs([]);
    expect(getOption(args, 'missing', 'default')).toBe('default');
  });

  it('returns actual value when option is present', () => {
    const args = parseArgs(['--key', 'actual']);
    expect(getOption(args, 'key', 'default')).toBe('actual');
  });

  it('returns default for empty string default', () => {
    const args = parseArgs([]);
    expect(getOption(args, 'missing', '')).toBe('');
  });
});

describe('getFlag', () => {
  it('returns false when flag is not present', () => {
    const args = parseArgs([]);
    expect(getFlag(args, 'missing')).toBe(false);
  });

  it('returns true when flag is present', () => {
    const args = parseArgs(['--verbose']);
    expect(getFlag(args, 'verbose')).toBe(true);
  });

  it('returns false for a different flag', () => {
    const args = parseArgs(['--verbose']);
    expect(getFlag(args, 'quiet')).toBe(false);
  });
});
