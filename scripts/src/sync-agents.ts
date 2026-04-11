#!/usr/bin/env bun
// sync-agents.ts — regenerate only stale agent files (checksum-based)
//
// Usage:
//   bun src/sync-agents.ts [--dry-run] [--output-dir <path>]
//
// Reads skills/agents-registry.json, computes current checksums of source SKILL.md files,
// and calls generate-agents.ts only for skills whose source has changed.

import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { readFileSync } from 'node:fs';
import { parseArgs, getFlag, getOption } from './shared/args.ts';
import { sha256File } from './shared/checksum.ts';
import { fileExists, expandHome } from './shared/fs-utils.ts';

const REPO_ROOT = resolve(import.meta.dir, '../../');
const REGISTRY_FILE = join(REPO_ROOT, 'skills/agents-registry.json');

const args = parseArgs(process.argv.slice(2));
const dryRun = getFlag(args, 'dry-run');
const outputDir = expandHome(getOption(args, 'output-dir', join(homedir(), '.claude/agents')));

if (!fileExists(REGISTRY_FILE)) {
  console.log(`No registry found at ${REGISTRY_FILE}`);
  console.log('Run generate-agents.ts first to create the registry.');
  process.exit(0);
}

interface RegistryEntry {
  skill_name: string;
  source: string;
  source_checksum: string;
}

interface Registry {
  agents: RegistryEntry[];
}

const registry: Registry = JSON.parse(readFileSync(REGISTRY_FILE, 'utf8'));
const agents: RegistryEntry[] = registry.agents ?? [];

console.log(`Syncing agents from registry: ${REGISTRY_FILE}`);
if (dryRun) {
  console.log('(DRY RUN — no files written)');
}
console.log('');

let countUpToDate = 0;
let countStale = 0;
let countMissing = 0;

for (const entry of agents) {
  const { skill_name, source, source_checksum } = entry;
  if (!skill_name) continue;

  if (!fileExists(source)) {
    console.log(`  WARN: Source missing for ${skill_name}: ${source}`);
    countMissing++;
    continue;
  }

  const currentChecksum = sha256File(source);

  if (currentChecksum !== source_checksum) {
    console.log(`  STALE: ${skill_name} (source changed)`);
    countStale++;
  } else {
    console.log(`  OK:    ${skill_name}`);
    countUpToDate++;
  }
}

console.log('');
console.log(`Status: Up-to-date: ${countUpToDate} | Stale: ${countStale} | Missing source: ${countMissing}`);

if (countStale === 0) {
  console.log('All agents are up-to-date.');
  process.exit(0);
}

console.log('');
console.log(`Regenerating ${countStale} stale agent(s)...`);

const generateArgs: string[] = ['--output-dir', outputDir];
if (dryRun) {
  generateArgs.push('--dry-run');
}

const result = Bun.spawnSync(
  ['bun', join(import.meta.dir, 'generate-agents.ts'), ...generateArgs],
  { stdout: 'inherit', stderr: 'inherit' },
);

console.log('');
console.log('Sync complete.');

process.exit(result.exitCode ?? 0);
