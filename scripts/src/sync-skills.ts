#!/usr/bin/env bun

import { readdirSync, statSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';
import { ensureDir, copyFile, fileExists, expandHome } from './shared/fs-utils';

const SKIP_DIRS = new Set(['shared']);

const repoRoot = resolve(import.meta.dir, '../../');
const skillsDir = join(repoRoot, 'skills');
const schemaFile = join(repoRoot, 'rules', 'schemas', 'skill-workflow-result.schema.json');
const agentsSource = join(repoRoot, 'AGENTS.md');

const home = homedir();

const TARGETS: Array<{ dir: string; suffix: string }> = [
  { dir: join(home, '.cursor', 'skills'),           suffix: 'cursor' },
  { dir: join(home, '.codex', 'skills'),            suffix: 'codex' },
  { dir: join(home, '.antigravity', 'skills'),      suffix: 'antigravity' },
  { dir: join(home, '.config', 'zed', 'skills'),    suffix: 'zed' },
  { dir: join(home, '.config', 'opencode', 'skills'), suffix: 'opencode' },
  { dir: join(home, '.claude', 'skills'),           suffix: 'claude' },
];

const AGENTS_TARGETS: Array<{ file: string; label: string }> = [
  { file: join(home, '.cursor', 'rules', 'AGENTS.md'),      label: 'Cursor' },
  { file: join(home, '.codex', 'AGENTS.md'),                label: 'Codex' },
  { file: join(home, '.config', 'zed', 'AGENTS.md'),        label: 'Zed' },
  { file: join(home, '.config', 'opencode', 'AGENTS.md'),   label: 'OpenCode' },
];

// Print banner
console.log(`Syncing skills from ${skillsDir}`);
console.log('');

// Validate skills directory exists
if (!fileExists(skillsDir) || !statSync(skillsDir).isDirectory()) {
  console.error(`Error: source folder ${skillsDir} not found`);
  process.exit(1);
}

// Run pre-sync validation
console.log('Running pre-sync validation...');
const validatorScript = join(import.meta.dir, 'validate-skills-before-sync.ts');
const validationResult = Bun.spawnSync(
  ['bun', join(import.meta.dir, 'validate-skills-before-sync.ts'), skillsDir, schemaFile],
  { stdout: 'pipe', stderr: 'pipe' }
);
if (validationResult.stdout) process.stdout.write(validationResult.stdout);
if (validationResult.stderr) process.stderr.write(validationResult.stderr);

if (validationResult.exitCode !== 0) {
  console.log('');
  console.log('Sync aborted due to validation errors.');
  process.exit(1);
}

console.log('');

// Count skill directories
const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
  .map(e => e.name)
  .sort();

console.log(`Found ${skillDirs.length} skills`);
console.log('');

let syncErrors = 0;

// Sync skills to all platform targets
for (const { dir: targetDir, suffix } of TARGETS) {
  console.log(`-> Syncing to ${targetDir}`);
  ensureDir(targetDir);

  for (const skillName of skillDirs) {
    const skillDir = join(skillsDir, skillName);
    const sourceFileVariant = join(skillDir, `SKILL.${suffix}.md`);
    const sourceFileCanonical = join(skillDir, 'SKILL.md');
    const targetSkillDir = join(targetDir, skillName);
    const targetFilePath = join(targetSkillDir, 'SKILL.md');

    let sourceFile: string;

    if (fileExists(sourceFileVariant)) {
      sourceFile = sourceFileVariant;
    } else if (fileExists(sourceFileCanonical)) {
      sourceFile = sourceFileCanonical;
      console.log(`  NOTE ${skillName}: using canonical SKILL.md (no SKILL.${suffix}.md)`);
    } else {
      console.log(`  SKIP ${skillName}: neither SKILL.${suffix}.md nor SKILL.md found`);
      continue;
    }

    ensureDir(targetSkillDir);

    try {
      copyFile(sourceFile, targetFilePath);
    } catch (err) {
      console.log(`  FAIL ${skillName}: cannot copy ${sourceFile} -> ${targetFilePath}`);
      syncErrors++;
      continue;
    }

    // Copy scripts subdirectory if it exists
    const scriptsDir = join(skillDir, 'scripts');
    if (fileExists(scriptsDir) && statSync(scriptsDir).isDirectory()) {
      try {
        cpSync(scriptsDir, join(targetSkillDir, 'scripts'), { recursive: true });
      } catch (err) {
        console.log(`  FAIL ${skillName}: cannot copy scripts directory`);
        syncErrors++;
        continue;
      }
    }

    console.log(`  OK   ${skillName}`);
  }
  console.log('');
}

if (syncErrors > 0) {
  console.log(`Skills sync finished with errors: ${syncErrors}`);
  process.exit(1);
}

// Sync SKILL.claude.md → ~/.claude/commands/<name>.md
const claudeCommandsDir = join(home, '.claude', 'commands');
console.log(`-> Syncing Claude slash commands to ${claudeCommandsDir}`);
ensureDir(claudeCommandsDir);
let claudeCmdErrors = 0;

for (const skillName of skillDirs) {
  const skillDir = join(skillsDir, skillName);
  const sourceFile = join(skillDir, 'SKILL.claude.md');
  const targetFilePath = join(claudeCommandsDir, `${skillName}.md`);

  if (fileExists(sourceFile)) {
    try {
      copyFile(sourceFile, targetFilePath);
      console.log(`  OK   ${skillName} → ${targetFilePath}`);
    } catch (err) {
      console.log(`  FAIL ${skillName}: cannot copy to ${targetFilePath}`);
      claudeCmdErrors++;
    }
  }
}
console.log('');

if (claudeCmdErrors > 0) {
  console.log(`Claude commands sync finished with errors: ${claudeCmdErrors}`);
  process.exit(1);
}

// Sync AGENTS.md to all tool targets
if (fileExists(agentsSource)) {
  console.log('');
  console.log('-> Syncing AGENTS.md to all tool targets');
  for (const { file: targetFilePath, label } of AGENTS_TARGETS) {
    try {
      copyFile(agentsSource, targetFilePath);
      console.log(`  OK   ${label}: ${targetFilePath}`);
    } catch (err) {
      console.log(`  FAIL ${label}: cannot copy to ${targetFilePath}`);
    }
  }
} else {
  console.log(`\nWarning: AGENTS.md source not found: ${agentsSource}`);
}

console.log('');
console.log('Skills sync completed');
