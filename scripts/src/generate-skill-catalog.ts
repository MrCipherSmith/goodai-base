#!/usr/bin/env bun
// generate-skill-catalog.ts — Generate skill catalog from skills/*/SKILL.md
//
// Reads all skills/*/SKILL.md files, extracts YAML frontmatter fields
// (name, description, metadata.version, metadata.category), and writes:
//   docs/skill-catalog.md  — Markdown table for humans
//   docs/ai/skill-catalog.yaml — Machine-readable YAML for hook consumption
//
// Usage:
//   bun src/generate-skill-catalog.ts [--skills-dir <path>] [--output-dir <path>] [--dry-run]

import { readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseArgs, getOption, getFlag } from './shared/args.js';
import { parseSkillFrontmatter } from './shared/frontmatter.js';
import { readTextFile, writeTextFile, fileExists } from './shared/fs-utils.js';

const SKIP_DIRS = new Set(['shared']);

interface SkillEntry {
  name: string;
  description: string;
  version: string;
  category: string;
  path: string;
}

function extractSkillData(skillMdPath: string, dirName: string): SkillEntry | null {
  let content: string;
  try {
    content = readTextFile(skillMdPath);
  } catch {
    return null;
  }

  if (!content.trimStart().startsWith('---')) {
    return null;
  }

  const { data } = parseSkillFrontmatter(content);

  const name = (typeof data['name'] === 'string' ? data['name'] : '') || dirName;
  const description = typeof data['description'] === 'string' ? data['description'] : '';
  const version =
    typeof data['metadata'] === 'object' &&
    data['metadata'] !== null &&
    typeof (data['metadata'] as Record<string, unknown>)['version'] === 'string'
      ? ((data['metadata'] as Record<string, unknown>)['version'] as string)
      : '—';
  const category =
    typeof data['metadata'] === 'object' &&
    data['metadata'] !== null &&
    typeof (data['metadata'] as Record<string, unknown>)['category'] === 'string'
      ? ((data['metadata'] as Record<string, unknown>)['category'] as string)
      : '—';

  return {
    name,
    description,
    version,
    category,
    path: `skills/${dirName}`,
  };
}

function generateMarkdown(entries: SkillEntry[]): string {
  const lines: string[] = [
    '# Skill Catalog',
    '',
    '_Auto-generated from `skills/*/SKILL.md`. Do not edit manually._',
    '',
    `Total: ${entries.length} skills`,
    '',
    '| Name | Description | Version | Category |',
    '| ---- | ----------- | ------- | -------- |',
  ];

  for (const e of entries) {
    let desc = e.description;
    if (desc.length > 100) {
      desc = desc.slice(0, 97) + '...';
    }
    desc = desc.replace(/\|/g, '\\|');
    lines.push(`| \`${e.name}\` | ${desc} | ${e.version} | ${e.category} |`);
  }

  return lines.join('\n') + '\n';
}

function generateYaml(entries: SkillEntry[]): string {
  const lines: string[] = [
    '# Machine-readable skill catalog for hook/agent consumption',
    '# Auto-generated from skills/*/SKILL.md — do not edit manually',
    'skills:',
  ];

  for (const e of entries) {
    const descEscaped = e.description.replace(/'/g, "''");
    lines.push(`  - name: ${e.name}`);
    lines.push(`    description: '${descEscaped}'`);
    lines.push(`    version: ${e.version}`);
    lines.push(`    category: ${e.category}`);
    lines.push(`    path: ${e.path}`);
  }

  return lines.join('\n') + '\n';
}

// --- Main ---

const args = parseArgs(process.argv.slice(2));

// Resolve repo root relative to this script's location
// __dirname not available in ESM/bun, use import.meta.url
const scriptDir = new URL('.', import.meta.url).pathname;
const repoRoot = join(scriptDir, '..', '..');

const skillsDir = getOption(args, 'skills-dir', join(repoRoot, 'skills'));
const outputDir = getOption(args, 'output-dir', join(repoRoot, 'docs'));
const dryRun = getFlag(args, 'dry-run');

if (!fileExists(skillsDir)) {
  console.error(`ERROR: skills directory not found: ${skillsDir}`);
  process.exit(1);
}

console.log(`Scanning: ${skillsDir}`);
if (dryRun) {
  console.log('(DRY RUN — no files written)');
}

// Collect entries
const entries: SkillEntry[] = [];

const dirEntries = readdirSync(skillsDir).sort();
for (const dirName of dirEntries) {
  if (SKIP_DIRS.has(dirName)) continue;
  const fullDir = join(skillsDir, dirName);
  try {
    if (!statSync(fullDir).isDirectory()) continue;
  } catch {
    continue;
  }
  const skillMd = join(fullDir, 'SKILL.md');
  if (!fileExists(skillMd)) continue;
  const data = extractSkillData(skillMd, dirName);
  if (data) {
    entries.push(data);
  }
}

console.log(`Found ${entries.length} skills`);

const mdPath = join(outputDir, 'skill-catalog.md');
const yamlDir = join(outputDir, 'ai');
const yamlPath = join(yamlDir, 'skill-catalog.yaml');

const mdContent = generateMarkdown(entries);
const yamlContent = generateYaml(entries);

if (dryRun) {
  console.log(`\n[DRY RUN] Would write: ${mdPath}`);
  console.log(`[DRY RUN] Would write: ${yamlPath}`);
} else {
  writeTextFile(mdPath, mdContent);
  console.log(`Written: ${mdPath}`);
  writeTextFile(yamlPath, yamlContent);
  console.log(`Written: ${yamlPath}`);
}
