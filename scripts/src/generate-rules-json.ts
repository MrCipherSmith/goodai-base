#!/usr/bin/env bun
// generate-rules-json.ts — Regenerate rules.json from AGENTS.md
//
// Parses the Core Rule Catalog and Skills Catalog sections of AGENTS.md,
// builds type:"rule" and type:"skill" entries with trigger keywords extracted
// from the descriptions, and writes/updates rules.json.
//
// Existing triggers.keywords in rules.json are PRESERVED (manually curated).
// Only entries missing from rules.json are added; existing entries get their
// description updated if it changed.
//
// Usage:
//   bun src/generate-rules-json.ts [--agents-md <path>] [--output <path>] [--dry-run]

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAgentsMd } from './shared/agents-md.js';
import { deriveKeywords } from './shared/keywords.js';
import { parseArgs, getOption, getFlag } from './shared/args.js';
import { readTextFile, writeTextFile, fileExists, expandHome } from './shared/fs-utils.js';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

interface Triggers {
  keywords: string[];
  intents: string[];
}

interface RulesJsonEntry {
  id: string;
  type: 'rule' | 'skill';
  path: string;
  description: string;
  triggers: Triggers;
}

interface RulesJsonConfig {
  max_rules_injected: number;
  skill_auto_activate_threshold: number;
  rule_match_min_keywords: number;
}

interface RulesJson {
  version: string;
  generated_from: string;
  config: RulesJsonConfig;
  entries: RulesJsonEntry[];
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const DEFAULT_CONFIG: RulesJsonConfig = {
  max_rules_injected: 3,
  skill_auto_activate_threshold: 0.9,
  rule_match_min_keywords: 1,
};

function isRulesJsonConfig(v: unknown): v is RulesJsonConfig {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj['max_rules_injected'] === 'number' &&
    typeof obj['skill_auto_activate_threshold'] === 'number' &&
    typeof obj['rule_match_min_keywords'] === 'number'
  );
}

function isEntry(v: unknown): v is RulesJsonEntry {
  if (typeof v !== 'object' || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    (obj['type'] === 'rule' || obj['type'] === 'skill') &&
    typeof obj['path'] === 'string' &&
    typeof obj['description'] === 'string'
  );
}

function loadExistingRulesJson(outputPath: string): {
  entries: Map<string, RulesJsonEntry>;
  config: RulesJsonConfig;
} {
  const entries = new Map<string, RulesJsonEntry>();
  let config: RulesJsonConfig = { ...DEFAULT_CONFIG };

  if (!fileExists(outputPath)) {
    return { entries, config };
  }

  try {
    const raw = readTextFile(outputPath);
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('root is not an object');
    }
    const obj = parsed as Record<string, unknown>;

    if (isRulesJsonConfig(obj['config'])) {
      config = obj['config'];
    }

    const rawEntries = obj['entries'];
    if (Array.isArray(rawEntries)) {
      for (const e of rawEntries) {
        if (isEntry(e)) {
          entries.set(e.id, e);
        }
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  WARN: Could not parse existing rules.json: ${msg}`);
  }

  return { entries, config };
}

function buildEntry(
  id: string,
  type: 'rule' | 'skill',
  path: string,
  description: string,
  existing: RulesJsonEntry | undefined,
): RulesJsonEntry {
  const existingTriggers = existing?.triggers ?? { keywords: [], intents: [] };

  // Preserve manually curated triggers if they exist; otherwise derive from description
  const keywords =
    existingTriggers.keywords.length > 0
      ? existingTriggers.keywords
      : deriveKeywords(description);
  const intents = existingTriggers.intents.length > 0 ? existingTriggers.intents : [];

  return {
    id,
    type,
    path,
    description,
    triggers: { keywords, intents },
  };
}

// ----------------------------------------------------------------
// Main
// ----------------------------------------------------------------

function main(): void {
  const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
  const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');

  const args = parseArgs(process.argv.slice(2));

  const agentsMdPath = expandHome(
    getOption(args, 'agents-md', resolve(REPO_ROOT, 'AGENTS.md')),
  );
  const outputPath = expandHome(
    getOption(args, 'output', resolve(REPO_ROOT, 'rules.json')),
  );
  const dryRun = getFlag(args, 'dry-run');

  if (!fileExists(agentsMdPath)) {
    console.error(`ERROR: AGENTS.md not found: ${agentsMdPath}`);
    process.exit(1);
  }

  console.log(`Generating rules.json from: ${agentsMdPath}`);
  if (dryRun) {
    console.log('(DRY RUN — no files written)');
  }

  // ----------------------------------------------------------------
  // Parse AGENTS.md
  // ----------------------------------------------------------------
  const agentsMdContent = readTextFile(agentsMdPath);
  const { rules: parsedRules, skills: parsedSkills } = parseAgentsMd(agentsMdContent);

  // Guard: zero entries → abort
  const totalParsed = parsedRules.length + parsedSkills.length;
  if (totalParsed === 0) {
    console.error(
      'ERROR: Parsed 0 entries from AGENTS.md — refusing to clear registry. ' +
        'Check that the "📖 Core Rule Catalog" and "🎨 Skills Catalog" sections exist.',
    );
    process.exit(1);
  }

  // ----------------------------------------------------------------
  // Load existing rules.json
  // ----------------------------------------------------------------
  const { entries: existingEntries, config } = loadExistingRulesJson(outputPath);

  // ----------------------------------------------------------------
  // Merge
  // ----------------------------------------------------------------
  let added = 0;
  let updated = 0;
  let preserved = 0;

  const newEntries = new Map<string, RulesJsonEntry>();

  // Process rules
  for (const rule of parsedRules) {
    // Derive id from path: rules/core/foo.mdc → foo
    const filename = rule.path.replace('rules/core/', '');
    const ruleId = filename.replace('.mdc', '');
    const existing = existingEntries.get(ruleId);
    const entry = buildEntry(ruleId, 'rule', rule.path, rule.description, existing);
    newEntries.set(ruleId, entry);

    if (existing !== undefined) {
      if (existing.description !== rule.description) {
        console.log(`  UPDATE rule: ${ruleId} (description changed)`);
        updated++;
      } else {
        preserved++;
      }
    } else {
      console.log(`  ADD rule: ${ruleId}`);
      added++;
    }
  }

  // Process skills
  for (const skill of parsedSkills) {
    const skillId = skill.name;
    const skillPath = `skills/${skill.name}/SKILL.md`;
    const existing = existingEntries.get(skillId);
    const entry = buildEntry(skillId, 'skill', skillPath, skill.description, existing);
    newEntries.set(skillId, entry);

    if (existing !== undefined) {
      if (existing.description !== skill.description) {
        console.log(`  UPDATE skill: ${skillId} (description changed)`);
        updated++;
      } else {
        preserved++;
      }
    } else {
      console.log(`  ADD skill: ${skillId}`);
      added++;
    }
  }

  // Preserve existing entries not found in AGENTS.md parse (manually added)
  for (const [eid, entry] of existingEntries) {
    if (!newEntries.has(eid)) {
      console.log(`  PRESERVE manual entry: ${eid}`);
      newEntries.set(eid, entry);
      preserved++;
    }
  }

  // ----------------------------------------------------------------
  // Build final registry
  // ----------------------------------------------------------------
  const registry: RulesJson = {
    version: '1.0.0',
    generated_from: 'AGENTS.md',
    config,
    entries: [...newEntries.values()],
  };

  console.log(`\nSummary: Added: ${added} | Updated: ${updated} | Preserved: ${preserved}`);
  console.log(
    `Total entries: ${newEntries.size} (${parsedRules.length} rules, ${parsedSkills.length} skills)`,
  );

  if (dryRun) {
    console.log('\n[DRY RUN] Would write to:', outputPath);
  } else {
    writeTextFile(outputPath, JSON.stringify(registry, null, 2) + '\n');
    console.log(`\nWritten: ${outputPath}`);
  }
}

main();
