#!/usr/bin/env bun
// generate-rules-catalog.ts — Generate rules catalog from rules/core/*.mdc
//
// Reads all rules/core/*.mdc files, extracts frontmatter (description, alwaysApply)
// and derives the "area" from the filename convention. Writes:
//   docs/rules-catalog.md — Markdown table (rule | description | area | always-apply)
//
// Usage:
//   bun src/generate-rules-catalog.ts [--rules-dir <path>] [--output-dir <path>] [--dry-run]

import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRuleFrontmatter } from './shared/frontmatter.js';
import { parseArgs, getOption, getFlag } from './shared/args.js';
import { writeTextFile, readTextFile, fileExists } from './shared/fs-utils.js';

const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

// Area inference from filename prefixes/keywords
const AREA_MAP: Record<string, string> = {
  'code-style':     'TypeScript / React',
  'code-review':    'Code Review',
  'commit':         'Git',
  'git':            'Git',
  'frontend':       'Frontend',
  'mobx':           'MobX / State',
  'nestjs':         'Backend / NestJS',
  'storybook':      'Storybook',
  'playwright':     'Testing',
  'test':           'Testing',
  'documentation':  'Documentation',
  'docs':           'Documentation',
  'jobs':           'Orchestration',
  'pipeline':       'Orchestration',
  'beads':          'Orchestration',
  'skills':         'Skills',
  'rule':           'Meta',
  'requirements':   'Planning',
  'implementation': 'Planning',
  'model':          'AI / Models',
  'security':       'Security',
  'perf':           'Performance',
};

function inferArea(filename: string): string {
  const name = filename.replace('.mdc', '').toLowerCase();
  for (const [prefix, area] of Object.entries(AREA_MAP)) {
    if (name.startsWith(prefix) || name.includes(prefix)) {
      return area;
    }
  }
  return 'General';
}

interface RuleEntry {
  rule: string;
  description: string;
  area: string;
  alwaysApply: boolean;
  path: string;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  const rulesDir = getOption(args, 'rules-dir', join(REPO_ROOT, 'rules', 'core'));
  const outputDir = getOption(args, 'output-dir', join(REPO_ROOT, 'docs'));
  const dryRun = getFlag(args, 'dry-run');

  if (!fileExists(rulesDir)) {
    console.error(`ERROR: rules directory not found: ${rulesDir}`);
    process.exit(1);
  }

  console.log(`Scanning: ${rulesDir}`);
  if (dryRun) {
    console.log('(DRY RUN — no files written)');
  }

  const filenames = readdirSync(rulesDir)
    .filter((f) => f.endsWith('.mdc'))
    .sort();

  const entries: RuleEntry[] = [];

  for (const filename of filenames) {
    const fullPath = join(rulesDir, filename);
    const ruleId = filename.replace('.mdc', '');

    let description = '—';
    let alwaysApply = false;

    try {
      const content = readTextFile(fullPath);
      const { data } = parseRuleFrontmatter(content);
      description = typeof data.description === 'string' && data.description.length > 0
        ? data.description
        : '—';
      alwaysApply = data.alwaysApply === true;
    } catch {
      // keep defaults
    }

    const area = inferArea(filename);

    entries.push({
      rule: ruleId,
      description,
      area,
      alwaysApply,
      path: `rules/core/${filename}`,
    });
  }

  console.log(`Found ${entries.length} rules`);

  // ----------------------------------------------------------------
  // docs/rules-catalog.md
  // ----------------------------------------------------------------
  const mdLines: string[] = [
    '# Rules Catalog',
    '',
    '_Auto-generated from `rules/core/*.mdc`. Do not edit manually._',
    '',
    `Total: ${entries.length} rules`,
    '',
    '| Rule | Description | Area | Always Applied |',
    '| ---- | ----------- | ---- | -------------- |',
  ];

  for (const e of entries) {
    let desc = e.description;
    if (desc.length > 100) {
      desc = desc.slice(0, 97) + '...';
    }
    desc = desc.replace(/\|/g, '\\|');
    const always = e.alwaysApply ? 'Yes' : 'No';
    mdLines.push(`| \`${e.rule}\` | ${desc} | ${e.area} | ${always} |`);
  }

  const mdContent = mdLines.join('\n') + '\n';

  // ----------------------------------------------------------------
  // Write output
  // ----------------------------------------------------------------
  const mdPath = join(outputDir, 'rules-catalog.md');

  if (dryRun) {
    console.log(`\n[DRY RUN] Would write: ${mdPath}`);
  } else {
    writeTextFile(mdPath, mdContent);
    console.log(`Written: ${mdPath}`);
  }
}

main();
