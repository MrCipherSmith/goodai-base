import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { ensureDir, copyFile, readTextFile, writeTextFile, fileExists, expandHome } from '../../src/shared/fs-utils';

const tmp = join(tmpdir(), `test-fs-utils-${Date.now()}`);
beforeAll(() => mkdirSync(tmp, { recursive: true }));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('ensureDir', () => {
  it('creates a new directory', () => {
    const dir = join(tmp, 'new-dir');
    ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it('creates nested directories', () => {
    const dir = join(tmp, 'nested', 'deep', 'path');
    ensureDir(dir);
    expect(existsSync(dir)).toBe(true);
  });

  it('is idempotent (no error if already exists)', () => {
    const dir = join(tmp, 'idempotent-dir');
    ensureDir(dir);
    expect(() => ensureDir(dir)).not.toThrow();
    expect(existsSync(dir)).toBe(true);
  });
});

describe('writeTextFile', () => {
  it('creates file with correct content', () => {
    const filePath = join(tmp, 'write-test.txt');
    writeTextFile(filePath, 'hello world');
    expect(existsSync(filePath)).toBe(true);
  });

  it('creates parent directories automatically', () => {
    const filePath = join(tmp, 'auto-parent', 'nested', 'file.txt');
    writeTextFile(filePath, 'content');
    expect(existsSync(filePath)).toBe(true);
  });

  it('overwrites existing file', () => {
    const filePath = join(tmp, 'overwrite.txt');
    writeTextFile(filePath, 'original');
    writeTextFile(filePath, 'updated');
    const content = readTextFile(filePath);
    expect(content).toBe('updated');
  });
});

describe('readTextFile', () => {
  it('reads content written by writeTextFile', () => {
    const filePath = join(tmp, 'roundtrip.txt');
    const expected = 'round trip content\nwith newlines';
    writeTextFile(filePath, expected);
    expect(readTextFile(filePath)).toBe(expected);
  });

  it('reads utf-8 content correctly', () => {
    const filePath = join(tmp, 'utf8.txt');
    const content = 'Unicode: 日本語 émojis 🎉';
    writeTextFile(filePath, content);
    expect(readTextFile(filePath)).toBe(content);
  });

  it('throws on non-existent file', () => {
    expect(() => readTextFile(join(tmp, 'does-not-exist.txt'))).toThrow();
  });
});

describe('fileExists', () => {
  it('returns true for an existing file', () => {
    const filePath = join(tmp, 'exists.txt');
    writeTextFile(filePath, 'I exist');
    expect(fileExists(filePath)).toBe(true);
  });

  it('returns false for a non-existent file', () => {
    expect(fileExists(join(tmp, 'ghost.txt'))).toBe(false);
  });

  it('returns true for an existing directory', () => {
    const dir = join(tmp, 'existing-dir');
    ensureDir(dir);
    expect(fileExists(dir)).toBe(true);
  });
});

describe('copyFile', () => {
  it('copies content correctly', () => {
    const src = join(tmp, 'source.txt');
    const dest = join(tmp, 'copy-dest', 'destination.txt');
    writeTextFile(src, 'copy me');
    copyFile(src, dest);
    expect(readTextFile(dest)).toBe('copy me');
  });

  it('creates destination parent directories', () => {
    const src = join(tmp, 'src-for-copy.txt');
    const dest = join(tmp, 'deep', 'nested', 'dest.txt');
    writeTextFile(src, 'deep copy');
    copyFile(src, dest);
    expect(existsSync(dest)).toBe(true);
    expect(readTextFile(dest)).toBe('deep copy');
  });

  it('overwrites existing destination', () => {
    const src = join(tmp, 'new-src.txt');
    const dest = join(tmp, 'overwrite-dest.txt');
    writeTextFile(dest, 'old content');
    writeTextFile(src, 'new content');
    copyFile(src, dest);
    expect(readTextFile(dest)).toBe('new content');
  });
});

describe('expandHome', () => {
  it('~/foo/bar starts with homedir()', () => {
    const result = expandHome('~/foo/bar');
    expect(result.startsWith(homedir())).toBe(true);
  });

  it('~/foo/bar expands to homedir()/foo/bar', () => {
    const result = expandHome('~/foo/bar');
    expect(result).toBe(join(homedir(), 'foo/bar'));
  });

  it('~ alone equals homedir()', () => {
    const result = expandHome('~');
    expect(result).toBe(homedir());
  });

  it('absolute path is unchanged', () => {
    expect(expandHome('/absolute/path')).toBe('/absolute/path');
  });

  it('relative path without ~ is unchanged', () => {
    expect(expandHome('relative/path')).toBe('relative/path');
  });

  it('path starting with ~something (not ~/) is unchanged', () => {
    // ~username style paths are not expanded
    const result = expandHome('~user/path');
    expect(result).toBe('~user/path');
  });
});
