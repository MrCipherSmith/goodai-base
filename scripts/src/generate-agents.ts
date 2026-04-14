#!/usr/bin/env bun
// generate-agents.ts — generate native Claude Code sub-agents from agent-worthy skills
//
// Usage:
//   bun src/generate-agents.ts [--output-dir <path>] [--registry-path <path>] [--dry-run] [--force]
//
// Reads skills/*/SKILL.md files with metadata.agent_worthy: true and generates
// <output-dir>/<name>.md files in Claude Code native agent format.
//
// Safety:
//   - Never overwrites agents NOT tracked in the registry (manually authored)
//   - Registry: skills/agents-registry.json

import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs, getFlag, getOption } from './shared/args.js';
import { parseSkillFrontmatter } from './shared/frontmatter.js';
import { sha256File } from './shared/checksum.js';
import { readTextFile, writeTextFile, fileExists, ensureDir, expandHome } from './shared/fs-utils.js';

// --- Types ---

interface RegistryEntry {
  skill_name: string;
  source: string;
  agent_path: string;
  generated_at: string;
  source_checksum: string;
}

interface Registry {
  agents: RegistryEntry[];
}

// --- Helpers ---

function loadRegistry(registryPath: string): Registry {
  if (!fileExists(registryPath)) return { agents: [] };
  try {
    return JSON.parse(readTextFile(registryPath)) as Registry;
  } catch {
    return { agents: [] };
  }
}

function saveRegistry(registryPath: string, entries: Map<string, RegistryEntry>): void {
  const sorted = [...entries.values()].sort((a, b) =>
    a.skill_name.localeCompare(b.skill_name),
  );
  const registry: Registry = { agents: sorted };
  writeTextFile(registryPath, JSON.stringify(registry, null, 2) + '\n');
}

// --- Main ---

const scriptDir = new URL('.', import.meta.url).pathname;
const repoRoot = resolve(scriptDir, '..', '..');

const args = parseArgs(Bun.argv.slice(2));

const defaultOutputDir = expandHome('~/.claude/agents');
const outputDir = expandHome(getOption(args, 'output-dir', defaultOutputDir));
const dryRun = getFlag(args, 'dry-run');
const force = getFlag(args, 'force');

const skillsDir = join(repoRoot, 'skills');
const defaultRegistryFile = join(repoRoot, 'skills', 'agents-registry.json');
const registryFile = expandHome(getOption(args, 'registry-path', defaultRegistryFile));

// Load existing registry
const existingRegistry = loadRegistry(registryFile);

// Build lookup maps
const registryBySkillName = new Map<string, RegistryEntry>(
  existingRegistry.agents.map(e => [e.skill_name, e]),
);
const trackedAgentPaths = new Set<string>(
  existingRegistry.agents.map(e => e.agent_path),
);

// Counts
let countGenerated = 0;
let countUpdated = 0;
let countSkipped = 0;
let countErrors = 0;

console.log(`Generating agents from: ${skillsDir}`);
console.log(`Output dir: ${outputDir}`);
if (dryRun) console.log('(DRY RUN — no files written)');
console.log('');

if (!dryRun) {
  ensureDir(outputDir);
}

// Map to collect new registry entries (preserves existing unrelated entries)
const newRegistryEntries = new Map<string, RegistryEntry>(registryBySkillName);

// Iterate over skill directories
const dirEntries = readdirSync(skillsDir).sort();

for (const dirName of dirEntries) {
  const fullDir = join(skillsDir, dirName);
  try {
    if (!statSync(fullDir).isDirectory()) continue;
  } catch {
    continue;
  }

  const skillMdPath = join(fullDir, 'SKILL.md');
  if (!fileExists(skillMdPath)) continue;

  let content: string;
  try {
    content = readTextFile(skillMdPath);
  } catch {
    console.error(`  ERROR: Cannot read ${skillMdPath}`);
    countErrors++;
    continue;
  }

  const { data, content: body } = parseSkillFrontmatter(content);

  // Skip if not agent_worthy
  if (data.metadata?.agent_worthy !== true) continue;

  // Validate name
  const skillName = data.name;
  if (!skillName) {
    console.error(`  ERROR: No name in ${skillMdPath}`);
    countErrors++;
    continue;
  }

  const description = data.description ?? '';
  const model = typeof data.metadata?.model === 'string' ? data.metadata.model : undefined;
  const tools = typeof data.metadata?.tools === 'string' ? data.metadata.tools : undefined;

  const agentPath = join(outputDir, `${skillName}.md`);
  const sourceChecksum = sha256File(skillMdPath);

  // Safety: if agent file exists but NOT in registry and --force not set → skip
  if (fileExists(agentPath) && !trackedAgentPaths.has(agentPath) && !force) {
    console.log(`  SKIP: ${skillName} — agent exists but is manually managed (not in registry)`);
    countSkipped++;
    continue;
  }

  // Up-to-date check: checksum matches registry
  const existingEntry = registryBySkillName.get(skillName);
  if (fileExists(agentPath) && existingEntry?.source_checksum === sourceChecksum) {
    console.log(`  OK:   ${skillName} — up-to-date`);
    countSkipped++;
    continue;
  }

  // Determine action
  const action = fileExists(agentPath) ? 'Update' : 'Generate';

  if (dryRun) {
    console.log(`  [DRY] ${action}: ${skillName} → ${agentPath}`);
  } else {
    // Build agent frontmatter
    const escapedDescription = description.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
    const fmLines = ['---', `name: ${skillName}`, `description: "${escapedDescription}"`];
    if (model) fmLines.push(`model: ${model}`);
    if (tools) fmLines.push(`tools: ${tools}`);
    fmLines.push('---');

    const timestamp = new Date().toISOString();
    const header = `<!-- AUTO-GENERATED by generate-agents.ts | source: ${skillMdPath} | generated: ${timestamp} -->`;

    // body from gray-matter already has leading newline stripped; trim and append newline
    const agentContent = `${fmLines.join('\n')}\n${header}\n\n${body.trimStart()}`;
    writeTextFile(agentPath, agentContent);

    console.log(`  ${action}: ${skillName} → ${agentPath}`);
  }

  if (!dryRun) {
    if (action === 'Generate') {
      countGenerated++;
    } else {
      countUpdated++;
    }
  }

  // Record registry entry
  const timestamp = new Date().toISOString();
  newRegistryEntries.set(skillName, {
    skill_name: skillName,
    source: skillMdPath,
    agent_path: agentPath,
    generated_at: timestamp,
    source_checksum: sourceChecksum,
  });
}

// Write updated registry (unless dry run)
if (!dryRun && newRegistryEntries.size > 0) {
  saveRegistry(registryFile, newRegistryEntries);
}

console.log('');
console.log(`Summary: Generated: ${countGenerated} | Updated: ${countUpdated} | Skipped: ${countSkipped} | Errors: ${countErrors}`);
