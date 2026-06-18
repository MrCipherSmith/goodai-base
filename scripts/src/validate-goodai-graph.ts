#!/usr/bin/env bun
// validate-goodai-graph.ts — Validate GoodAI Graph artifacts.

import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOption, parseArgs } from './shared/args.js';
import { buildGoodaiGraph, readGraph, validateGoodaiGraph } from './shared/goodai-graph.js';
import { fileExists } from './shared/fs-utils.js';

const SCRIPT_DIR = resolve(fileURLToPath(import.meta.url), '..');
const REPO_ROOT = resolve(SCRIPT_DIR, '..', '..');
const args = parseArgs(process.argv.slice(2));
const repoRoot = resolve(getOption(args, 'repo-root', REPO_ROOT));
const graphPath = resolve(getOption(args, 'graph', join(repoRoot, 'docs', 'goodai-graph.json')));
const graph = fileExists(graphPath) ? readGraph(graphPath) : buildGoodaiGraph(repoRoot);
const findings = validateGoodaiGraph(graph);
const errors = findings.filter((finding) => finding.severity === 'error');
const warnings = findings.filter((finding) => finding.severity === 'warning');

for (const finding of findings) {
  console.log(`${finding.severity.toUpperCase()}: ${finding.message}`);
  console.log(`  source: ${finding.source}`);
  console.log(`  target: ${finding.target}`);
  console.log(`  fix:    ${finding.suggested_fix}`);
}

if (errors.length > 0) {
  console.log(`\nGoodAI Graph validation FAILED: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}

console.log(`GoodAI Graph validation PASSED: ${warnings.length} warning(s)`);

