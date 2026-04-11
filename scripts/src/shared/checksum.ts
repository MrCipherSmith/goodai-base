import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sha256File(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

export function sha256String(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
