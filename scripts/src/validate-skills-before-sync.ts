#!/usr/bin/env bun

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { readTextFile } from './shared/fs-utils';

const SKIP_DIRS = new Set(['shared']);
/** Optional platform variants validated when present (strategy A: canonical-only). */
const PLATFORMS = ['cursor', 'codex', 'zed', 'opencode'] as const;

const REPO_ROOT = resolve(import.meta.dir, '../../');

function expandHome(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return join(homedir(), p.slice(2));
  }
  return p;
}

// Parse positional args (skip `bun` and script path from Bun.argv)
const argv = Bun.argv.slice(2);
const skillsDir = expandHome(argv[0] ?? join(REPO_ROOT, 'skills'));
const schemaFile = expandHome(argv[1] ?? join(REPO_ROOT, 'rules/schemas/skill-workflow-result.schema.json'));

// Validate skills directory exists
if (!existsSync(skillsDir) || !statSync(skillsDir).isDirectory()) {
  console.error(`Error: skills directory not found: ${skillsDir}`);
  process.exit(1);
}

// Validate schema file exists
if (!existsSync(schemaFile) || !statSync(schemaFile).isFile()) {
  console.error(`Error: schema file not found: ${schemaFile}`);
  process.exit(1);
}

// Schema sanity check
let schema: Record<string, unknown>;
try {
  schema = JSON.parse(readTextFile(schemaFile));
} catch {
  console.error(`Error: schema sanity check failed: ${schemaFile}`);
  process.exit(1);
}

function schemaCheck(s: Record<string, unknown>): boolean {
  if (s['type'] !== 'object') return false;
  if (s['additionalProperties'] !== false) return false;
  const required = s['required'];
  if (!Array.isArray(required)) return false;
  if (!required.includes('status')) return false;
  if (!required.includes('decision')) return false;
  if (!required.includes('timestamp_utc')) return false;
  const props = s['properties'] as Record<string, unknown> | undefined;
  if (!props) return false;
  const workflow = props['workflow'] as Record<string, unknown> | undefined;
  if (!workflow) return false;
  const enumVals = workflow['enum'];
  if (!Array.isArray(enumVals)) return false;
  if (!enumVals.includes('skill-create')) return false;
  if (!enumVals.includes('skill-update')) return false;
  return true;
}

if (!schemaCheck(schema)) {
  console.error(`Error: schema sanity check failed: ${schemaFile}`);
  process.exit(1);
}

// Validate a single skill profile file
// Returns error message or null on success
function validateSkillProfile(file: string, skillName: string, suffix: string): string | null {
  if (!existsSync(file) || !statSync(file).isFile()) {
    return null;
  }

  const content = readTextFile(file);
  const lines = content.split('\n');

  // Check opening delimiter
  if (lines[0] !== '---') {
    return `FAIL: ${skillName} (${suffix}) - missing opening YAML frontmatter delimiter`;
  }

  // Check closing delimiter (any line after line 1 that equals "---")
  const hasClosing = lines.slice(1).some(l => l === '---');
  if (!hasClosing) {
    return `FAIL: ${skillName} (${suffix}) - missing closing YAML frontmatter delimiter`;
  }

  // Extract frontmatter content between first and second ---
  const frontmatterLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    frontmatterLines.push(lines[i]);
  }
  const frontmatter = frontmatterLines.join('\n');

  // Check name: field
  if (!/^name:[  \t]+\S/m.test(frontmatter)) {
    return `FAIL: ${skillName} (${suffix}) - missing 'name' in frontmatter`;
  }

  // Check description: field
  if (!/^description:[  \t]*/m.test(frontmatter)) {
    return `FAIL: ${skillName} (${suffix}) - missing 'description' in frontmatter`;
  }

  // Extract name value
  const nameLineMatch = frontmatter.match(/^name:[  \t]*(.*)/m);
  if (nameLineMatch) {
    let nameValue = nameLineMatch[1] ?? '';
    // Strip leading/trailing whitespace and surrounding quotes
    nameValue = nameValue.trim().replace(/^['"]|['"]$/g, '');

    if (nameValue.length > 0 && !/^[a-z0-9-]+$/.test(nameValue)) {
      return `FAIL: ${skillName} (${suffix}) - invalid name '${nameValue}' (use lowercase letters, digits, hyphens)`;
    }

    if (nameValue.length > 64) {
      return `FAIL: ${skillName} (${suffix}) - name too long (${nameValue.length} > 64)`;
    }
  }

  return null;
}

let errors = 0;
let validated = 0;

// Iterate over skill directories
const entries = readdirSync(skillsDir, { withFileTypes: true });
const skillDirs = entries
  .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
  .map(e => e.name)
  .sort();

for (const skillName of skillDirs) {
  const skillDir = join(skillsDir, skillName);

  // Strategy A (canonical-only): SKILL.md is required; platform variants optional.
  const canonicalFile = join(skillDir, 'SKILL.md');
  if (!existsSync(canonicalFile) || !statSync(canonicalFile).isFile()) {
    console.log(`FAIL: ${skillName} - required file missing: SKILL.md`);
    errors++;
  } else {
    validated++;
    const err = validateSkillProfile(canonicalFile, skillName, 'md');
    if (err !== null) {
      console.log(err);
      errors++;
    }
  }

  for (const suffix of PLATFORMS) {
    const sourceFile = join(skillDir, `SKILL.${suffix}.md`);
    if (existsSync(sourceFile) && statSync(sourceFile).isFile()) {
      validated++;
      const err = validateSkillProfile(sourceFile, skillName, suffix);
      if (err !== null) {
        console.log(err);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.log('');
  console.log(`Validation failed: ${errors} issue(s) found.`);
  process.exit(1);
}

console.log(`Validation passed: ${validated} skill profile file(s) checked.`);

// Chain validate-rules-json.ts if it exists
const scriptDir = dirname(new URL(import.meta.url).pathname);
const validateRulesScript = join(scriptDir, 'validate-rules-json.ts');

if (existsSync(validateRulesScript)) {
  console.log('');
  console.log('Running rules.json validation...');
  const result = Bun.spawnSync(['bun', validateRulesScript]);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.exitCode !== 0) {
    console.log('');
    console.log('rules.json validation failed. Fix errors before syncing.');
    process.exit(1);
  }
}
