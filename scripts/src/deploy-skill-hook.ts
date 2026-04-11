#!/usr/bin/env bun
// deploy-skill-hook.ts — deploy the skill evaluator hook into a target project repo
//
// Usage:
//   bun scripts/src/deploy-skill-hook.ts <target-project-path>
//   bun scripts/src/deploy-skill-hook.ts --uninstall <target-project-path>

import { resolve, join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, copyFileSync, chmodSync, mkdirSync, unlinkSync } from 'node:fs';
// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const GOODAI_BASE = resolve(import.meta.dir, '../../');
const HOOK_TEMPLATE = join(GOODAI_BASE, 'scripts/templates/skill-evaluator.sh');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HookEntry {
  id: string;
  type: string;
  command: string;
  timeout: number;
}

interface HookGroup {
  hooks: HookEntry[];
  [key: string]: unknown;
}

interface Settings {
  hooks?: {
    UserPromptSubmit?: HookGroup[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------------

function mergeHook(settingsPath: string, hookCommand: string): void {
  const hookId = 'goodai-skill-evaluator';
  let settings: Settings = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      settings = {};
    }
  }
  const hooks = (settings.hooks ??= {});
  const upsList = (hooks.UserPromptSubmit ??= []);
  const entry: HookEntry = { id: hookId, type: 'command', command: hookCommand, timeout: 10 };

  let found = false;
  for (const group of upsList) {
    const idx = group.hooks.findIndex((h) => h.id === hookId);
    if (idx >= 0) {
      group.hooks[idx] = entry;
      found = true;
      break;
    }
  }
  if (!found) {
    upsList.push({ hooks: [entry] });
  }

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function removeHook(settingsPath: string): 'removed' | 'not-found' | 'invalid-json' {
  const hookId = 'goodai-skill-evaluator';

  if (!existsSync(settingsPath)) return 'not-found';

  let settings: Settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
  } catch {
    return 'invalid-json';
  }

  const hooks = settings.hooks ?? {};
  const upsList = hooks.UserPromptSubmit ?? [];

  const newUps: HookGroup[] = [];
  let removed = false;

  for (const group of upsList) {
    const inner = group.hooks ?? [];
    const newInner = inner.filter((h) => h.id !== hookId);
    if (newInner.length < inner.length) {
      removed = true;
    }
    if (newInner.length > 0) {
      newUps.push({ ...group, hooks: newInner });
    } else if (!removed) {
      newUps.push(group);
    }
    // else: drop empty group
  }

  settings.hooks = { ...hooks, UserPromptSubmit: newUps };
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  return removed ? 'removed' : 'not-found';
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

// Manual arg parse: [--uninstall] <target-project-path>
// parseArgs from shared/args.ts treats "--uninstall /path" as an option pair,
// so we parse argv directly here.
let uninstall = false;
let rawTarget = '';

for (const arg of process.argv.slice(2)) {
  if (arg === '--uninstall') {
    uninstall = true;
  } else if (arg.startsWith('-')) {
    console.error(`Unknown option: ${arg}`);
    console.error('Usage: deploy-skill-hook.ts [--uninstall] <target-project-path>');
    process.exit(1);
  } else {
    rawTarget = arg;
  }
}

if (!rawTarget) {
  console.error('Usage: deploy-skill-hook.ts [--uninstall] <target-project-path>');
  process.exit(1);
}

// Resolve the target path (must exist)
let targetProject: string;
try {
  // resolve relative to cwd
  const candidate = resolve(process.cwd(), rawTarget);
  if (!existsSync(candidate)) {
    throw new Error('not found');
  }
  targetProject = candidate;
} catch {
  console.error(`ERROR: Target project path does not exist: ${rawTarget}`);
  process.exit(1);
}

// Guard: don't deploy into goodai-base itself
if (targetProject === GOODAI_BASE) {
  console.error('ERROR: Cannot deploy hook into goodai-base itself (circular reference).');
  process.exit(1);
}

const claudeDir = join(targetProject, '.claude');
const hooksDir = join(claudeDir, 'hooks');
const settingsFile = join(claudeDir, 'settings.json');
const hookFile = join(hooksDir, 'skill-evaluator.sh');
const overridesFile = join(claudeDir, 'skill-overrides.json');

const HOOK_COMMAND = '"$CLAUDE_PROJECT_DIR"/.claude/hooks/skill-evaluator.sh';

// ---------------------------------------------------------------------------
// Uninstall mode
// ---------------------------------------------------------------------------

if (uninstall) {
  console.log(`Uninstalling skill evaluator hook from: ${targetProject}`);
  console.log('');

  const removedFiles: string[] = [];
  const skippedFiles: string[] = [];

  // Remove hook file
  if (existsSync(hookFile)) {
    unlinkSync(hookFile);
    removedFiles.push('.claude/hooks/skill-evaluator.sh');
  } else {
    skippedFiles.push('.claude/hooks/skill-evaluator.sh (not found)');
  }

  // Remove from settings.json
  if (existsSync(settingsFile)) {
    const result = removeHook(settingsFile);
    if (result === 'removed') {
      removedFiles.push('.claude/settings.json (hook entry removed)');
    } else {
      skippedFiles.push('.claude/settings.json (hook entry not found)');
    }
  } else {
    skippedFiles.push('.claude/settings.json (not found)');
  }

  console.log('Removed:');
  if (removedFiles.length === 0) {
    console.log('  (nothing)');
  } else {
    for (const f of removedFiles) {
      console.log(`  - ${f}`);
    }
  }

  console.log('');
  console.log('Skipped:');
  if (skippedFiles.length === 0) {
    console.log('  (nothing)');
  } else {
    for (const f of skippedFiles) {
      console.log(`  - ${f}`);
    }
  }

  console.log('');
  console.log('Note: .claude/skill-overrides.json preserved (manual cleanup if needed).');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Install mode
// ---------------------------------------------------------------------------

console.log(`Deploying skill evaluator hook to: ${targetProject}`);
console.log('');

if (!existsSync(HOOK_TEMPLATE)) {
  console.error(`ERROR: Hook template not found: ${HOOK_TEMPLATE}`);
  console.error('Run this script from within the goodai-base repository.');
  process.exit(1);
}

const createdFiles: string[] = [];
const updatedFiles: string[] = [];

// 1. Create .claude/ and .claude/hooks/ directories
if (!existsSync(claudeDir)) {
  mkdirSync(claudeDir, { recursive: true });
}
if (!existsSync(hooksDir)) {
  mkdirSync(hooksDir, { recursive: true });
}

// 2. Copy hook template
if (existsSync(hookFile)) {
  // Only copy if content differs
  const templateContent = readFileSync(HOOK_TEMPLATE, 'utf8');
  const existingContent = readFileSync(hookFile, 'utf8');
  if (templateContent !== existingContent) {
    copyFileSync(HOOK_TEMPLATE, hookFile);
    chmodSync(hookFile, 0o755);
    updatedFiles.push('.claude/hooks/skill-evaluator.sh');
  }
} else {
  copyFileSync(HOOK_TEMPLATE, hookFile);
  chmodSync(hookFile, 0o755);
  createdFiles.push('.claude/hooks/skill-evaluator.sh');
}

// 3. Merge hook into settings.json
if (existsSync(settingsFile)) {
  mergeHook(settingsFile, HOOK_COMMAND);
  updatedFiles.push('.claude/settings.json (hook entry merged)');
} else {
  // mergeHook handles creation from scratch
  mergeHook(settingsFile, HOOK_COMMAND);
  createdFiles.push('.claude/settings.json');
}

// 4. Create skill-overrides.json if not present
if (!existsSync(overridesFile)) {
  const overrides = {
    disabled: [],
    local_skills: [],
    extra_context: '',
  };
  writeFileSync(overridesFile, JSON.stringify(overrides, null, 2) + '\n');
  createdFiles.push('.claude/skill-overrides.json');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('Created:');
if (createdFiles.length === 0) {
  console.log('  (nothing new)');
} else {
  for (const f of createdFiles) {
    console.log(`  + ${f}`);
  }
}

console.log('');
console.log('Updated:');
if (updatedFiles.length === 0) {
  console.log('  (nothing changed)');
} else {
  for (const f of updatedFiles) {
    console.log(`  ~ ${f}`);
  }
}

console.log('');
console.log(`Done. The hook will activate on next Claude Code session in:`);
console.log(`  ${targetProject}`);
console.log('');
console.log('Customize behavior in: .claude/skill-overrides.json');
console.log('  - disabled:     list of skill names to suppress');
console.log('  - local_skills: project-specific skills to add');
console.log('  - extra_context: text prepended to every skill suggestion');
console.log('');
console.log(`goodai-base path: ${GOODAI_BASE}`);
console.log('Set GOODAI_BASE env var to override if goodai-base is elsewhere.');
