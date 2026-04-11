import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

export function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

export function copyFile(src: string, dest: string): void {
  ensureDir(dirname(dest));
  copyFileSync(src, dest);
}

export function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

export function writeTextFile(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, 'utf8');
}

export function fileExists(filePath: string): boolean {
  return existsSync(filePath);
}

/** Resolve ~ in paths */
export function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return resolve(homedir(), p.slice(2));
  }
  return p;
}
