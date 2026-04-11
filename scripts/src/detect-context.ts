#!/usr/bin/env bun
// detect-context.ts — Unified Skills + Rules Activation System
//
// Accepts a user prompt via process.argv[2] or stdin, reads rules.json, and returns JSON:
//   { "matched_rules": [...], "matched_skills": [...] }
//
// Special: prompt starting with !nocontext → skip detection, return empty
// Exit code: always 0 (fail-open — must never block Claude)

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { fileExists, readTextFile } from './shared/fs-utils.js';

const EMPTY = '{"matched_rules":[],"matched_skills":[]}';
const LOG_FILE = resolve(homedir(), '.claude/logs/context-activation.log');

// Resolve repo root relative to this script (scripts/src/ -> scripts/ -> repo root)
const SCRIPT_DIR = resolve(import.meta.dirname ?? dirname(new URL(import.meta.url).pathname));
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const RULES_JSON = resolve(REPO_ROOT, 'rules.json');

interface Triggers {
  keywords?: string[];
  intents?: string[];
}

interface Entry {
  id?: string;
  type?: string;
  path?: string;
  triggers?: Triggers;
}

interface RegistryConfig {
  max_rules_injected?: number;
  rule_match_min_keywords?: number;
}

interface Registry {
  config?: RegistryConfig;
  entries?: Entry[];
}

interface Result {
  matched_rules: string[];
  matched_skills: string[];
}

function readPrompt(): string {
  if (process.argv[2] !== undefined && process.argv[2].length > 0) {
    return process.argv.slice(2).join(' ');
  }
  // Read from stdin synchronously
  try {
    return require('fs').readFileSync('/dev/stdin', 'utf8');
  } catch {
    return '';
  }
}

function appendLog(line: string): void {
  try {
    mkdirSync(dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, line + '\n', 'utf8');
  } catch {
    // Non-blocking: skip if log write fails
  }
}

function match(prompt: string): Result {
  const promptLower = prompt.toLowerCase();

  if (!fileExists(RULES_JSON)) {
    return { matched_rules: [], matched_skills: [] };
  }

  const raw = readTextFile(RULES_JSON);
  const registry = JSON.parse(raw) as Registry;

  const config = registry.config ?? {};
  const maxRules = config.max_rules_injected ?? 3;
  const minKeywords = config.rule_match_min_keywords ?? 1;
  const minScore = minKeywords * 2; // each keyword/intent hit = 2 pts

  const matchedRules: Array<{ score: number; path: string }> = [];
  const matchedSkills: Array<{ score: number; path: string }> = [];

  for (const entry of registry.entries ?? []) {
    const entryType = entry.type ?? '';
    if (entryType !== 'rule' && entryType !== 'skill') continue;

    const path = entry.path ?? '';
    const triggers = entry.triggers ?? {};
    const keywords = triggers.keywords ?? [];
    const intents = triggers.intents ?? [];

    let score = 0;

    // Keyword matching (+2 each)
    for (const kw of keywords) {
      if (promptLower.includes(kw.toLowerCase())) {
        score += 2;
      }
    }

    // Intent matching (+2 each)
    for (const intent of intents) {
      try {
        if (new RegExp(intent, 'i').test(promptLower)) {
          score += 2;
        }
      } catch {
        // Invalid regex — skip
      }
    }

    if (score < minScore) continue;

    if (entryType === 'rule') {
      matchedRules.push({ score, path });
    } else {
      matchedSkills.push({ score, path });
    }
  }

  // Sort by score descending; cap rules at maxRules
  matchedRules.sort((a, b) => b.score - a.score);
  matchedSkills.sort((a, b) => b.score - a.score);

  return {
    matched_rules: matchedRules.slice(0, maxRules).map((r) => r.path),
    matched_skills: matchedSkills.map((s) => s.path),
  };
}

function main(): void {
  try {
    const prompt = readPrompt().trim();

    // !nocontext bypass
    if (prompt.startsWith('!nocontext')) {
      process.stdout.write(EMPTY + '\n');
      return;
    }

    // Skip very short prompts
    if (prompt.length < 3) {
      process.stdout.write(EMPTY + '\n');
      return;
    }

    const result = match(prompt);
    const output = JSON.stringify(result);

    // Log activation event (non-blocking) only when something matched
    if (result.matched_rules.length > 0 || result.matched_skills.length > 0) {
      const promptHash = createHash('md5').update(prompt).digest('hex');
      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      appendLog(`${timestamp} | prompt_hash=${promptHash} | ${output}`);
    }

    process.stdout.write(output + '\n');
  } catch {
    // Fail-open: always emit valid JSON and exit 0
    process.stdout.write(EMPTY + '\n');
  }
}

main();
