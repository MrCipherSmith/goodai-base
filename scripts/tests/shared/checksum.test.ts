import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha256File, sha256String } from '../../src/shared/checksum';

const tmp = join(tmpdir(), `test-checksum-${Date.now()}`);
beforeAll(() => mkdirSync(tmp, { recursive: true }));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('sha256String', () => {
  it('sha256String("hello") returns known hash', () => {
    expect(sha256String('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('sha256String("") returns known hash for empty string', () => {
    expect(sha256String('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('different inputs produce different hashes', () => {
    expect(sha256String('hello')).not.toBe(sha256String('world'));
  });

  it('returns 64-char hex string', () => {
    const hash = sha256String('test');
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
  });
});

describe('sha256File', () => {
  it('sha256File on a temp file matches sha256String of same content', () => {
    const content = 'hello world test content';
    const filePath = join(tmp, 'test.txt');
    writeFileSync(filePath, content, 'utf8');
    expect(sha256File(filePath)).toBe(sha256String(content));
  });

  it('sha256File on file with known content matches known hash', () => {
    const filePath = join(tmp, 'hello.txt');
    writeFileSync(filePath, 'hello', 'utf8');
    expect(sha256File(filePath)).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('sha256File on non-existent file throws', () => {
    expect(() => sha256File(join(tmp, 'does-not-exist.txt'))).toThrow();
  });

  it('different file contents produce different hashes', () => {
    const file1 = join(tmp, 'file1.txt');
    const file2 = join(tmp, 'file2.txt');
    writeFileSync(file1, 'content one', 'utf8');
    writeFileSync(file2, 'content two', 'utf8');
    expect(sha256File(file1)).not.toBe(sha256File(file2));
  });

  it('empty file hash matches sha256String("")', () => {
    const filePath = join(tmp, 'empty.txt');
    writeFileSync(filePath, '', 'utf8');
    expect(sha256File(filePath)).toBe(sha256String(''));
  });
});
