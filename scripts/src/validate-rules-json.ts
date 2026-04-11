#!/usr/bin/env bun
// validate-rules-json.ts — Validate rules.json against disk and AGENTS.md
//
// Checks:
//   1. rules.json is valid JSON
//   2. Every entry's "path" exists on disk (relative to repo root)
//   3. Every rule in AGENTS.md Core Rule Catalog has a rules.json entry
//   4. Every skill in AGENTS.md Skills Catalog has a rules.json entry
//   5. No orphaned entries (in rules.json but not in AGENTS.md) — warning only
//
// Exit codes:
//   0 — validation passed
//   1 — validation failed (errors found)
//
// Usage:
//   bun src/validate-rules-json.ts [--rules-json <path>] [--agents-md <path>]

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, getOption } from './shared/args.js';
import { readTextFile, fileExists, expandHome } from './shared/fs-utils.js';
import { parseAgentsMd } from './shared/agents-md.js';

const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

interface RulesJsonEntry {
  id: string;
  type?: string;
  path?: string;
}

interface RulesJsonRegistry {
  entries: RulesJsonEntry[];
}

const args = parseArgs(process.argv.slice(2));
const rulesJsonPath = expandHome(getOption(args, 'rules-json', resolve(REPO_ROOT, 'rules.json')));
const agentsMdPath = expandHome(getOption(args, 'agents-md', resolve(REPO_ROOT, 'AGENTS.md')));

console.log(`Validating: ${rulesJsonPath}`);
console.log(`Against:    ${agentsMdPath}`);
console.log('');

let errors = 0;
let warnings = 0;

function error(msg: string): void {
  console.log(`  ERROR: ${msg}`);
  errors++;
}

function warn(msg: string): void {
  console.log(`  WARN:  ${msg}`);
  warnings++;
}

// ----------------------------------------------------------------
// 1. rules.json must exist and be valid JSON
// ----------------------------------------------------------------
if (!fileExists(rulesJsonPath)) {
  error(`rules.json not found: ${rulesJsonPath}`);
  console.log(`\nValidation FAILED: ${errors} error(s)`);
  process.exit(1);
}

let registry: RulesJsonRegistry;
try {
  const raw = readTextFile(rulesJsonPath);
  registry = JSON.parse(raw) as RulesJsonRegistry;
} catch (e) {
  error(`rules.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`);
  console.log(`\nValidation FAILED: ${errors} error(s)`);
  process.exit(1);
}

const entries: RulesJsonEntry[] = registry.entries ?? [];
const entryIds = new Set(entries.map((e) => e.id));

// ----------------------------------------------------------------
// 2. Every entry's path must exist on disk
// ----------------------------------------------------------------
console.log('Checking file paths...');
for (const entry of entries) {
  const path = entry.path ?? '';
  if (!path) {
    error(`Entry '${entry.id ?? '?'}' has no path`);
    continue;
  }
  const fullPath = path.startsWith('/') ? path : resolve(REPO_ROOT, path);
  if (!fileExists(fullPath)) {
    error(`Path not found on disk: ${path}  (entry: ${entry.id ?? '?'})`);
  }
}

// ----------------------------------------------------------------
// 3 & 4. Parse AGENTS.md and check coverage
// ----------------------------------------------------------------
if (!fileExists(agentsMdPath)) {
  error(`AGENTS.md not found: ${agentsMdPath}`);
  console.log(`\nValidation FAILED: ${errors} error(s)`);
  process.exit(1);
}

const agentsMdContent = readTextFile(agentsMdPath);
const { rules: agentsRules, skills: agentsSkills } = parseAgentsMd(agentsMdContent);

console.log('Checking Core Rule Catalog coverage...');
for (const rule of agentsRules) {
  // rule.path is "rules/core/filename.mdc" — derive id as filename without extension
  const filename = rule.path.replace(/^rules\/core\//, '');
  const ruleId = filename.replace(/\.mdc$/, '');
  if (!entryIds.has(ruleId)) {
    error(`Rule in AGENTS.md not in rules.json: ${ruleId} (${rule.path})`);
  }
}

console.log('Checking Skills Catalog coverage...');
for (const skill of agentsSkills) {
  // skill.name is the directory name under skills/
  const skillId = skill.name;
  if (!entryIds.has(skillId)) {
    warn(`Skill in AGENTS.md not in rules.json: ${skillId} (skills/${skillId}/SKILL.md)`);
  }
}

// ----------------------------------------------------------------
// 5. Orphaned entries (warn only)
// ----------------------------------------------------------------
console.log('Checking for orphaned entries...');
const agentsRuleIds = new Set(agentsRules.map((r) => r.path.replace(/^rules\/core\//, '').replace(/\.mdc$/, '')));
const agentsSkillIds = new Set(agentsSkills.map((s) => s.name));
const allAgentsIds = new Set([...agentsRuleIds, ...agentsSkillIds]);

for (const entry of entries) {
  if (!allAgentsIds.has(entry.id)) {
    warn(`Orphaned entry in rules.json (not in AGENTS.md): ${entry.id}`);
  }
}

// ----------------------------------------------------------------
// Summary
// ----------------------------------------------------------------
console.log('');
const total = entries.length;
const ruleCount = entries.filter((e) => e.type === 'rule').length;
const skillCount = entries.filter((e) => e.type === 'skill').length;
console.log(`Entries checked: ${total} (${ruleCount} rules, ${skillCount} skills)`);

if (errors > 0) {
  console.log(`\nValidation FAILED: ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
} else if (warnings > 0) {
  console.log(`\nValidation PASSED with ${warnings} warning(s)`);
} else {
  console.log(`\nValidation PASSED: all ${total} entries are valid`);
}
