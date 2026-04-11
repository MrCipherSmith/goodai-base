#!/usr/bin/env bun
// generate-skill-registry.ts — Regenerates hooks/skill-registry.json from skills/*/SKILL.md
//
// Usage:
//   bun src/generate-skill-registry.ts [--skills-dir <path>] [--output <path>]
//
// Reads SKILL.md files, extracts YAML frontmatter triggers block, and writes a
// JSON registry used by the skill-suggestion hook. Replaces the 5-stage
// bash/awk/python pipeline in generate-skill-registry.sh.

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs, getOption } from './shared/args.js';
import { parseSkillFrontmatter, hasFrontmatter } from './shared/frontmatter.js';
import { readTextFile, writeTextFile, fileExists } from './shared/fs-utils.js';
import { deriveKeywords } from './shared/keywords.js';

const REGISTRY_VERSION = '1.0.0';

// --- Types ---

interface HookConfig {
  enabled: boolean;
  maxSuggestions: number;
  globalMinScore: number;
  wholeWordMatch: boolean;
  [key: string]: unknown;
}

interface SkillRegistryEntry {
  name: string;
  description: string;
  keywords: string[];
  patterns: string[];
  paths: string[];
  minScore: number;
  hookConfig?: HookConfig;
}

interface SkillRegistry {
  version: string;
  generated_from: string;
  hookConfig: HookConfig;
  skills: SkillRegistryEntry[];
}

const DEFAULT_HOOK_CONFIG: HookConfig = {
  enabled: true,
  maxSuggestions: 3,
  globalMinScore: 4,
  wholeWordMatch: false,
};

// --- Logic ---

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function loadExistingRegistry(outputPath: string): SkillRegistry | null {
  if (!fileExists(outputPath)) return null;
  try {
    const raw = readTextFile(outputPath);
    return JSON.parse(raw) as SkillRegistry;
  } catch {
    return null;
  }
}

function buildEntry(
  skillMdPath: string,
  dirName: string,
  existingEntry: SkillRegistryEntry | undefined,
): SkillRegistryEntry | null {
  let content: string;
  try {
    content = readTextFile(skillMdPath);
  } catch {
    return null;
  }

  if (!hasFrontmatter(content)) {
    console.warn(`  WARN: No frontmatter in ${skillMdPath} — skipping`);
    return null;
  }

  const { data } = parseSkillFrontmatter(content);

  const name = (typeof data['name'] === 'string' ? data['name'] : '') || dirName;
  const description = typeof data['description'] === 'string' ? data['description'] : '';

  // Extract triggers block
  const triggers = data['triggers'];
  const hasTriggers =
    triggers !== null && typeof triggers === 'object' && !Array.isArray(triggers);

  let keywords: string[] = [];
  let patterns: string[] = [];
  let paths: string[] = [];

  if (hasTriggers) {
    const t = triggers as Record<string, unknown>;
    keywords = toStringArray(t['keywords']);
    patterns = toStringArray(t['patterns']);
    paths = toStringArray(t['paths']);
  }

  // Derive keywords from description if no triggers block provided any
  if (keywords.length === 0 && description.length > 0) {
    keywords = deriveKeywords(description);
  }

  // Preserve hookConfig from existing registry entry if present
  const hookConfig = existingEntry?.hookConfig;

  const entry: SkillRegistryEntry = {
    name,
    description,
    keywords,
    patterns,
    paths,
    minScore: 4,
    ...(hookConfig !== undefined ? { hookConfig } : {}),
  };

  return entry;
}

// --- Main ---

const args = parseArgs(process.argv.slice(2));

const scriptDir = new URL('.', import.meta.url).pathname;
const repoRoot = join(scriptDir, '..', '..');

const skillsDir = getOption(args, 'skills-dir', join(repoRoot, 'skills'));
const outputPath = getOption(args, 'output', join(repoRoot, 'hooks', 'skill-registry.json'));

if (!fileExists(skillsDir)) {
  console.error(`ERROR: Skills directory not found: ${skillsDir}`);
  process.exit(1);
}

console.log(`Scanning skills in: ${skillsDir}`);
console.log(`Output: ${outputPath}`);

// Load existing registry to preserve hookConfig
const existingRegistry = loadExistingRegistry(outputPath);
const existingSkillMap = new Map<string, SkillRegistryEntry>(
  (existingRegistry?.skills ?? []).map(s => [s.name, s]),
);

// Determine preserved hookConfig
const hookConfig: HookConfig =
  existingRegistry?.hookConfig != null &&
  Object.keys(existingRegistry.hookConfig).length > 0
    ? existingRegistry.hookConfig
    : DEFAULT_HOOK_CONFIG;

// Collect entries
const skills: SkillRegistryEntry[] = [];
let count = 0;
let skipped = 0;

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

  const existingEntry = existingSkillMap.get(dirName);
  const entry = buildEntry(skillMdPath, dirName, existingEntry);

  if (entry === null) {
    skipped++;
    continue;
  }

  console.log(`  + ${entry.name}`);
  skills.push(entry);
  count++;
}

// Build final registry
const registry: SkillRegistry = {
  version: REGISTRY_VERSION,
  generated_from: 'skills/*/SKILL.md',
  hookConfig,
  skills,
};

writeTextFile(outputPath, JSON.stringify(registry, null, 2) + '\n');

console.log('');
console.log(`Done. Generated: ${count} skills, Skipped: ${skipped}`);
console.log(`Output: ${outputPath}`);
