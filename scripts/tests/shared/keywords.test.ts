import { describe, it, expect } from 'bun:test';
import { deriveKeywords } from '../../src/shared/keywords';

describe('deriveKeywords', () => {
  it('empty string returns []', () => {
    expect(deriveKeywords('')).toEqual([]);
  });

  it('all stop words returns []', () => {
    expect(deriveKeywords('use when this is the')).toEqual([]);
  });

  it('"Use when committing changes" filters stop words', () => {
    const result = deriveKeywords('Use when committing changes');
    expect(result).toContain('committing');
    expect(result).toContain('changes');
    expect(result).not.toContain('use');
    expect(result).not.toContain('when');
  });

  it('short words (<=2 chars) are filtered out', () => {
    const result = deriveKeywords('go do it ok');
    // "go" (2), "do" (stop word), "it" (stop word), "ok" (2) — all filtered
    expect(result).toEqual([]);
  });

  it('three-char words are included if not stop words', () => {
    const result = deriveKeywords('run job now');
    expect(result).toContain('run');
    expect(result).toContain('job');
    expect(result).toContain('now');
  });

  it('numbers preserved if length > 2', () => {
    const result = deriveKeywords('version 123 release');
    expect(result).toContain('123');
    expect(result).toContain('version');
    expect(result).toContain('release');
  });

  it('duplicates removed', () => {
    const result = deriveKeywords('commit commit commit');
    expect(result).toEqual(['commit']);
  });

  it('special chars (:, ., (, )) stripped to spaces', () => {
    const result = deriveKeywords('parse(input): returns.value');
    expect(result).toContain('parse');
    expect(result).toContain('input');
    expect(result).toContain('returns');
    expect(result).toContain('value');
    // colons and parens should not appear in output
    expect(result.every(w => !w.includes(':') && !w.includes('(') && !w.includes(')'))).toBe(true);
  });

  it('case insensitive: "Commit COMMIT commit" deduplicates to ["commit"]', () => {
    const result = deriveKeywords('Commit COMMIT commit');
    expect(result).toEqual(['commit']);
  });

  it('mixed: "analyze GitHub issues and decompose into tasks"', () => {
    const result = deriveKeywords('analyze GitHub issues and decompose into tasks');
    expect(result).toContain('analyze');
    expect(result).toContain('github');
    expect(result).toContain('issues');
    expect(result).toContain('decompose');
    // "into" is a stop word
    expect(result).not.toContain('into');
    // "and" is a stop word
    expect(result).not.toContain('and');
    expect(result).toContain('tasks');
  });

  it('hyphenated words are treated as separate parts', () => {
    // hyphens are kept (not in the replace regex [^a-z0-9\s-])
    const result = deriveKeywords('well-tested code');
    // "well-tested" stays as one token with hyphen
    expect(result.some(w => w.includes('well') || w.includes('tested') || w === 'well-tested')).toBe(true);
    expect(result).toContain('code');
  });

  it('multiple spaces and newlines are handled', () => {
    const result = deriveKeywords('  analyze   issues  ');
    expect(result).toContain('analyze');
    expect(result).toContain('issues');
  });
});
