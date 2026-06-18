#!/usr/bin/env bun
// sync-skills.ts — sync skills to all configured AI tool directories
//
// Usage:
//   bun src/sync-skills.ts                         # sync to tools from goodai.config.json (or all)
//   bun src/sync-skills.ts --tools claude,cursor   # sync to specific tools only
//   bun src/sync-skills.ts --all                   # force sync to all known tools

import { readdirSync, statSync, cpSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { ensureDir, copyFile, fileExists } from './shared/fs-utils';

// ---------------------------------------------------------------------------
// Tool registry — single source of truth for all platform targets
// ---------------------------------------------------------------------------

const home = homedir();

interface ToolTarget {
  id: string;
  label: string;
  skillsDir: string;
  suffix: string;
  agentsFile?: string;
  claudeCommandsDir?: string;  // only for Claude Code
}

const ALL_TOOLS: ToolTarget[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    skillsDir: join(home, '.claude', 'skills'),
    suffix: 'claude',
    agentsFile: undefined,            // Claude uses CLAUDE.md, not AGENTS.md copy
    claudeCommandsDir: join(home, '.claude', 'commands'),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    skillsDir: join(home, '.cursor', 'skills'),
    suffix: 'cursor',
    agentsFile: join(home, '.cursor', 'rules', 'AGENTS.md'),
  },
  {
    id: 'codex',
    label: 'Codex',
    skillsDir: join(home, '.codex', 'skills'),
    suffix: 'codex',
    agentsFile: join(home, '.codex', 'AGENTS.md'),
  },
  {
    id: 'opencode',
    label: 'OpenCode',
    skillsDir: join(home, '.config', 'opencode', 'skills'),
    suffix: 'opencode',
    agentsFile: join(home, '.config', 'opencode', 'AGENTS.md'),
  },
  {
    id: 'zed',
    label: 'Zed',
    skillsDir: join(home, '.config', 'zed', 'skills'),
    suffix: 'zed',
    agentsFile: join(home, '.config', 'zed', 'AGENTS.md'),
  },
  {
    id: 'antigravity',
    label: 'Antigravity',
    skillsDir: join(home, '.antigravity', 'skills'),
    suffix: 'antigravity',
  },
];

// ---------------------------------------------------------------------------
// Arg parsing — resolve which tools to sync
// ---------------------------------------------------------------------------

const repoRoot = resolve(import.meta.dir, '../../');
const configFile = join(repoRoot, 'goodai.config.json');

const argv = process.argv.slice(2);
const forceAll = argv.includes('--all');
const toolsIdx = argv.indexOf('--tools');
const toolsArg = toolsIdx >= 0 ? argv[toolsIdx + 1] : undefined;

let activeToolIds: string[];

if (forceAll) {
  activeToolIds = ALL_TOOLS.map((t) => t.id);
  console.log('Syncing to all tools (--all)');
} else if (toolsArg) {
  activeToolIds = toolsArg.split(',').map((s) => s.trim()).filter(Boolean);
  console.log(`Syncing to tools: ${activeToolIds.join(', ')} (--tools flag)`);
} else if (existsSync(configFile)) {
  try {
    const cfg = JSON.parse(readFileSync(configFile, 'utf8'));
    if (Array.isArray(cfg.sync_tools) && cfg.sync_tools.length > 0) {
      activeToolIds = cfg.sync_tools;
      console.log(`Syncing to tools: ${activeToolIds.join(', ')} (from goodai.config.json)`);
    } else {
      activeToolIds = ALL_TOOLS.map((t) => t.id);
      console.log('Syncing to all tools (no sync_tools in config)');
    }
  } catch {
    activeToolIds = ALL_TOOLS.map((t) => t.id);
    console.log('Syncing to all tools (config parse error)');
  }
} else {
  activeToolIds = ALL_TOOLS.map((t) => t.id);
  console.log('Syncing to all tools (no goodai.config.json found)');
}

const activeTools = ALL_TOOLS.filter((t) => activeToolIds.includes(t.id));
const unknownIds = activeToolIds.filter((id) => !ALL_TOOLS.find((t) => t.id === id));
if (unknownIds.length > 0) {
  console.warn(`Warning: unknown tool IDs ignored: ${unknownIds.join(', ')}`);
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const skillsDir = join(repoRoot, 'skills');
const schemaFile = join(repoRoot, 'rules', 'schemas', 'skill-workflow-result.schema.json');
const agentsSource = join(repoRoot, 'AGENTS.md');
const SKIP_DIRS = new Set(['shared']);

// ---------------------------------------------------------------------------
// Validate
// ---------------------------------------------------------------------------

console.log('');
console.log(`Syncing skills from ${skillsDir}`);
console.log('');

if (!fileExists(skillsDir) || !statSync(skillsDir).isDirectory()) {
  console.error(`Error: source folder ${skillsDir} not found`);
  process.exit(1);
}

console.log('Running pre-sync validation...');
const validationResult = Bun.spawnSync(
  [process.execPath, join(import.meta.dir, 'validate-skills-before-sync.ts'), skillsDir, schemaFile],
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

// ---------------------------------------------------------------------------
// Skill discovery
// ---------------------------------------------------------------------------

const skillDirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
  .map(e => e.name)
  .sort();

console.log(`Found ${skillDirs.length} skills`);
console.log('');

let syncErrors = 0;

// ---------------------------------------------------------------------------
// Sync skills per tool
// ---------------------------------------------------------------------------

for (const tool of activeTools) {
  console.log(`-> [${tool.label}] Syncing skills to ${tool.skillsDir}`);
  ensureDir(tool.skillsDir);

  for (const skillName of skillDirs) {
    const skillDir = join(skillsDir, skillName);
    const sourceFileVariant = join(skillDir, `SKILL.${tool.suffix}.md`);
    const sourceFileCanonical = join(skillDir, 'SKILL.md');
    const targetSkillDir = join(tool.skillsDir, skillName);
    const targetFilePath = join(targetSkillDir, 'SKILL.md');

    let sourceFile: string;
    if (fileExists(sourceFileVariant)) {
      sourceFile = sourceFileVariant;
    } else if (fileExists(sourceFileCanonical)) {
      sourceFile = sourceFileCanonical;
      console.log(`  NOTE ${skillName}: using canonical SKILL.md (no SKILL.${tool.suffix}.md)`);
    } else {
      console.log(`  SKIP ${skillName}: no SKILL.${tool.suffix}.md or SKILL.md found`);
      continue;
    }

    ensureDir(targetSkillDir);

    try {
      copyFile(sourceFile, targetFilePath);
    } catch {
      console.log(`  FAIL ${skillName}: cannot copy ${sourceFile} -> ${targetFilePath}`);
      syncErrors++;
      continue;
    }

    // Copy scripts/ subdirectory if it exists
    const toolScriptsDir = join(skillDir, 'scripts');
    if (fileExists(toolScriptsDir) && statSync(toolScriptsDir).isDirectory()) {
      try {
        cpSync(toolScriptsDir, join(targetSkillDir, 'scripts'), { recursive: true });
      } catch {
        console.log(`  FAIL ${skillName}: cannot copy scripts directory`);
        syncErrors++;
        continue;
      }
    }

    console.log(`  OK   ${skillName}`);
  }

  // Claude Code: also sync slash commands
  if (tool.claudeCommandsDir) {
    console.log('');
    console.log(`-> [${tool.label}] Syncing slash commands to ${tool.claudeCommandsDir}`);
    ensureDir(tool.claudeCommandsDir);
    for (const skillName of skillDirs) {
      const skillDir = join(skillsDir, skillName);
      const sourceFile = join(skillDir, 'SKILL.claude.md');
      const targetFilePath = join(tool.claudeCommandsDir, `${skillName}.md`);
      if (fileExists(sourceFile)) {
        try {
          copyFile(sourceFile, targetFilePath);
          console.log(`  OK   ${skillName} → ${targetFilePath}`);
        } catch {
          console.log(`  FAIL ${skillName}: cannot copy to ${targetFilePath}`);
          syncErrors++;
        }
      }
    }
  }

  console.log('');
}

if (syncErrors > 0) {
  console.log(`Skills sync finished with errors: ${syncErrors}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Sync AGENTS.md to tools that use it
// ---------------------------------------------------------------------------

if (fileExists(agentsSource)) {
  const agentsTargets = activeTools.filter((t) => t.agentsFile);
  if (agentsTargets.length > 0) {
    console.log('-> Syncing AGENTS.md');
    for (const tool of agentsTargets) {
      const targetFile = tool.agentsFile!;
      try {
        ensureDir(targetFile.substring(0, targetFile.lastIndexOf('/')));
        copyFile(agentsSource, targetFile);
        console.log(`  OK   [${tool.label}] ${targetFile}`);
      } catch {
        console.log(`  FAIL [${tool.label}] cannot copy to ${targetFile}`);
      }
    }
    console.log('');
  }
} else {
  console.log(`Warning: AGENTS.md source not found: ${agentsSource}`);
}

// ---------------------------------------------------------------------------
// Done
// ---------------------------------------------------------------------------

console.log('Skills sync completed');
console.log(`  Tools: ${activeTools.map((t) => t.label).join(', ')}`);
console.log('');
console.log(`Tip: to sync to specific tools: bun src/sync-skills.ts --tools claude,cursor`);
